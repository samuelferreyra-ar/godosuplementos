// Páginas informativas. Las partes que pueden cambiar —zonas, costos, umbral
// de envío gratis, medios de pago— salen de config/tienda, no del HTML.
//
// El motivo es concreto: la versión anterior de estas páginas anunciaba
// "Zona Sur: Gratis" y "$XX.XXX", y prometía medios de pago que el checkout
// no acepta. Leyendo de la misma fuente que cobra, eso no puede repetirse.
import { obtenerConfig, zonasOrdenadas, precio, esc } from './tienda.js';
import { montarNav } from './nav.js';
import { montarChrome, montarPie } from './chrome.js';
import { SOLO_WHATSAPP } from './canal-venta.js';

const $ = (s) => document.querySelector(s);

const NOMBRES_PAGO = {
  payway: { titulo: 'Tarjeta de crédito y débito', nota: 'Procesado por Payway. No guardamos los datos de tu tarjeta.' },
  transferencia: { titulo: 'Transferencia bancaria', nota: 'Te pasamos los datos al confirmar el pedido.' },
  efectivo: { titulo: 'Efectivo al retirar', nota: 'Solo si elegís retirar por el local.' }
};

async function pintarEnvios(config) {
  const zonas = await zonasOrdenadas();
  const umbral = config.umbralEnvioGratis;

  $('#zonas').innerHTML = zonas.length
    ? zonas.map((z) => `<div class="i-fila"><b>${esc(z.nombre)}</b><span>${precio(z.costo)}</span></div>`).join('') +
      '<div class="i-fila"><b>Retiro en el local</b><span class="i-gratis">Sin cargo</span></div>'
    : '<div class="i-fila"><b>Consultanos por WhatsApp</b></div>';

  $('#umbral').innerHTML = typeof umbral === 'number' && umbral > 0
    ? `<div class="i-destacado">
         <i class="bi bi-truck"></i>
         <span>Superando los <b>${precio(umbral)}</b> en productos, el envío no se cobra en ninguna zona. Se aplica solo, sin código.</span>
       </div>`
    : '';
}

function pintarPagos(config) {
  if (SOLO_WHATSAPP) {
    $('#metodos').innerHTML = '<div class="i-fila"><b>Coordinamos el pago por WhatsApp</b></div><p>Armá tu carrito y envianos los productos. Te confirmamos la disponibilidad, el total y cómo pagar por chat.</p>';
    document.querySelectorAll('[data-solo-tarjeta], [data-solo-transferencia]').forEach(el => el.hidden = true);
    return;
  }
  const metodos = (config.metodosPago ?? []).filter((m) => NOMBRES_PAGO[m]);

  $('#metodos').innerHTML = metodos.length
    ? metodos.map((m) => `<div class="i-fila" style="align-items:flex-start;flex-direction:column;gap:3px">
        <b>${esc(NOMBRES_PAGO[m].titulo)}</b>
        <span style="font-weight:400;font-size:12.5px;color:var(--godo-muted)">${esc(NOMBRES_PAGO[m].nota)}</span>
      </div>`).join('')
    : '<div class="i-fila"><b>Escribinos por WhatsApp para coordinar el pago</b></div>';

  // La sección de tarjeta solo existe si la tarjeta está habilitada.
  const conTarjeta = metodos.includes('payway');
  document.querySelectorAll('[data-solo-tarjeta]').forEach((el) => el.hidden = !conTarjeta);
  const conTransferencia = metodos.includes('transferencia');
  document.querySelectorAll('[data-solo-transferencia]').forEach((el) => el.hidden = !conTransferencia);
}

async function iniciar() {
  montarNav(null);
  montarChrome({}); montarPie();
  const config = await obtenerConfig();

  if ($('#zonas')) await pintarEnvios(config);
  if ($('#metodos')) pintarPagos(config);

  const wa = $('#link-whatsapp');
  if (wa) wa.href = 'https://wa.me/' + String(config.whatsapp ?? '').replace(/\D/g, '');
}

iniciar();
