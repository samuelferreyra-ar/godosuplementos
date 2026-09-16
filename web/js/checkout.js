// Checkout: tres pasos en una página, con el resumen siempre visible.
//
// Nada de lo que se muestra acá se usa para cobrar. El navegador manda qué
// quiere comprar y crearPedido recalcula precios, descuento, envío y total
// contra Firestore. Los números de esta pantalla son una previsualización.
import { obtenerConfig, zonasOrdenadas, faltaParaEnvioGratis, precio, esc, mensajeWhatsApp, abrirWhatsApp } from './tienda.js';
import { obtenerCarrito, itemsParaPedido, subtotalCarrito, contarUnidades, vaciar } from './carrito.js';
import { llamar } from './funciones.js';
import { obtenerEntrega, guardarEntrega } from './entrega.js';
import { SOLO_WHATSAPP } from './canal-venta.js';
import { opcionesModo, pruebaActualModo, nuevaClaveModo, recordarModo, abrirModo, urlConfirmacionModo } from './modo.js';

const $ = (s) => document.querySelector(s);

let config = null;
let zonas = [];
let enviando = false;

const estado = {
  contacto: { nombre: '', email: '', telefono: '' },
  // Lo que ya eligió en el carrito: no se le pregunta dos veces.
  entrega: obtenerEntrega().tipo,
  zona: obtenerEntrega().zona,
  direccion: { calle: '', numero: '', piso: '', departamento: '', localidad: 'Catamarca', provincia: 'Catamarca', codigoPostal: '' },
  metodoPago: null,
  cupon: null,             // { codigo, porcentaje }
  errores: {},
  fallo: null
};

const NOMBRES_PAGO = {
  modo: 'Pagá con MODO · prueba',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo al retirar'
};

// --- Cálculo de la previsualización -------------------------------------

function calcular() {
  const subtotal = subtotalCarrito();
  const descuento = estado.cupon ? Math.round(subtotal * estado.cupon.porcentaje / 100) : 0;
  const base = subtotal - descuento;

  let envio = 0;
  let envioGratis = false;
  if (estado.entrega === 'envio') {
    const zona = zonas.find((z) => z.id === estado.zona);
    if (faltaParaEnvioGratis(base, config) == null && typeof config.umbralEnvioGratis === 'number') {
      envioGratis = true;
    } else {
      envio = zona?.costo ?? 0;
    }
  }
  return { subtotal, descuento, base, envio, envioGratis, total: base + envio };
}

// --- Validación ----------------------------------------------------------

const esEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());
const digitos = (v) => String(v).replace(/\D/g, '').length;

function validar() {
  const e = {};
  if (estado.contacto.nombre.trim().length < 2) e.nombre = 'Poné tu nombre.';
  if (!esEmail(estado.contacto.email)) e.email = 'Revisá el mail.';
  if (digitos(estado.contacto.telefono) < 6) e.telefono = 'Revisá el teléfono.';

  if (estado.entrega === 'envio') {
    if (!estado.zona) e.zona = 'Elegí la zona de envío.';
    if (estado.direccion.calle.trim().length < 2) e.calle = 'Falta la calle.';
    if (!estado.direccion.numero.trim()) e.numero = 'Falta el número.';
  }
  if (!estado.metodoPago) e.pago = 'Elegí cómo vas a pagar.';

  estado.errores = e;
  return Object.keys(e).length === 0;
}

/** Cuántos de los tres pasos están completos, para la barra de progreso. */
function pasosHechos() {
  const datos = estado.contacto.nombre.trim().length >= 2 && esEmail(estado.contacto.email) && digitos(estado.contacto.telefono) >= 6;
  const entrega = estado.entrega === 'retiro'
    || (estado.zona && estado.direccion.calle.trim() && estado.direccion.numero.trim());
  const pago = Boolean(estado.metodoPago);
  return { datos, entrega: Boolean(entrega), pago, total: [datos, entrega, pago].filter(Boolean).length };
}

// --- Render --------------------------------------------------------------

const PASOS = ['Tus datos', 'Entrega', 'Pago'];

