// Barra inferior de navegación, compartida por las pantallas de catálogo.
//
// Regla del diseño: donde hay barra inferior no hay icono de carrito arriba.
// El encabezado usa ese espacio para el buscador.
import { contarUnidades, alCambiar } from './carrito.js';

const ENTRADAS = [
  { id: 'inicio', href: 'index.html', icono: 'house-door', texto: 'Inicio' },
  { id: 'categorias', href: 'categorias.html', icono: 'grid', texto: 'Categorías' },
  { id: 'carrito', href: 'carrito.html', icono: 'bag', texto: 'Carrito' },
  { id: 'cuenta', href: 'mi-cuenta.html', icono: 'person', texto: 'Cuenta' }
];

export function montarNav(activa) {
  const nav = document.createElement('nav');
  nav.className = 'g-nav-inferior';
  nav.innerHTML = ENTRADAS.map((e) => {
    const esActiva = e.id === activa;
    return `<a href="${e.href}" class="${esActiva ? 'es-activo' : ''}">
      <span style="position:relative">
        <i class="bi bi-${e.icono}${esActiva ? '-fill' : ''}"></i>
        ${e.id === 'carrito' ? '<span class="g-badge-carrito g-oculto" data-badge>0</span>' : ''}
      </span>
      ${e.texto}
    </a>`;
  }).join('');
  document.body.appendChild(nav);

  alCambiar(() => {
    const badge = nav.querySelector('[data-badge]');
    if (!badge) return;
    const n = contarUnidades();
    badge.textContent = n;
    badge.classList.toggle('g-oculto', n === 0);
  });

  return nav;
}

/** Hace latir el badge cuando se agrega algo, para que el cambio se note. */
export function latirCarrito() {
  const badge = document.querySelector('.g-nav-inferior [data-badge]');
  if (!badge) return;
  badge.classList.add('late');
  setTimeout(() => badge.classList.remove('late'), 220);
}

/** Buscador de la barra navy. Filtra al escribir y navega al resultado. */
export function montarBuscador(contenedor, alBuscar) {
  contenedor.innerHTML = `
    <div style="position:relative;flex:1">
      <i class="bi bi-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--sobre-navy-3)"></i>
      <input id="buscador" type="search" placeholder="Buscar producto o sabor" autocomplete="off"
        style="width:100%;padding:10px 12px 10px 32px;border:0;border-radius:12px;
               background:var(--sobre-navy-fondo);color:var(--godo-paper);font:inherit;font-size:13.5px">
    </div>`;

  const input = contenedor.querySelector('#buscador');
  let reloj = null;
  input.addEventListener('input', () => {
    clearTimeout(reloj);
    reloj = setTimeout(() => alBuscar(input.value.trim()), 220);
  });
  return input;
}
