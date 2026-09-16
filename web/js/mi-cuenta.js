// Mi cuenta.
//
// En el teléfono es una lista de accesos; en escritorio, el diseño junta la
// cuenta y el historial en una sola pantalla: menú a la izquierda, pedidos a
// la derecha.
import { esperarSesion, onUsuario, cerrarSesion } from './sesion.js';
import { obtenerConfig, precio, esc } from './tienda.js';
import { montarNav } from './nav.js';
import { montarChrome, montarPie } from './chrome.js';
import { pedidosDe, enCurso, pildoraEstado, formatoFecha } from './pedidos.js';

const $ = (s) => document.querySelector(s);

let usuario = null;
let datos = null;
let pedidos = [];
let config = null;

const iniciales = (nombre, email) => {
  const base = (nombre ?? '').trim() || (email ?? '').trim();
  const partes = base.split(/[\s@.]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || 'G';
};

// --- Piezas --------------------------------------------------------------

function tarjetaPedidoEnCurso() {
  const p = enCurso(pedidos);
  if (!p) return '';
  return `<a class="g-tarjeta u-pedido" href="mis-pedidos.html">
    <span class="u-pozo"><i class="bi bi-truck"></i></span>
    <span>
      <b>Pedido #${esc(p.numero)}</b>
      <small>${esc(formatoFecha(p.fecha))} · ${precio(p.total)}</small>
    </span>
    ${pildoraEstado(p.estado)}
    <i class="bi bi-chevron-right"></i>
  </a>`;
}

function tarjetaPanel() {
  if (datos?.admin !== true) return '';
  return `<section class="u-panel">
    <div class="u-panel-fila">
      <span class="u-panel-pozo"><i class="bi bi-speedometer2"></i></span>
      <div>
        <h2>Panel de administración</h2>
        <p>Stock por sabor, pedidos y productos</p>
      </div>
    </div>
    <div class="u-panel-atajos">
      <a class="g-btn g-btn-primario" href="admin-productos.html">Entrada de stock</a>
      <a class="g-btn g-btn-borde" href="admin-pedidos.html">Pedidos</a>
    </div>
  </section>`;
}

const ACCESOS = [
  { href: 'mis-pedidos.html', icono: 'bag-check', texto: 'Mis pedidos', nota: () => (pedidos.length ? pedidos.length : '') },
  { href: 'mis-direcciones.html', icono: 'geo-alt', texto: 'Mis direcciones', nota: () => (datos?.direcciones?.length ?? 0) || '' },
  { href: 'mi-cuenta.html', icono: 'person-gear', texto: 'Datos personales', nota: () => '' },
  { href: null, icono: 'whatsapp', texto: 'Ayuda por WhatsApp', nota: () => '' }
];

function menu(activo = null) {
  return ACCESOS.map((a) => {
    const nota = a.nota();
    const contenido = `<i class="bi bi-${a.icono}"></i><span>${esc(a.texto)}</span>
      ${nota ? `<em>${esc(String(nota))}</em>` : ''}<i class="bi bi-chevron-right" style="color:var(--godo-disabled);font-size:13px"></i>`;
    const clase = 'u-item' + (a.href === activo ? ' es-activo' : '');
    return a.href
      ? `<a class="${clase}" href="${a.href}">${contenido}</a>`
      : `<button class="${clase}" id="ayuda-whatsapp">${contenido}</button>`;
  }).join('');
}

function panelPedidos() {
  if (!pedidos.length) {
    return `<div class="u-vacio">
      <i class="bi bi-bag"></i>
      <p class="g-nota">Todavía no hiciste ningún pedido.</p>
      <a class="g-btn g-btn-primario" href="index.html" style="width:auto;padding:0 28px">Ver productos</a>
    </div>`;
  }

  return `<div class="u-pedidos">${pedidos.map((p) => `
    <article class="g-tarjeta u-tarjeta-pedido">
      <div class="u-pedido-alto">
        <span class="u-numero">#${esc(p.numero)}</span>
        <span class="u-fecha">${esc(formatoFecha(p.fecha))}</span>
        ${pildoraEstado(p.estado)}
        <span class="u-total">${precio(p.total)}</span>
      </div>
      <div class="u-pedido-bajo">
        <span class="u-detalle">${p.items.length} producto${p.items.length === 1 ? '' : 's'} · ${
          esc(p.items.map((i) => i.nombre).slice(0, 2).join(', '))}${p.items.length > 2 ? '…' : ''}</span>
      </div>
    </article>`).join('')}</div>`;
}

// --- Render --------------------------------------------------------------

function render() {
  const nombre = datos?.nombre ?? usuario.displayName ?? usuario.email;
  const esDueno = datos?.admin === true;

  $('#cabecera').innerHTML = `
    <div class="u-identidad">
      <span class="u-avatar">${esc(iniciales(nombre, usuario.email))}</span>
      <div>
        <h1>${esc(nombre)}${esDueno ? '<span class="u-badge">Dueño</span>' : ''}</h1>
        <p>${esc(usuario.email ?? '')}</p>
      </div>
    </div>`;

  $('#contenido').innerHTML = `
    <div class="m-solo">
      ${tarjetaPedidoEnCurso()}
      ${tarjetaPanel()}
      ${esDueno ? '<span class="g-etiqueta u-etiqueta">Como cliente</span>' : '<span class="g-etiqueta u-etiqueta">Tu cuenta</span>'}
      <div class="u-menu">${menu()}</div>
      <button class="g-btn g-btn-borde u-salir" id="salir">Cerrar sesión</button>
    </div>

    <div class="d-solo">
      <div class="u-layout">
        <aside>
          <div class="g-tarjeta u-identidad-tarjeta">
            <span class="u-avatar">${esc(iniciales(nombre, usuario.email))}</span>
            <div>
              <b>${esc(nombre)}</b>
              <small>${esc(usuario.email ?? '')}</small>
            </div>
          </div>
          <div class="u-menu">${menu('mis-pedidos.html')}</div>
          ${tarjetaPanel()}
          <button class="g-btn g-btn-borde u-salir" id="salir-escritorio">Cerrar sesión</button>
        </aside>
        <div>
          <h1 class="u-titulo-panel">Mis pedidos</h1>
          <p class="g-nota" style="margin:0 0 16px">${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}</p>
          ${panelPedidos()}
        </div>
      </div>
    </div>`;

  document.querySelectorAll('#salir, #salir-escritorio').forEach((b) => {
    b.onclick = async () => { await cerrarSesion(); location.href = 'index.html'; };
  });
  document.querySelectorAll('#ayuda-whatsapp').forEach((b) => {
    b.onclick = () => window.open('https://wa.me/' + String(config?.whatsapp ?? '').replace(/\D/g, ''), '_blank', 'noopener');
  });
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  montarNav('cuenta');
  montarChrome({});
  montarPie();

  const sesion = await esperarSesion();
  if (!sesion.usuario) {
    location.replace('login.html?volver=mi-cuenta.html');
    return;
  }
  usuario = sesion.usuario;
  datos = sesion.datos;

  config = await obtenerConfig();
  render();

  // Los pedidos llegan después: la cuenta no espera por ellos.
  try {
    pedidos = await pedidosDe(usuario.uid);
    render();
  } catch (e) {
    console.warn('No se pudieron leer los pedidos:', e);
  }

  onUsuario((u) => { if (!u) location.replace('index.html'); });
}

iniciar();