/** Fila de pasos de escritorio: reemplaza la barra de tres segmentos del teléfono. */
function filaPasos(hechos) {
  const estados = [hechos.datos, hechos.entrega, hechos.pago];
  const actual = estados.findIndex((e) => !e);

  return `<div class="k-pasos d-solo" id="pasos-escritorio">
    ${PASOS.map((texto, i) => {
      const clase = estados[i] ? 'es-hecho' : (i === actual ? 'es-actual' : '');
      return `${i ? '<span class="k-separador"></span>' : ''}
        <div class="k-paso ${clase}">
          <span class="k-paso-num">${estados[i] ? '<i class="bi bi-check-lg"></i>' : i + 1}</span>
          <span>${texto}</span>
        </div>`;
    }).join('')}
  </div>`;
}

const pildoraCompleto = (listo) => (listo
  ? '<span class="g-pildora g-pildora-ok d-solo"><i class="bi bi-check-circle-fill"></i> Completo</span>'
  : '');

const campo = (id, etiqueta, valor, tipo = 'text', extra = '') => `
  <div class="k-campo">
    <label for="${id}">${etiqueta}</label>
    <input id="${id}" type="${tipo}" value="${esc(valor)}" ${extra}
      ${estado.errores[id] ? 'aria-invalid="true"' : ''}>
    ${estado.errores[id] ? `<span class="k-error">${esc(estado.errores[id])}</span>` : ''}
  </div>`;

function seccionDatos(hechos) {
  return `<section class="k-seccion ${hechos.datos ? '' : 'es-actual'}">
    <div class="k-seccion-cabecera"><h2>Tus datos</h2>${pildoraCompleto(hechos.datos)}</div>
    <div class="k-campos">
      ${campo('nombre', 'Nombre y apellido', estado.contacto.nombre, 'text', 'autocomplete="name"')}
      ${campo('email', 'Mail', estado.contacto.email, 'email', 'autocomplete="email" inputmode="email"')}
      ${campo('telefono', 'Teléfono', estado.contacto.telefono, 'tel', 'autocomplete="tel" inputmode="tel"')}
    </div>
  </section>`;
}

function seccionEntrega(hechos) {
  const chipsZona = zonas.map((z) => `
    <button class="g-chip${estado.zona === z.id ? ' es-elegido' : ''}" data-zona="${esc(z.id)}">
      ${esc(z.nombre)}<small>${precio(z.costo)}</small>
    </button>`).join('');

  const bloqueEnvio = estado.entrega !== 'envio' ? '' : `
    <div style="margin:12px 0 4px">
      <span class="g-etiqueta" style="display:block;margin-bottom:9px">Zona</span>
      <div class="g-chips">${chipsZona}</div>
      ${estado.errores.zona ? `<span class="k-error">${esc(estado.errores.zona)}</span>` : ''}
    </div>
    <div class="k-campos" style="margin-top:12px">
      <div class="k-dos">
        ${campo('calle', 'Calle', estado.direccion.calle, 'text', 'autocomplete="address-line1"')}
        ${campo('numero', 'Número', estado.direccion.numero)}
      </div>
      <div class="k-dos">
        ${campo('piso', 'Piso <span class="k-opcional">· opcional</span>', estado.direccion.piso)}
        ${campo('departamento', 'Depto <span class="k-opcional">· opcional</span>', estado.direccion.departamento)}
      </div>
      <div class="k-dos">
        ${campo('localidad', 'Localidad', estado.direccion.localidad)}
        ${campo('codigoPostal', 'CP <span class="k-opcional">· opcional</span>', estado.direccion.codigoPostal)}
      </div>
    </div>`;

  const opcion = (id, titulo, nota, monto) => `
    <div class="k-opcion${estado.entrega === id ? ' es-elegida' : ''}" data-entrega="${id}" role="button" tabindex="0">
      <i class="bi bi-${estado.entrega === id ? 'record-circle-fill' : 'circle'}"></i>
      <div class="k-opcion-cuerpo"><b>${titulo}</b><small>${nota}</small></div>
      ${monto}
    </div>`;

  const { envioGratis } = calcular();
  const rango = zonas.length
    ? precio(Math.min(...zonas.map((z) => z.costo))) + ' a ' + precio(Math.max(...zonas.map((z) => z.costo)))
    : 'según zona';

  return `<section class="k-seccion ${hechos.datos && !hechos.entrega ? 'es-actual' : ''}">
    <div class="k-seccion-cabecera"><h2>Cómo lo recibís</h2>${pildoraCompleto(hechos.entrega)}</div>
    <div class="k-entrega-opciones">
      ${opcion('retiro', 'Retiro en el local', 'San Fernando del Valle de Catamarca',
               '<span class="k-monto es-gratis">Gratis</span>')}
      ${opcion('envio', 'Envío a domicilio', 'Catamarca capital y alrededores',
               envioGratis ? '<span class="k-monto es-gratis">Sin cargo</span>' : `<span class="k-monto">${rango}</span>`)}
    </div>
    ${bloqueEnvio}
  </section>`;
}

