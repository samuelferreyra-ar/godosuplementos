// Armazón del panel: control de acceso, navegación y avisos.
//
// El acceso lo decide Firestore, no esta pantalla: aunque alguien entrara,
// las reglas rechazan cualquier escritura que no venga de un admin. Esto solo
// evita mostrarle un panel que no va a funcionarle.
import { esperarSesion } from './sesion.js';
import { esc } from './tienda.js';

const SECCIONES = [
  { id: 'resumen', href: 'admin.html', icono: 'grid-1x2', texto: 'Resumen' },
  { id: 'productos', href: 'admin-productos.html', icono: 'box-seam', texto: 'Productos' },
  { id: 'pedidos', href: 'admin-pedidos.html', icono: 'bag-check', texto: 'Pedidos' },
  { id: 'cupones', href: 'admin-cupones.html', icono: 'ticket-perforated', texto: 'Cupones' }
];

/**
 * Exige sesión de administrador. Devuelve { usuario, datos } o redirige.
 */
export async function exigirAdmin() {
  const sesion = await esperarSesion();
  if (!sesion.usuario) {
    location.replace('login.html?volver=' + encodeURIComponent(location.pathname.replace(/^\//, '')));
    return null;
  }
  if (sesion.datos?.admin !== true) {
    document.body.innerHTML = `<div style="max-width:420px;margin:80px auto;padding:0 16px;text-align:center">
      <i class="bi bi-shield-lock" style="font-size:38px;color:var(--godo-disabled)"></i>
      <h1 class="g-titulo-seccion" style="margin:16px 0 8px">Panel restringido</h1>
      <p class="g-nota" style="margin-bottom:20px">Esta sección es solo para administradores.</p>
      <a class="g-btn g-btn-primario" href="index.html" style="width:auto;padding:0 28px">Ir a la tienda</a>
    </div>`;
    return null;
  }
  return sesion;
}

/** Sidebar de escritorio y menú de solapas del teléfono. */
export function montarPanel(activa, { pedidosPendientes = 0 } = {}) {
  document.body.classList.add('panel');

  const enlaces = (clase) => SECCIONES.map((s) => `
    <a href="${s.href}" class="${s.id === activa ? 'es-activo' : ''}">
      ${clase === 'sidebar' ? `<i class="bi bi-${s.icono}"></i>` : ''}
      <span>${s.texto}</span>
      ${s.id === 'pedidos' && pedidosPendientes
        ? `<span class="n-sidebar-badge">${pedidosPendientes}</span>` : ''}
    </a>`).join('');

  const sidebar = document.createElement('nav');
  sidebar.className = 'n-sidebar';
  sidebar.innerHTML = `
    <a href="index.html" style="padding:0"><img src="assets/Logo-Godo.webp" alt="GODO Suplementos"></a>
    ${enlaces('sidebar')}
    <div class="n-reponer" id="reponer"></div>`;

  const cabecera = document.createElement('header');
  cabecera.className = 'n-cabecera-movil';
  cabecera.innerHTML = `
    <img src="assets/Logo-Godo.webp" alt="GODO Suplementos">
    <span>Panel</span>
    <a href="index.html" aria-label="Ir a la tienda"><i class="bi bi-shop"></i></a>`;

  const menu = document.createElement('nav');
  menu.className = 'n-menu-movil';
  menu.innerHTML = enlaces('movil');

  document.body.insertBefore(menu, document.body.firstChild);
  document.body.insertBefore(cabecera, document.body.firstChild);
  document.body.insertBefore(sidebar, document.body.firstChild);
}

/** Badge de pedidos sin preparar en el sidebar y en el menú del teléfono. */
export function actualizarPendientes(cuantos) {
  document.querySelectorAll('.n-sidebar a, .n-menu-movil a').forEach((a) => {
    if (!a.getAttribute('href')?.startsWith('admin-pedidos')) return;
    a.querySelector('.n-sidebar-badge')?.remove();
    if (!cuantos) return;
    const badge = document.createElement('span');
    badge.className = 'n-sidebar-badge';
    badge.textContent = cuantos;
    a.appendChild(badge);
  });
}

/** Contador de reposición del pie del sidebar. Es un atajo a "Stock bajo". */
export function pintarReponer(variantes) {
  const caja = document.querySelector('#reponer');
  if (!caja) return;
  caja.innerHTML = `
    <span>Para reponer</span>
    <b>${variantes} ${variantes === 1 ? 'sabor' : 'sabores'}</b>
    <small>${variantes ? 'Tocá "Stock bajo" para verlos' : 'Todo con stock suficiente'}</small>`;
}

/** Aviso efímero al pie, con acción opcional para deshacer. */
export function avisar(texto, { accion = null, etiqueta = 'Deshacer', segundos = 6, icono = 'archive' } = {}) {
  document.querySelector('.n-deshacer')?.remove();

  const barra = document.createElement('div');
  barra.className = 'n-deshacer';
  barra.innerHTML = `<i class="bi bi-${icono}"></i><span>${esc(texto)}</span>`;
  if (accion) {
    const boton = document.createElement('button');
    boton.textContent = etiqueta;
    boton.onclick = async () => { barra.remove(); await accion(); };
    barra.appendChild(boton);
  }
  document.body.appendChild(barra);
  setTimeout(() => barra.remove(), segundos * 1000);
  return barra;
}

/** "Guardado hace N s" al lado del control que se acaba de tocar. */
export function marcarGuardado(elemento) {
  if (!elemento) return;
  elemento.innerHTML = '<i class="bi bi-check-circle-fill"></i> Guardado';
  elemento.className = 'n-guardado';
  const desde = Date.now();
  const reloj = setInterval(() => {
    const s = Math.round((Date.now() - desde) / 1000);
    if (s > 30) { clearInterval(reloj); elemento.innerHTML = ''; return; }
    elemento.innerHTML = '<i class="bi bi-check-circle-fill"></i> Guardado hace ' + s + ' s';
  }, 1000);
}
