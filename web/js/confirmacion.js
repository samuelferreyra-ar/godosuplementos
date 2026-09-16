// Confirmación del pedido.
//
// Los datos llegan por sessionStorage desde el checkout: el pedido de un
// invitado no tiene dueño, así que las reglas de Firestore no dejan leerlo
// desde el navegador — y está bien que sea así.
import { obtenerConfig, precio, esc, mensajeWhatsApp, abrirWhatsApp } from './tienda.js';
import { llamar } from './funciones.js';

const TRAMOS = ['Pagado', 'Preparando', 'En camino', 'Entregado'];

function leerPedido() {
  try {
    const crudo = sessionStorage.getItem('godo.ultimoPedido');
    return crudo ? JSON.parse(crudo) : null;
  } catch {
    return null;
  }
}

/**
 * Estado del pago, arriba de todo. Solo aparece si el pedido se pagó con
 * tarjeta: con transferencia o efectivo el pago es posterior, y decir algo
 * acá confundiría.
 */
function bloquePago(pedido, estadoPago, motivo) {
  if (pedido.metodoPago !== 'payway' && !estadoPago) return '';

  if (estadoPago === 'pagado') {
    return `<div class="f-pago f-pago-ok"><i class="bi bi-check-circle-fill"></i>
      <span>Pago acreditado. Ya estamos preparando tu pedido.</span></div>`;
  }
  if (estadoPago === 'verificando') {
    return `<div class="f-pago f-pago-espera"><i class="bi bi-hourglass-split"></i>
      <span>Verificando el pago con el banco…</span></div>`;
  }
  return `<div class="f-pago f-pago-falla"><i class="bi bi-exclamation-triangle"></i>
    <span>${esc(motivo || 'El pago no se completó. Tu pedido quedó guardado; escribinos por WhatsApp y lo resolvemos.')}</span></div>`;
}

function render(pedido, config, estadoPago = null, motivo = null) {
  const esEnvio = pedido.entrega === 'envio';
  const d = pedido.direccion;

  const domicilio = esEnvio && d
    ? [d.calle, d.numero, d.piso ? 'piso ' + d.piso : '', d.departamento ? 'depto ' + d.departamento : '', d.localidad]
        .filter(Boolean).join(' ')
    : 'San Fernando del Valle de Catamarca';

  // Solo el primer tramo está cumplido: el pedido se crea sin preparar, y
  // con transferencia o efectivo el pago todavía no está confirmado.
  const tramosHechos = estadoPago === 'pagado' ? 1 : 0;

  const items = (pedido.items ?? []).map((i) => `
    <article class="g-tarjeta f-item">
      <div class="g-foto"></div>
      <div>
        <b>${esc(i.nombre)}</b>
        <small>${esc([i.sabor, i.tamano].filter(Boolean).join(' · '))} · x${i.cantidad}</small>
      </div>
      <span class="f-precio">${precio(i.subtotal)}</span>
    </article>`).join('');

  const envio = pedido.envio ?? {};

  document.querySelector('#contenido').innerHTML = `
    <header class="f-cabecera">
      <div class="f-tilde"><i class="bi bi-check-lg"></i></div>
      <h1>¡Gracias por tu compra!</h1>
      <p>Tu pedido es el <strong style="color:var(--godo-amber)">#${esc(pedido.numero)}</strong> · te escribimos para coordinar</p>
    </header>

    <div class="f-cuerpo">
      ${bloquePago(pedido, estadoPago, motivo)}
      <section class="g-tarjeta f-entrega">
        <h2>${esEnvio ? 'Envío a domicilio' : 'Retiro en el local'}</h2>
        <p>${esc(domicilio)}${esEnvio && envio.nombreZona ? ' · ' + esc(envio.nombreZona) : ''}</p>
        <div class="f-tramos">
          ${TRAMOS.map((_, i) => `<span class="${i < tramosHechos ? 'hecho' : ''}"></span>`).join('')}
        </div>
        <div class="f-etiquetas">${TRAMOS.map((t) => `<span>${t}</span>`).join('')}</div>
      </section>

      <div class="f-items">${items}</div>

      <div class="g-tarjeta f-totales">
        <div><span>Subtotal</span><span>${precio(pedido.subtotal)}</span></div>
        ${pedido.descuento ? `<div><span style="color:var(--godo-ok)">Descuento ${pedido.cupon?.porcentaje ?? ''}%</span><span style="color:var(--godo-ok)">−${precio(pedido.descuento)}</span></div>` : ''}
        <div><span>${esEnvio ? 'Envío' : 'Retiro'}</span><span>${envio.costo ? precio(envio.costo) : 'Sin cargo'}</span></div>
        <div class="f-total"><span>Total</span><span>${precio(pedido.total)}</span></div>
      </div>

      <div class="f-acciones">
        <a class="g-btn g-btn-primario" href="mis-pedidos.html">Seguir mi pedido</a>
        <button class="g-btn g-btn-borde" id="escribir"><i class="bi bi-whatsapp"></i> Escribirnos por WhatsApp</button>
        <a class="g-enlace-wa" href="index.html" style="text-decoration:none">Seguir comprando</a>
      </div>
    </div>`;

  document.querySelector('#escribir').onclick = () => {
    abrirWhatsApp(config.whatsapp, mensajeWhatsApp(pedido.items ?? [], {
      numeroPedido: pedido.numero, total: pedido.total
    }));
  };
}

async function iniciar() {
  const parametros = new URLSearchParams(location.search);
  if (parametros.get('modo') === '1') {
    const { iniciarConfirmacionModo } = await import('./confirmacion-modo.js');
    await iniciarConfirmacionModo(parametros.get('pedido'));
    return;
  }
  const pedido = leerPedido();
  if (!pedido?.numero) {
    document.querySelector('#contenido').innerHTML = `<div class="f-vacio">
      <p class="g-nota">No encontramos un pedido reciente en esta pestaña.</p>
      <a class="g-btn g-btn-primario" href="index.html" style="width:auto;padding:0 28px">Ir a la tienda</a>
    </div>`;
    return;
  }
  const config = await obtenerConfig();
  const vueltaDePayway = new URLSearchParams(location.search).get('pedido');
  const fallo = sessionStorage.getItem('godo.pagoFallido');
  sessionStorage.removeItem('godo.pagoFallido');

  if (fallo) { render(pedido, config, 'rechazado', fallo); return; }
  if (!vueltaDePayway) { render(pedido, config); return; }

  // El cliente volvió del formulario de Payway. Lo que diga la URL no vale:
  // se consulta el estado real antes de darle una respuesta.
  render(pedido, config, 'verificando');
  try {
    const r = await llamar('confirmarPagoDePedido', {
      pedidoId: vueltaDePayway,
      email: pedido.contacto?.email
    });
    // "verificando" no es un rechazo: el pago puede estar bien y todavía no
    // haber llegado la confirmación. Decirle que falló sería mentirle.
    const cara = r.estado === 'pagado' ? 'pagado' : r.estado === 'verificando' ? 'verificando' : 'rechazado';
    render(pedido, config, cara, r.motivo);
  } catch (e) {
    render(pedido, config, 'rechazado',
      e.mensaje ?? 'No pudimos verificar el pago. Escribinos por WhatsApp y lo revisamos.');
  }
}

iniciar();
