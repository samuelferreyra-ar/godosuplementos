// Página del carrito.
//
// Al abrir, revalida cada línea contra Firestore: el carrito vive en el
// navegador y puede tener horas o días, así que precio y stock pueden haber
// cambiado. Mejor avisarlo acá que fallar en el checkout.
import { obtenerProducto, obtenerCatalogo, hayStock, fotoDe } from './catalogo.js';
import { obtenerConfig, zonasOrdenadas, faltaParaEnvioGratis, precio, esc, mensajeWhatsApp, abrirWhatsApp, enlaceWhatsApp } from './tienda.js';
import { obtenerEntrega, guardarEntrega, costoEntrega } from './entrega.js';
import { SOLO_WHATSAPP } from './canal-venta.js';
import { obtenerCarrito, cambiarCantidad, quitar, agregar, actualizarPrecio, contarUnidades, subtotalCarrito } from './carrito.js';

const $ = (s) => document.querySelector(s);
let config = null;
let avisos = [];      // { clave, texto, tono }
let sugeridos = [];
let zonas = [];
let entrega = obtenerEntrega();

const clave = (l) => l.productoId + '|' + l.varianteId;

// --- Revalidación --------------------------------------------------------

async function revalidar() {
  const lineas = obtenerCarrito();
  if (!lineas.length) return [];

  avisos = [];
  const productos = await Promise.all([...new Set(lineas.map((l) => l.productoId))].map(obtenerProducto));
  const porId = new Map(productos.filter(Boolean).map((p) => [p.id, p]));

  for (const linea of lineas) {
    const producto = porId.get(linea.productoId);
    const variante = producto?.variantes.find((v) => v.varianteId === linea.varianteId);

    if (!producto || !variante) {
      avisos.push({ clave: clave(linea), texto: 'Ya no está disponible. Lo sacamos del carrito.', tono: 'sin' });
      quitar(linea.productoId, linea.varianteId);
      continue;
    }

    if (!hayStock(variante)) {
      avisos.push({ clave: clave(linea), texto: 'Se quedó sin stock. Lo sacamos del carrito.', tono: 'sin' });
      quitar(linea.productoId, linea.varianteId);
      continue;
    }

    if (linea.cantidad > variante.stock) {
      avisos.push({
        clave: clave(linea),
        texto: `Quedan ${variante.stock}. Ajustamos la cantidad.`, tono: 'aviso'
      });
      cambiarCantidad(linea.productoId, linea.varianteId, variante.stock);
    }

    if (variante.precio !== linea.precio) {
      avisos.push({
        clave: clave(linea),
        texto: `El precio cambió de ${precio(linea.precio)} a ${precio(variante.precio)}.`, tono: 'aviso'
      });
      // Se corrige en el carrito para que el resumen no mienta. De todos modos
      // el total real lo calcula crearPedido en el servidor.
      actualizarPrecio(linea.productoId, linea.varianteId, variante.precio);
    }
  }

  return obtenerCarrito();
}

// --- Sugeridos para llegar al envío gratis -------------------------------

async function calcularSugeridos(falta) {
  if (falta == null) return [];
  const enCarrito = new Set(obtenerCarrito().map((l) => l.productoId));
  const catalogo = await obtenerCatalogo();

  // Lo más barato que acerque al umbral, sin repetir lo que ya está.
  return catalogo
    .filter((p) => !enCarrito.has(p.id) && p.precioMin > 0)
    .sort((a, b) => Math.abs(a.precioMin - falta) - Math.abs(b.precioMin - falta))
    .slice(0, 3);
}

// --- Render --------------------------------------------------------------

function barraEnvio(subtotal) {
  const falta = faltaParaEnvioGratis(subtotal, config);
  const umbral = config.umbralEnvioGratis;
  if (typeof umbral !== 'number' || umbral <= 0) return '';

  if (falta == null) {
    return `<div class="g-tarjeta c-envio" style="border-radius:16px">
      <p style="color:var(--godo-ok)"><i class="bi bi-check-circle-fill"></i> El envío te sale sin cargo</p>
      <div class="c-pista"><span style="width:100%"></span></div>
    </div>`;
  }
  const porcentaje = Math.max(4, Math.min(100, Math.round((subtotal / umbral) * 100)));
  return `<div class="g-tarjeta c-envio" style="border-radius:16px">
    <p>Sumá ${precio(falta)} y el envío es gratis</p>
    <div class="c-pista"><span style="width:${porcentaje}%"></span></div>
  </div>`;
}