function seccionPago(hechos) {
  const metodos = config.metodosPago ?? [];
  const chips = metodos.map((m) => {
    // Efectivo solo tiene sentido si el cliente pasa por el local.
    const inhabilitado = m === 'efectivo' && estado.entrega !== 'retiro';
    return `<button class="g-chip${estado.metodoPago === m ? ' es-elegido' : ''}"
      data-pago="${esc(m)}" ${inhabilitado ? 'disabled' : ''}>
      ${esc(NOMBRES_PAGO[m] ?? m)}${inhabilitado ? ' · solo con retiro' : ''}
    </button>`;
  }).join('');

  const cupon = estado.cupon
    ? `<div class="k-cupon-estado" style="color:var(--godo-ok)">
         <i class="bi bi-check-circle-fill"></i> Cupón ${esc(estado.cupon.codigo)} aplicado · ${estado.cupon.porcentaje}% de descuento
         <button id="quitar-cupon" style="background:none;border:0;color:var(--godo-muted);text-decoration:underline;cursor:pointer;font-size:12px">quitar</button>
       </div>`
    : `<div class="k-cupon-estado g-nota" id="cupon-msg"></div>`;

  return `<section class="k-seccion ${hechos.entrega && !hechos.pago ? 'es-actual' : ''} ${hechos.entrega ? '' : 'es-pendiente'}">
    <div class="k-seccion-cabecera"><h2>Cómo pagás</h2>${pildoraCompleto(hechos.pago)}</div>
    <div class="g-chips">${chips}</div>
    ${estado.errores.pago ? `<span class="k-error" style="display:block;margin-top:6px">${esc(estado.errores.pago)}</span>` : ''}

    <div style="margin-top:16px">
      <span class="g-etiqueta" style="display:block;margin-bottom:9px">¿Tenés un código de descuento?</span>
      <div class="k-cupon">
        <div class="k-campo" style="flex:1">
          <input id="codigo-cupon" placeholder="GODO-XXXX-XXXX" autocomplete="off"
            ${estado.cupon ? 'disabled value="' + esc(estado.cupon.codigo) + '"' : ''}>
        </div>
        <button class="g-btn g-btn-borde" id="aplicar-cupon" ${estado.cupon ? 'disabled' : ''}>Aplicar</button>
      </div>
      ${cupon}
    </div>
  </section>`;
}

function seccionResumen() {
  const c = calcular();
  const zona = zonas.find((z) => z.id === estado.zona);
  const lineaEnvio = estado.entrega === 'retiro'
    ? '<div><span>Retiro en el local</span><span style="font-weight:600">Gratis</span></div>'
    : `<div><span>Envío${zona ? ' · ' + esc(zona.nombre) : ''}</span><span style="font-weight:600">${
        c.envioGratis ? '<span style="color:var(--godo-ok)">Sin cargo</span>' : (estado.zona ? precio(c.envio) : '—')}</span></div>`;

  const items = obtenerCarrito().map((l) => `<div class="k-item">
      <div class="g-foto">${l.imagen ? `<img src="${esc(l.imagen)}" alt="" onerror="this.remove()">` : ''}</div>
      <div><b>${esc(l.nombre)}</b><small>${esc([l.sabor, l.tamano].filter(Boolean).join(' · '))} · x${l.cantidad}</small></div>
      <em>${precio(l.precio * l.cantidad)}</em>
    </div>`).join('');

  return `<div class="g-tarjeta k-resumen">
    <div class="k-items d-solo">${items}</div>
    <div><span>Subtotal · ${contarUnidades()} ${contarUnidades() === 1 ? `producto` : `productos`}</span><span style="font-weight:600">${precio(c.subtotal)}</span></div>
    ${c.descuento ? `<div><span style="color:var(--godo-ok)">Descuento ${estado.cupon.porcentaje}%</span><span style="font-weight:600;color:var(--godo-ok)">−${precio(c.descuento)}</span></div>` : ''}
    ${lineaEnvio}
    <div class="k-total"><b>Total</b><strong>${precio(c.total)}</strong></div>
  </div>`;
}

