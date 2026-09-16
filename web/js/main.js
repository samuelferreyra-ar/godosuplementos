// Home.
import { obtenerCatalogo, hayStock, fotoDe, buscar } from './catalogo.js';
import { obtenerConfig, faltaParaEnvioGratis, precio, esc, nombreCategoria } from './tienda.js';
import { subtotalCarrito, alCambiar, agregar } from './carrito.js';
import { montarNav, montarBuscador, latirCarrito } from './nav.js';
import { tarjetaProducto, conectarTarjetas, varianteVitrina, marcarAgregado, ESTILOS_TARJETA } from './tarjeta.js';
import { montarChrome, montarPie, franjaConfianza } from './chrome.js';

const $ = (s) => document.querySelector(s);

// Las cuatro de acceso rápido, no el catálogo entero: para eso está Categorías.
const ATAJOS = ['proteinas', 'creatinas', 'combos', 'pre-entrenos'];

let catalogo = [];
let config = null;

document.head.insertAdjacentHTML('beforeend', '<style>' + ESTILOS_TARJETA + '</style>');

// --- Barra de envío gratis (vive en la barra navy) ----------------------

function pintarEnvio() {
  const zona = $('#zona-envio');
  const umbral = config?.umbralEnvioGratis;
  const subtotal = subtotalCarrito();

  // Sin nada en el carrito no tiene sentido apurar a nadie.
  if (typeof umbral !== 'number' || umbral <= 0 || subtotal === 0) { zona.innerHTML = ''; return; }

  const falta = faltaParaEnvioGratis(subtotal, config);
  const porcentaje = Math.min(100, Math.round((subtotal / umbral) * 100));

  zona.innerHTML = `<div class="h-envio">
    <div class="h-envio-texto">
      <i class="bi bi-truck"></i>
      ${falta == null
        ? '<span>Tu envío ya va <b>sin cargo</b></span>'
        : `<span>Sumá <b>${precio(falta)}</b> y el envío es gratis</span>`}
    </div>
    <div class="h-pista"><span style="width:${porcentaje}%"></span></div>
  </div>`;
}

// --- Secciones -----------------------------------------------------------

function seccionCategorias() {
  const tarjetas = ATAJOS.map((cat) => {
    const productos = catalogo.filter((p) => p.categoria === cat);
    if (!productos.length) return '';
    const foto = fotoDe(productos[0]);
    return `<a class="g-tarjeta h-cat" href="${cat}.html">
      <span class="g-foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      <span><b>${esc(nombreCategoria(cat))}</b><small>${productos.length} producto${productos.length === 1 ? '' : 's'}</small></span>
    </a>`;
  }).filter(Boolean).join('');

  if (!tarjetas) return '';
  return `<section class="h-seccion">
    <div class="h-titulo-fila">
      <h2 class="g-titulo-seccion">Comprá por categoría</h2>
      <a class="h-ver-todas" href="categorias.html">Ver las 12</a>
    </div>
    <div class="h-categorias">${tarjetas}</div>
  </section>`;
}

function seccionDestacados() {
  // Sin datos de ventas todavía: se muestran los que el dueño marca como
  // destacados desde el panel. Mientras no marque ninguno, caen los primeros
  // del catálogo. La sección NO dice "más vendidos": no tenemos con qué
  // sostenerlo, y no vamos a inventar una recomendación.
  const marcados = catalogo.filter((p) => p.destacado);
  const lista = (marcados.length ? marcados : catalogo).slice(0, 4);
  if (!lista.length) return '';

  const filas = lista.map((p) => {
    const v = varianteVitrina(p);
    const foto = fotoDe(p);
    const unaSola = p.variantes.filter(hayStock).length === 1;
    return `<article class="g-tarjeta h-fila">
      <a href="producto.html?id=${encodeURIComponent(p.id)}" class="g-foto">
        ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      </a>
      <div class="h-fila-cuerpo">
        <a href="producto.html?id=${encodeURIComponent(p.id)}"><b>${esc(p.nombre)}</b></a>
        <small>${esc(p.marca)}</small>
        <span class="h-fila-precio">${p.precioMin !== p.precioMax ? 'desde ' : ''}${precio(p.precioMin)}</span>
      </div>
      ${unaSola
        ? `<button class="t-agregar" data-agregar="${esc(p.id)}">Agregar</button>`
        : `<a class="t-agregar" href="producto.html?id=${encodeURIComponent(p.id)}">Elegir</a>`}
    </article>`;
  }).join('');

  return `<section class="h-seccion">
    <div class="h-titulo-fila"><h2 class="g-titulo-seccion">Destacados</h2></div>
    <div class="h-destacados m-solo">${filas}</div>
    <div class="h-destacados-escritorio d-solo">${lista.map(tarjetaProducto).join('')}</div>
  </section>`;
}

