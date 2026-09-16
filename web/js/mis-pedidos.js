// Historial de pedidos del cliente.
//
// En escritorio esta pantalla vive dentro de Mi cuenta; acá se conserva para
// el teléfono y para el enlace directo desde la confirmación.
import { esperarSesion } from './sesion.js';
import { precio, esc } from './tienda.js';
import { montarNav } from './nav.js';
import { montarChrome, montarPie } from './chrome.js';
import { pedidosDe, pildoraEstado, formatoFecha } from './pedidos.js';

const $ = (s) => document.querySelector(s);

function tarjeta(p) {
  const envio = p.envio?.tipo === 'retiro'
    ? 'Retiro en el local'
    : ('Envío' + (p.envio?.nombreZona ? ' · ' + p.envio.nombreZona : ''));

  const items = p.items.map((i) => `<li>${esc(i.nombre)}${
    [i.sabor, i.tamano].filter(Boolean).length ? ' (' + esc([i.sabor, i.tamano].filter(Boolean).join(' · ')) + ')' : ''
  } × ${i.cantidad} — ${precio(i.subtotal)}</li>`).join('');

  return `<article class="g-tarjeta u-tarjeta-pedido">
    <div class="u-pedido-alto">
      <span class="u-numero">#${esc(p.numero)}</span>
      <span class="u-fecha">${esc(formatoFecha(p.fecha))}</span>
      ${pildoraEstado(p.estado)}
      <span class="u-total">${precio(p.total)}</span>
    </div>
    <div class="u-pedido-bajo" style="display:block">
      <ul class="u-detalle" style="margin:0;padding-left:18px">${items}</ul>
      <p class="g-nota" style="margin:10px 0 0">${esc(envio)}${
        p.descuento ? ' · descuento ' + precio(p.descuento) : ''}${
        p.pago?.metodo ? ' · ' + esc(p.pago.metodo) : ''}</p>
    </div>
  </article>`;
}

async function iniciar() {
  montarNav('cuenta');
  montarChrome({});
  montarPie();

  const sesion = await esperarSesion();
  if (!sesion.usuario) {
    location.replace('login.html?volver=mis-pedidos.html');
    return;
  }

  $('#cabecera').innerHTML = `<div class="u-identidad">
    <div><h1>Mis pedidos</h1><p>Tu historial de compras</p></div>
  </div>`;

  let pedidos = [];
  try {
    pedidos = await pedidosDe(sesion.usuario.uid);
  } catch (e) {
    console.warn('No se pudieron leer los pedidos:', e);
    $('#contenido').innerHTML = '<p class="g-nota" style="padding-top:20px">No pudimos cargar tus pedidos. Probá de nuevo en un momento.</p>';
    return;
  }

  $('#contenido').innerHTML = pedidos.length
    ? `<h1 class="u-titulo-panel d-solo" style="margin-top:24px">Mis pedidos</h1>
       <p class="g-nota d-solo" style="margin:0 0 16px">${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}</p>
       <div class="u-pedidos" style="margin-top:16px">${pedidos.map(tarjeta).join('')}</div>`
    : `<div class="u-vacio">
         <i class="bi bi-bag"></i>
         <p class="g-nota">Todavía no hiciste ningún pedido.</p>
         <a class="g-btn g-btn-primario" href="index.html" style="width:auto;padding:0 28px">Ver productos</a>
       </div>`;
}

iniciar();