function render() {
  const lineas = obtenerCarrito();
  if (!lineas.length) {
    $('#contenido').innerHTML = `<div style="text-align:center;padding:56px 0">
      <p class="g-nota">Tu carrito está vacío.</p>
      <a class="g-btn g-btn-primario" href="index.html" style="width:auto;padding:0 28px">Ver productos</a>
    </div>`;
    return;
  }

  const hechos = pasosHechos();
  document.querySelectorAll('#progreso span').forEach((s, i) => s.classList.toggle('hecho', i < hechos.total));
  const zonaPasos = $('#pasos-escritorio');
  if (zonaPasos) zonaPasos.outerHTML = filaPasos(hechos);
  // El número tiene que nombrar el primer paso incompleto, no la cantidad de
  // completos: con retiro elegido de entrada, el paso 2 ya está hecho y el
  // pendiente sigue siendo el 1.
  const pendiente = !hechos.datos ? [1, 'Tus datos']
    : !hechos.entrega ? [2, 'Cómo lo recibís']
    : !hechos.pago ? [3, 'Cómo pagás'] : null;
  $('#paso-actual').textContent = pendiente
    ? `Paso ${pendiente[0]} de 3 · ${pendiente[1]}`
    : 'Listo para confirmar';

  const c = calcular();
  $('#contenido').className = 'g-pagina k-layout';
  $('#contenido').innerHTML = `
    <div>
      ${seccionDatos(hechos)}
      ${seccionEntrega(hechos)}
      ${seccionPago(hechos)}
      ${estado.fallo ? `<div class="k-falla">${estado.fallo}</div>` : ''}
    </div>
    <div class="k-columna-resumen">
      ${seccionResumen()}
      <div class="g-pie-fijo">
        <button class="g-btn g-btn-acento" id="confirmar" ${enviando ? 'disabled' : ''}>
          ${enviando ? 'Confirmando…' : 'Confirmar pedido · ' + precio(c.total)}
        </button>
        <button class="g-enlace-wa" id="por-whatsapp"><i class="bi bi-whatsapp"></i> o pedilo por WhatsApp</button>
      </div>
    </div>`;

  conectar();
}

// --- Eventos -------------------------------------------------------------

function conectar() {
  const enlazar = (id, destino, clave) => {
    const el = $('#' + id);
    if (!el) return;
    el.oninput = () => { destino[clave] = el.value; };
    // Se repinta al salir del campo, no en cada tecla: si no, se pierde el foco.
    el.onblur = () => { if (Object.keys(estado.errores).length) { validar(); render(); } };
  };

  enlazar('nombre', estado.contacto, 'nombre');
  enlazar('email', estado.contacto, 'email');
  enlazar('telefono', estado.contacto, 'telefono');
  ['calle', 'numero', 'piso', 'departamento', 'localidad', 'codigoPostal']
    .forEach((k) => enlazar(k, estado.direccion, k));

  document.querySelectorAll('[data-entrega]').forEach((el) => {
    el.onclick = () => {
      estado.entrega = el.dataset.entrega;
      guardarEntrega({ tipo: estado.entrega, zona: estado.zona });
      // Si deja de retirar, efectivo ya no aplica.
      if (estado.entrega !== 'retiro' && estado.metodoPago === 'efectivo') estado.metodoPago = null;
      render();
    };
  });

  document.querySelectorAll('[data-zona]').forEach((el) => {
    el.onclick = () => {
      estado.zona = el.dataset.zona;
      guardarEntrega({ tipo: estado.entrega, zona: estado.zona });
      render();
    };
  });

  document.querySelectorAll('[data-pago]').forEach((el) => {
    el.onclick = () => { estado.metodoPago = el.dataset.pago; render(); };
  });

  const aplicar = $('#aplicar-cupon');
  if (aplicar) aplicar.onclick = aplicarCupon;
  const quitar = $('#quitar-cupon');
  if (quitar) quitar.onclick = () => { estado.cupon = null; render(); };

  $('#confirmar').onclick = confirmar;
  $('#por-whatsapp').onclick = pedirPorWhatsApp;
}