function tarjetaItem(l) {
  const aviso = avisos.find((a) => a.clave === clave(l));
  const chips = [l.sabor, l.tamano].filter(Boolean)
    .map((t) => `<span>${esc(t)}</span>`).join('');

  return `<article class="g-tarjeta c-item" data-linea="${esc(clave(l))}">
    <div class="c-principal">
      <div class="g-foto">${l.imagen ? `<img src="${esc(l.imagen)}" alt="" onerror="this.remove()">` : ''}</div>
      <div class="c-cuerpo">
        <a href="producto.html?id=${encodeURIComponent(l.productoId)}" class="c-nombre">${esc(l.nombre)}</a>
        <div class="c-variantes">${chips}</div>
        <span class="c-unitario">${precio(l.precio)} c/u</span>
        ${aviso ? `<div class="c-aviso" style="color:var(--godo-${aviso.tono === 'sin' ? 'danger' : 'warn-text'})">${esc(aviso.texto)}</div>` : ''}
      </div>
    </div>
    <div class="c-cantidad">
      <button data-menos ${l.cantidad <= 1 ? 'disabled' : ''} aria-label="Quitar uno">−</button>
      <span>${l.cantidad}</span>
      <button data-mas aria-label="Agregar uno">+</button>
    </div>
    <span class="c-subtotal">${precio(l.precio * l.cantidad)}</span>
    <button class="c-quitar" data-quitar aria-label="Quitar del carrito"><i class="bi bi-trash3"></i></button>
  </article>`;
}

function bloqueSugeridos() {
  if (!sugeridos.length) return '';
  const tarjetas = sugeridos.map((p) => {
    const foto = fotoDe(p);
    const unaSola = p.variantes.filter(hayStock).length === 1;
    return `<article class="g-tarjeta c-sugerido">
      <div class="g-foto">${foto ? `<img src="${esc(foto)}" alt="" onerror="this.remove()">` : ''}</div>
      <div class="c-sugerido-texto">
        <b>${esc(p.nombre)}</b>
        <em>${precio(p.precioMin)}</em>
      </div>
      ${unaSola
        ? `<button class="c-sumar-btn" data-sumar="${esc(p.id)}" aria-label="Sumar ${esc(p.nombre)} al carrito" title="Sumar al carrito">
             <span class="c-sumar-signo">+</span><span class="c-sumar-texto">Sumar</span>
           </button>`
        : `<a class="c-sumar-btn" href="producto.html?id=${encodeURIComponent(p.id)}" aria-label="Elegir sabor de ${esc(p.nombre)}" title="Elegir sabor">
             <span class="c-sumar-signo">+</span><span class="c-sumar-texto">Elegir sabor</span>
           </a>`}
    </article>`;
  }).join('');

  return `<section class="c-sumar">
    <h2 class="g-titulo-seccion" style="font-size:20px">Agregá y ahorrá envío</h2>
    <div class="c-sumar-lista">${tarjetas}</div>
  </section>`;
}

