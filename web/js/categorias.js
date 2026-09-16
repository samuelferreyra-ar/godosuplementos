// Listado de las 12 categorías. Resuelve el acceso al catálogo completo, que
// en el sitio viejo solo existía como desplegable de escritorio.
import { obtenerCatalogo } from './catalogo.js';
import { esc, nombreCategoria } from './tienda.js';
import { montarNav, montarBuscador } from './nav.js';
import { montarChrome, montarPie } from './chrome.js';
import { tarjetaProducto, conectarTarjetas, ESTILOS_TARJETA } from './tarjeta.js';
import { buscar } from './catalogo.js';

const $ = (s) => document.querySelector(s);

// El orden es el del handoff: primero las que más salen.
const CATEGORIAS = [
  { id: 'proteinas', icono: 'cup-straw' },
  { id: 'creatinas', icono: 'lightning-charge' },
  { id: 'combos', icono: 'box2-heart' },
  { id: 'pre-entrenos', icono: 'fire' },
  { id: 'ganadores', icono: 'graph-up-arrow' },
  { id: 'aminoacidos', icono: 'diagram-3' },
  { id: 'magnesio', icono: 'droplet' },
  { id: 'colageno', icono: 'hexagon' },
  { id: 'omega', icono: 'capsule' },
  { id: 'vitaminas', icono: 'prescription2' },
  { id: 'quemadores', icono: 'activity' },
  { id: 'otros', icono: 'three-dots' }
];

let catalogo = [];

document.head.insertAdjacentHTML('beforeend', '<style>' + ESTILOS_TARJETA + '</style>');

function render() {
  const filas = CATEGORIAS.map((c, i) => {
    const cuantos = catalogo.filter((p) => p.categoria === c.id).length;
    return `<a class="c-fila" href="${c.id}.html">
      <span class="c-icono"><i class="bi bi-${c.icono}"></i></span>
      <span class="c-nombre">${esc(nombreCategoria(c.id))}</span>
      ${i < 3 ? '<span class="g-pildora g-pildora-aviso">Popular</span>' : ''}
      <span class="c-cuenta">${cuantos}</span>
      <i class="bi bi-chevron-right c-chevron"></i>
    </a>`;
  }).join('');

  $('#contenido').innerHTML = `
    <span class="g-etiqueta" style="display:block;margin:18px 0 9px">Las que más salen</span>
    <div class="c-lista">${filas}</div>
    <nav class="c-info">
      <a href="envios.html"><i class="bi bi-truck"></i><span>Envíos</span></a>
      <a href="pagos.html"><i class="bi bi-credit-card"></i><span>Pagos</span></a>
      <a href="ubicacion.html"><i class="bi bi-geo-alt"></i><span>Ubicación</span></a>
    </nav>`;
}

async function mostrarBusqueda(texto) {
  if (!texto) return render();
  const encontrados = await buscar(texto);
  $('#contenido').innerHTML = `
    <h2 class="g-titulo-seccion" style="margin:18px 0 12px">${encontrados.length} resultado${encontrados.length === 1 ? '' : 's'}</h2>
    ${encontrados.length
      ? `<div class="c-resultados">${encontrados.map(tarjetaProducto).join('')}</div>`
      : `<p class="g-nota">No encontramos nada con “${esc(texto)}”. Probá con la marca o el sabor.</p>`}`;
  conectarTarjetas($('#contenido'), catalogo);
}

async function iniciar() {
  montarNav('categorias');
  montarChrome({ alBuscar: mostrarBusqueda }); montarPie();
  montarBuscador($('#zona-buscador'), mostrarBusqueda);
  catalogo = await obtenerCatalogo();
  render();
}

iniciar();