async function aplicarCupon() {
  const entrada = $('#codigo-cupon');
  const msg = $('#cupon-msg');
  const codigo = entrada.value.trim();
  if (!codigo) return;

  $('#aplicar-cupon').disabled = true;
  msg.textContent = 'Verificando…';
  msg.style.color = '';

  try {
    const r = await llamar('validarCupon', { codigo });
    if (r.valido) {
      estado.cupon = { codigo: r.codigo, porcentaje: r.porcentaje };
      render();
    } else {
      msg.textContent = r.motivo;
      msg.style.color = 'var(--godo-danger)';
      $('#aplicar-cupon').disabled = false;
    }
  } catch (e) {
    msg.textContent = e.mensaje ?? 'No pudimos verificar el código. Probá de nuevo.';
    msg.style.color = 'var(--godo-danger)';
    $('#aplicar-cupon').disabled = false;
  }
}

/** Lo que se le manda al servidor. Nunca precios ni totales. */
function armarPedido() {
  return {
    items: itemsParaPedido(),
    contacto: {
      nombre: estado.contacto.nombre.trim(),
      email: estado.contacto.email.trim(),
      telefono: estado.contacto.telefono.trim()
    },
    entrega: estado.entrega === 'retiro'
      ? { tipo: 'retiro' }
      : { tipo: 'envio', zona: estado.zona, direccion: { ...estado.direccion } },
    pago: { metodo: estado.metodoPago },
    cupon: estado.cupon?.codigo ?? null,
    canal: 'web'
  };
}

function mostrarFallo(e) {
  const faltantes = e.detalles?.faltantes;
  if (faltantes?.length) {
    estado.fallo = 'Algunos productos cambiaron mientras comprabas:<ul>' +
      faltantes.map((f) => `<li>${esc(f.nombre ?? 'Un producto')} — ${esc(f.motivo)}</li>`).join('') +
      '</ul>Revisá el carrito y volvé a intentar.';
  } else {
    estado.fallo = esc(e.mensaje ?? 'No pudimos confirmar el pedido. Probá de nuevo en un momento.');
  }
}

async function confirmar() {
  estado.fallo = null;
  if (!validar()) { render(); document.querySelector('[aria-invalid="true"]')?.focus(); return; }

  enviando = true;
  render();

  try {
    const esModo = estado.metodoPago === 'modo';
    if (esModo && pruebaActualModo()?.pedidoId) {
      location.href = urlConfirmacionModo(pruebaActualModo().pedidoId);
      return;
    }
    const r = await llamar(esModo ? 'crearPedidoModo' : 'crearPedido', {
      ...armarPedido(), ...(esModo ? { clave: nuevaClaveModo() } : {})
    });
    // El pedido de un invitado no lo puede leer nadie desde el navegador, así
    // que la confirmación viaja por sessionStorage y no por Firestore.
    sessionStorage.setItem('godo.ultimoPedido', JSON.stringify({
      ...r, entrega: estado.entrega, contacto: estado.contacto,
      direccion: estado.entrega === 'envio' ? estado.direccion : null,
      metodoPago: estado.metodoPago
    }));
    if (esModo) {
      recordarModo(r.pedidoId);
      vaciar();
      try { await abrirModo(r.pedidoId); }
      catch (e) {
        sessionStorage.setItem('godo.modo.error', e.mensaje ?? e.message);
        location.href = urlConfirmacionModo(r.pedidoId);
      }
      return;
    }
    vaciar();
    location.href = 'confirmacion.html';
  } catch (e) {
    if (estado.metodoPago === 'modo' && /^modo_[a-f0-9]{64}$/.test(e.detalles?.pedidoId ?? '')) {
      recordarModo(e.detalles.pedidoId);
      location.href = urlConfirmacionModo(e.detalles.pedidoId);
      return;
    }
    enviando = false;
    mostrarFallo(e);
    render();
    $('#contenido').scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

function pedirPorWhatsApp() {
  abrirWhatsApp(config.whatsapp, mensajeWhatsApp(obtenerCarrito(), { total: calcular().total }));
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  if (SOLO_WHATSAPP) { location.replace('carrito.html'); return; }
  [config, zonas] = await Promise.all([obtenerConfig(), zonasOrdenadas()]);
  const modo = await opcionesModo();
  config = { ...config, metodosPago: (config.metodosPago ?? []).filter(m => m !== 'payway' && m !== 'modo') };
  if (modo.habilitado) config.metodosPago.push('modo');

  // El cliente volvió del formulario de Payway sin pagar.
  if (new URLSearchParams(location.search).get('pago') === 'cancelado') {
    estado.fallo = 'Cancelaste el pago. Tu pedido quedó guardado: podés volver a intentarlo.';
  }
  render();
}

iniciar();