function bloqueEntrega(subtotal) {
  const chips = zonas.map((z) => {
    const elegida = entrega.tipo === 'envio' && entrega.zona === z.id;
    const gratis = typeof config.umbralEnvioGratis === 'number'
      && config.umbralEnvioGratis > 0 && subtotal >= config.umbralEnvioGratis;
    return `<button class="g-chip${elegida ? ' es-elegido' : ''}" data-zona="${esc(z.id)}">
      ${esc(z.nombre)}<small>${gratis ? 'Sin cargo' : precio(z.costo)}</small>
    </button>`;
  }).join('');

  return `<section class="c-entrega">
    <h2 class="g-titulo-seccion" style="font-size:20px">Cómo lo recibís</h2>
    <div class="c-entrega-opciones">
      <button class="c-opcion${entrega.tipo === 'retiro' ? ' es-elegida' : ''}" data-entrega="retiro">
        <i class="bi bi-${entrega.tipo === 'retiro' ? 'record-circle-fill' : 'circle'}"></i>
        <span><b>Retiro en el local</b><small>Dr. Agustín Correa y Soria 15</small></span>
        <em>Gratis</em>
      </button>
      <button class="c-opcion${entrega.tipo === 'envio' ? ' es-elegida' : ''}" data-entrega="envio">
        <i class="bi bi-${entrega.tipo === 'envio' ? 'record-circle-fill' : 'circle'}"></i>
        <span><b>Envío a domicilio</b><small>Catamarca capital y alrededores</small></span>
        <em>Según zona</em>
      </button>
    </div>
    ${entrega.tipo === 'envio' ? `<div class="c-zonas">
      <span class="g-etiqueta" style="display:block;margin-bottom:9px">Zona</span>
      <div class="g-chips">${chips}</div>
    </div>` : ''}
  </section>`;
}

function resumen(subtotal) {
  const e = costoEntrega(entrega, subtotal, config, zonas);
  const total = subtotal + (e.costo ?? 0);

  const valorEnvio = e.costo === null
    ? '<span class="c-nota-envio">Elegí la zona</span>'
    : e.gratis || e.costo === 0
      ? '<span style="color:var(--godo-ok);font-weight:600">Sin cargo</span>'
      : `<span style="font-weight:600">${precio(e.costo)}</span>`;

  return `<div class="g-tarjeta c-resumen">
    <div><span>Subtotal · ${contarUnidades()} ${contarUnidades() === 1 ? 'producto' : 'productos'}</span><span style="font-weight:600">${precio(subtotal)}</span></div>
    <div><span>${esc(e.etiqueta)}</span>${valorEnvio}</div>
    <div class="c-total"><b>Total</b><strong>${precio(total)}</strong></div>
  </div>`;
}

function mensajeDelCarrito() {
  const subtotal = subtotalCarrito();
  const e = costoEntrega(entrega, subtotal, config, zonas);
  return mensajeWhatsApp(obtenerCarrito(), {
    total: subtotal + (e.costo ?? 0),
    entrega: entrega.tipo === 'retiro' ? 'Retiro en el local' : 'Envío a domicilio · ' + e.etiqueta,
    costoEnvio: e.costo,
    aCoordinar: true
  });
}

function render(lineas) {
  const subtotal = subtotalCarrito();
  $('#titulo-carrito').textContent = lineas.length ? `Tu carrito · ${contarUnidades()}` : 'Tu carrito';

  if (!lineas.length) {
    $('#contenido').className = 'g-pagina';
    $('#contenido').innerHTML = `
      ${avisos.length ? `<div class="g-tarjeta" style="padding:12px;margin-top:16px;font-size:13px;color:var(--godo-warn-text)">
        ${avisos.map((a) => esc(a.texto)).join('<br>')}
      </div>` : ''}
      <div class="c-vacio">
        <i class="bi bi-bag"></i>
        <p>Tu carrito está vacío.</p>
        <a class="g-btn g-btn-primario" href="index.html">Ver productos</a>
      </div>`;
    return;
  }

  $('#contenido').className = 'g-pagina c-layout';
  $('#contenido').innerHTML = `
    <div>
      ${barraEnvio(subtotal)}
      <div class="c-encabezado d-solo">
        <span>Producto</span><span>Cantidad</span><span>Subtotal</span><span></span>
      </div>
      ${lineas.map(tarjetaItem).join('')}
      ${bloqueEntrega(subtotal)}
      ${bloqueSugeridos()}
    </div>
    <div class="c-columna-resumen">
      ${resumen(subtotal)}
      <div class="g-pie-fijo">
        ${SOLO_WHATSAPP
          ? `<a class="g-btn g-btn-primario" id="por-whatsapp" href="${esc(enlaceWhatsApp(config.whatsapp, mensajeDelCarrito()))}" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Pedir por WhatsApp</a><p class="g-nota" role="status" id="aviso-whatsapp">Coordinamos el pago y la entrega por chat. El carrito no reserva stock.</p>`
          : '<a class="g-btn g-btn-primario" href="checkout.html">Iniciar compra</a><button class="g-enlace-wa" id="por-whatsapp"><i class="bi bi-whatsapp"></i> o pedilo por WhatsApp</button>'}
      </div>
    </div>`;

  conectar();
}