function seccionCombo() {
  const combo = catalogo.find((p) => p.categoria === 'combos');
  if (!combo) return '';
  const foto = fotoDe(combo);
  // El nombre dice "chico" o "grande", que no le dice nada a nadie. Lo que
  // sirve es qué trae y en qué tamaño, y eso está en la descripción.
  const contenido = (combo.descripcion ?? '')
    .replace(/^combo des*/i, '')
    .trim();

  // "Chico" y "grande" no le dicen nada a nadie; lo que decide la compra es
  // qué trae y en qué tamaño. Si el producto no tiene descripción cargada, se
  // cae al nombre, que es lo único que hay.
  const titulo = contenido
    ? contenido.charAt(0).toUpperCase() + contenido.slice(1)
    : combo.nombre;

  return `<section class="h-combo">
    <div class="h-combo-foto g-foto">
      ${foto ? `<img src="${esc(foto)}" alt="${esc(combo.nombre)}" loading="lazy" onerror="this.remove()">` : ''}
    </div>
    <div class="h-combo-texto">
      <span class="g-etiqueta">Combo del mes</span>
      <h3>${esc(titulo)}</h3>
      <div class="h-combo-precio">${precio(combo.precioMin)}</div>
    </div>
    <a class="g-btn g-btn-acento h-combo-btn" href="producto.html?id=${encodeURIComponent(combo.id)}">Ver el combo</a>
  </section>`;
}

const SECCION_INFO = `<nav class="h-info m-solo">
  <a href="envios.html"><i class="bi bi-truck"></i><span>Envíos</span></a>
  <a href="pagos.html"><i class="bi bi-credit-card"></i><span>Pagos</span></a>
  <a href="ubicacion.html"><i class="bi bi-geo-alt"></i><span>Ubicación</span></a>
</nav>`;

function render() {
  $('#contenido').innerHTML =
    seccionCategorias() + seccionDestacados() + seccionCombo() + franjaConfianza() + SECCION_INFO;
  conectarTarjetas($('#contenido'), catalogo);
  document.querySelectorAll('.h-fila [data-agregar]').forEach((b) => {
    b.onclick = () => {
      const p = catalogo.find((x) => x.id === b.dataset.agregar);
      const v = p?.variantes.find(hayStock);
      if (!p || !v) return;
      agregar(p, v, 1);
      latirCarrito();
      marcarAgregado(b);
    };
  });
}

// --- Búsqueda ------------------------------------------------------------

async function mostrarBusqueda(texto) {
  if (!texto) return render();
  const encontrados = await buscar(texto);

  $('#contenido').innerHTML = `<section class="h-seccion">
    <div class="h-titulo-fila">
      <h2 class="g-titulo-seccion">${encontrados.length} resultado${encontrados.length === 1 ? '' : 's'}</h2>
    </div>
    ${encontrados.length
      ? `<div class="h-resultados">${encontrados.map(tarjetaProducto).join('')}</div>`
      : `<p class="g-nota">No encontramos nada con “${esc(texto)}”. Probá con la marca o el sabor.</p>`}
  </section>`;
  conectarTarjetas($('#contenido'), catalogo);
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  montarNav('inicio');
  montarBuscador($('#zona-buscador'), mostrarBusqueda);
  montarChrome({ alBuscar: mostrarBusqueda });
  montarPie();

  [catalogo, config] = await Promise.all([obtenerCatalogo(), obtenerConfig()]);
  render();
  alCambiar(pintarEnvio);
}

iniciar();
