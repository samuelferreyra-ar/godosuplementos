// Navegación de escritorio: las dos filas fijas de arriba y el pie.
//
// En escritorio no hay barra inferior. Estas dos filas reemplazan tanto la
// pantalla "Categorías" del móvil como el desplegable del sitio viejo.
//
// Se inyectan siempre y el CSS decide: bajo 1024 px quedan ocultas y manda la
// barra inferior. Así cada página no tiene que repetir el mismo encabezado.
import { contarUnidades, alCambiar } from './carrito.js';
import { esc, nombreCategoria } from './tienda.js';
import { onUsuario } from './sesion.js';

const CATEGORIAS = [
  'proteinas', 'creatinas', 'combos', 'pre-entrenos', 'ganadores', 'aminoacidos',
  'magnesio', 'colageno', 'omega', 'vitaminas', 'quemadores', 'otros'
];

const CONFIANZA = [
  { icono: 'truck', titulo: 'Envío sin cargo', nota: 'Superando el mínimo, en cualquier zona' },
  { icono: 'shop', titulo: 'Retiro en el local', nota: 'Sin costo, coordinado por WhatsApp' },
  { icono: 'box-seam', titulo: 'Stock por sabor', nota: 'Lo que ves disponible, está' },
  { icono: 'whatsapp', titulo: 'Te respondemos', nota: 'Consultas y seguimiento por chat' }
];

export function franjaConfianza() {
  return `<section class="d-confianza d-solo">
    ${CONFIANZA.map((c) => `<article>
      <i class="bi bi-${c.icono}"></i>
      <b>${c.titulo}</b>
      <span>${c.nota}</span>
    </article>`).join('')}
  </section>`;
}

/**
 * @param {object} opciones
 * @param {string} [opciones.categoria] categoría activa en la cinta
 * @param {(texto:string)=>void} [opciones.alBuscar] si la página sabe buscar
 */
export function montarChrome({ categoria = null, alBuscar = null } = {}) {
  const chrome = document.createElement('div');
  chrome.className = 'd-solo';
  chrome.innerHTML = `
    <div class="d-navy">
      <div class="d-navy-fila">
        <a href="index.html"><img src="assets/Logo-Godo.webp" alt="GODO Suplementos"></a>
        <div class="d-buscador">
          <i class="bi bi-search"></i>
          <input type="search" id="buscador-escritorio" placeholder="Buscar producto o sabor" autocomplete="off">
        </div>
        <div class="d-acciones">
          <a class="d-cuenta" href="login.html" id="chrome-cuenta">
            <i class="bi bi-person"></i><span>Iniciar sesión</span>
          </a>
          <a class="d-carrito" href="carrito.html">
            <i class="bi bi-bag"></i><span>Carrito</span>
            <span class="d-carrito-badge" data-badge-escritorio>0</span>
          </a>
        </div>
      </div>
    </div>
    <nav class="d-cinta">
      <div class="d-cinta-fila">
        ${CATEGORIAS.map((c) => `<a href="${c}.html" class="${c === categoria ? 'es-activa' : ''}">${esc(nombreCategoria(c))}</a>`).join('')}
      </div>
    </nav>`;
  document.body.classList.add('tiene-chrome');
  document.body.insertBefore(chrome, document.body.firstChild);

  alCambiar(() => {
    const badge = chrome.querySelector('[data-badge-escritorio]');
    const n = contarUnidades();
    badge.textContent = n;
    badge.style.visibility = n ? 'visible' : 'hidden';
  });

  // Con sesión, el botón muestra el nombre y lleva a la cuenta.
  onUsuario((usuario, datos) => {
    const boton = chrome.querySelector('#chrome-cuenta');
    if (!boton) return;
    if (usuario) {
      const nombre = (datos?.nombre ?? usuario.email ?? '').split(' ')[0];
      boton.href = 'mi-cuenta.html';
      boton.querySelector('span').textContent = nombre || 'Mi cuenta';
    } else {
      boton.href = 'login.html';
      boton.querySelector('span').textContent = 'Iniciar sesión';
    }
  });

  const input = chrome.querySelector('#buscador-escritorio');
  if (alBuscar) {
    let reloj = null;
    input.addEventListener('input', () => {
      clearTimeout(reloj);
      reloj = setTimeout(() => alBuscar(input.value.trim()), 220);
    });
  } else {
    // En una página que no busca, el buscador manda a la home con la consulta.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        location.href = 'index.html?q=' + encodeURIComponent(input.value.trim());
      }
    });
  }

  return chrome;
}

export function montarPie() {
  const pie = document.createElement('footer');
  pie.className = 'd-footer d-solo';
  pie.innerHTML = `
    <div class="d-footer-grilla">
      <div>
        <img src="assets/Logo-Godo.webp" alt="GODO Suplementos">
        <p>Suplementos deportivos en San Fernando del Valle de Catamarca. Envío a domicilio y retiro en el local.</p>
      </div>
      <div>
        <h3>Tienda</h3>
        <ul>
          <li><a href="proteinas.html">Proteínas</a></li>
          <li><a href="creatinas.html">Creatinas</a></li>
          <li><a href="combos.html">Combos</a></li>
          <li><a href="categorias.html">Ver todas</a></li>
        </ul>
      </div>
      <div>
        <h3>Ayuda</h3>
        <ul>
          <li><a href="envios.html">Envíos</a></li>
          <li><a href="pagos.html">Pagos</a></li>
          <li><a href="ubicacion.html">Ubicación y horarios</a></li>
        </ul>
      </div>
      <div>
        <h3>Cuenta</h3>
        <ul>
          <li><a href="mi-cuenta.html">Mi cuenta</a></li>
          <li><a href="mis-pedidos.html">Mis pedidos</a></li>
          <li><a href="carrito.html">Mi carrito</a></li>
        </ul>
      </div>
    </div>
    <div class="d-footer-legal">GODO Suplementos · Dr. Agustín Correa y Soria 15, Catamarca</div>`;
  document.body.appendChild(pie);
  return pie;
}