function conectar() {
  document.querySelectorAll('[data-linea]').forEach((el) => {
    const [productoId, varianteId] = el.dataset.linea.split('|');
    const linea = obtenerCarrito().find((l) => clave(l) === el.dataset.linea);
    if (!linea) return;

    el.querySelector('[data-menos]').onclick = () => actualizar(cambiarCantidad(productoId, varianteId, linea.cantidad - 1));
    el.querySelector('[data-mas]').onclick = async () => {
      const producto = await obtenerProducto(productoId);
      const variante = producto?.variantes.find((v) => v.varianteId === varianteId);
      if (linea.cantidad >= (variante?.stock ?? 0)) {
        avisos = [{ clave: el.dataset.linea, texto: `No hay más stock: quedan ${variante?.stock ?? 0}.`, tono: 'aviso' }];
        return actualizar(obtenerCarrito());
      }
      actualizar(cambiarCantidad(productoId, varianteId, linea.cantidad + 1));
    };
    el.querySelector('[data-quitar]').onclick = () => { avisos = []; actualizar(quitar(productoId, varianteId)); };
  });

  document.querySelectorAll('[data-entrega]').forEach((b) => {
    b.onclick = () => {
      entrega = guardarEntrega({ tipo: b.dataset.entrega, zona: entrega.zona });
      // Si pasa a envío y no hay zona elegida, se propone la más barata.
      if (entrega.tipo === 'envio' && !entrega.zona && zonas.length) {
        entrega = guardarEntrega({ tipo: 'envio', zona: zonas[0].id });
      }
      render(obtenerCarrito());
    };
  });
  document.querySelectorAll('[data-zona]').forEach((b) => {
    b.onclick = () => {
      entrega = guardarEntrega({ tipo: 'envio', zona: b.dataset.zona });
      render(obtenerCarrito());
    };
  });

  document.querySelectorAll('[data-sumar]').forEach((b) => {
    b.onclick = async () => {
      const producto = await obtenerProducto(b.dataset.sumar);
      const variante = producto?.variantes.find(hayStock);
      if (variante) { agregar(producto, variante, 1); actualizar(obtenerCarrito()); }
    };
  });

  const wa = $('#por-whatsapp');
  if (wa) wa.onclick = (evento) => {
    const subtotal = subtotalCarrito();
    const e = costoEntrega(entrega, subtotal, config, zonas);
    if (entrega.tipo === 'envio' && e.costo === null) {
      evento.preventDefault();
      const aviso = $('#aviso-whatsapp');
      if (aviso) aviso.textContent = 'Elegí la zona de envío antes de continuar.';
      document.querySelector('.c-zonas')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!SOLO_WHATSAPP) abrirWhatsApp(config.whatsapp, mensajeDelCarrito());
  };
}

function actualizar(lineas) {
  render(lineas);
  avisos = [];
  refrescarSugeridos();
}

/** Recalcula los sugeridos y repinta solo si la lista cambió. */
async function refrescarSugeridos() {
  const antes = sugeridos.map((p) => p.id).join();
  sugeridos = await calcularSugeridos(faltaParaEnvioGratis(subtotalCarrito(), config));
  if (sugeridos.map((p) => p.id).join() !== antes) render(obtenerCarrito());
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  [config, zonas] = await Promise.all([obtenerConfig(), zonasOrdenadas()]);
  const lineas = await revalidar();
  render(lineas);

  // Los sugeridos requieren el catálogo entero: llegan después, sin bloquear.
  if (lineas.length) await refrescarSugeridos();
}

iniciar();
