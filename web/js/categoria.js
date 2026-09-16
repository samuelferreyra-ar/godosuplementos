// Página de categoría: contador, filtros y orden sobre la grilla de productos.
//
// La categoría la declara el HTML en <body data-categoria="...">, así que las
// doce páginas comparten este archivo y solo cambian esa palabra.
import { obtenerPorCategoria, hayStock } from './catalogo.js';
import { esc, nombreCategoria } from './tienda.js';
import { montarNav } from './nav.js';
import { montarChrome, montarPie } from './chrome.js';
import { contarUnidades, alCambiar } from './carrito.js';
import { tarjetaProducto, conectarTarjetas, ESTILOS_TARJETA } from './tarjeta.js';

const $ = (s) => document.querySelector(s);
const CATEGORIA = document.body.dataset.categoria;

const ORDENES = [
  { id: 'relevancia', texto: 'Destacados' },
  { id: 'menor', texto: 'Menor precio' },
  { id: 'mayor', texto: 'Mayor precio' },
  { id: 'nombre', texto: 'Nombre' }
];

let productos = [];
const filtros = { marcas: new Set(), sabores: new Set(), tamanos: new Set() };
let orden = 'relevancia';

document.head.insertAdjacentHTML('beforeend', '<style>' + ESTILOS_TARJETA + '</style>');

// --- Filtrado ------------------------------------------------------------

const valoresDe = (campo) => {
  const set = new Set();
  productos.forEach((p) => {
    if (campo === 'marcas') { if (p.marca) set.add(p.marca); return; }
    p.variantes.filter(hayStock).forEach((v) => {
      const valor = campo === 'sabores' ? v.sabor : v.tamano;
      if (valor && valor !== 'Único') set.add(valor);
    });
  });
  return [...set].sort((a, b) => a.localeCompare(b));
};

function filtrados() {
  let lista = productos.filter((p) => {
    if (filtros.marcas.size && !filtros.marcas.has(p.marca)) return false;
    if (filtros.sabores.size && !p.variantes.some((v) => hayStock(v) && filtros.sabores.has(v.sabor))) return false;
    if (filtros.tamanos.size && !p.variantes.some((v) => hayStock(v) && filtros.tamanos.has(v.tamano))) return false;
    return true;
  });

  if (orden === 'menor') lista = [...lista].sort((a, b) => a.precioMin - b.precioMin);
  else if (orden === 'mayor') lista = [...lista].sort((a, b) => b.precioMax - a.precioMax);
  else if (orden === 'nombre') lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
  else lista = [...lista].sort((a, b) => Number(b.destacado ?? false) - Number(a.destacado ?? false));

  return lista;
}

const totalFiltros = () => filtros.marcas.size + filtros.sabores.size + filtros.tamanos.size;

// --- Render --------------------------------------------------------------

function filaFiltros() {
  const aplicados = [
    ...[...filtros.marcas].map((v) => ({ campo: 'marcas', v })),
    ...[...filtros.sabores].map((v) => ({ campo: 'sabores', v })),
    ...[...filtros.tamanos].map((v) => ({ campo: 'tamanos', v }))
  ].map(({ campo, v }) => `<button class="f-chip f-aplicado" data-quitar="${campo}" data-valor="${esc(v)}">
      ${esc(v)} <i class="bi bi-x"></i>
    </button>`).join('');

  // Solo se ofrecen los que todavía no están puestos, para no repetir chips.
  const disponibles = ['marcas', 'sabores', 'tamanos'].flatMap((campo) =>
    valoresDe(campo).filter((v) => !filtros[campo].has(v))
      .map((v) => `<button class="f-chip f-libre" data-poner="${campo}" data-valor="${esc(v)}">${esc(v)}</button>`)
  ).join('');

  return `<div class="f-fila">
    ${totalFiltros() ? `<span class="f-chip f-contador"><i class="bi bi-sliders"></i> Filtros ${totalFiltros()}</span>` : ''}
    ${aplicados}${disponibles}
  </div>`;
}


/** Cuántos productos quedarían si además se marcara este valor. */
function cuentaDe(campo, valor) {
  return productos.filter((p) => campo === 'marcas'
    ? p.marca === valor
    : p.variantes.some((v) => hayStock(v) && (campo === 'sabores' ? v.sabor : v.tamano) === valor)).length;
}

const GRUPOS = [
  { campo: 'marcas', titulo: 'Marca' },
  { campo: 'sabores', titulo: 'Sabor' },
  { campo: 'tamanos', titulo: 'Tamaño' }
];

function panelFiltros() {
  const grupos = GRUPOS.map(({ campo, titulo }) => {
    const valores = valoresDe(campo);
    if (!valores.length) return '';
    return `<div class="f-grupo">
      <h3>${titulo}</h3>
      ${valores.map((v) => {
        const marcada = filtros[campo].has(v);
        return `<label class="f-opcion${marcada ? ' es-marcada' : ''}" data-alternar="${campo}" data-valor="${esc(v)}">
          <span class="f-casilla"><i class="bi bi-check-lg"></i></span>
          <span class="f-nombre">${esc(v)}</span>
          <em>${cuentaDe(campo, v)}</em>
        </label>`;
      }).join('')}
    </div>`;
  }).join('');

  return `<aside class="f-panel d-solo">
    <div class="f-panel-cabecera">
      <h2>Filtros</h2>
      ${totalFiltros() ? '<button class="f-limpiar" id="limpiar-panel">Limpiar</button>' : ''}
    </div>
    ${grupos}
  </aside>`;
}

function render() {
  const lista = filtrados();
  const activos = totalFiltros();

  const chipsActivos = [
    ...[...filtros.marcas].map((v) => ({ campo: 'marcas', v })),
    ...[...filtros.sabores].map((v) => ({ campo: 'sabores', v })),
    ...[...filtros.tamanos].map((v) => ({ campo: 'tamanos', v }))
  ].map(({ campo, v }) => `<button class="f-chip" data-quitar="${campo}" data-valor="${esc(v)}">
      ${esc(v)} <i class="bi bi-x"></i>
    </button>`).join('');

  $('#contenido').innerHTML = `
    <nav class="f-migas d-solo"><a href="index.html">Inicio</a> · <a href="categorias.html">Categorías</a> · ${esc(nombreCategoria(CATEGORIA))}</nav>
    <div class="f-cabecera">
      <div>
        <h1 class="g-titulo-pantalla m-solo">${lista.length} producto${lista.length === 1 ? '' : 's'}</h1>
        <h1 class="d-solo">${esc(nombreCategoria(CATEGORIA))}</h1>
        <p class="f-contexto d-solo">${lista.length} producto${lista.length === 1 ? '' : 's'}${activos ? ' · ' + activos + ' filtro' + (activos === 1 ? '' : 's') : ''}</p>
        ${activos ? `<p class="g-nota m-solo" style="margin:6px 0 0">${activos} filtro${activos === 1 ? '' : 's'} aplicado${activos === 1 ? '' : 's'}</p>` : ''}
      </div>
      ${activos ? '<button class="f-limpiar" id="limpiar">Limpiar</button>' : ''}
      <div class="f-orden-caja">
        <span class="g-etiqueta">Orden</span>
        <select id="orden">
          ${ORDENES.map((o) => `<option value="${o.id}"${o.id === orden ? ' selected' : ''}>${o.texto}</option>`).join('')}
        </select>
      </div>
    </div>

    ${filaFiltros()}


    <div class="f-cuerpo">
      ${panelFiltros()}
      <div>
        ${activos ? `<div class="f-chips-activos d-solo">${chipsActivos}</div>` : ''}
        ${lista.length
          ? `<div class="f-grilla">${lista.map(tarjetaProducto).join('')}</div>`
          : `<div class="f-vacio">
               <p class="g-nota">No hay productos con estos filtros.</p>
               ${activos ? '<button class="g-btn g-btn-borde" id="limpiar-2" style="width:auto;padding:0 24px">Limpiar filtros</button>' : ''}
             </div>`}
      </div>
    </div>`;

  conectarTarjetas($('#contenido'), productos);
  conectar();
}

function conectar() {
  document.querySelectorAll('[data-poner]').forEach((b) => {
    b.onclick = () => { filtros[b.dataset.poner].add(b.dataset.valor); render(); };
  });
  document.querySelectorAll('[data-alternar]').forEach((el) => {
    el.onclick = (e) => {
      e.preventDefault();
      const campo = el.dataset.alternar;
      const valor = el.dataset.valor;
      if (filtros[campo].has(valor)) filtros[campo].delete(valor); else filtros[campo].add(valor);
      render();
    };
  });
  document.querySelectorAll('[data-quitar]').forEach((b) => {
    b.onclick = () => { filtros[b.dataset.quitar].delete(b.dataset.valor); render(); };
  });
  const limpiar = () => {
    filtros.marcas.clear(); filtros.sabores.clear(); filtros.tamanos.clear();
    render();
  };
  if ($('#limpiar')) $('#limpiar').onclick = limpiar;
  if ($('#limpiar-panel')) $('#limpiar-panel').onclick = limpiar;
  if ($('#limpiar-2')) $('#limpiar-2').onclick = limpiar;
  $('#orden').onchange = (e) => { orden = e.target.value; render(); };
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  montarNav(null);
  montarChrome({ categoria: CATEGORIA }); montarPie();
  $('#titulo-categoria').textContent = nombreCategoria(CATEGORIA);
  document.title = nombreCategoria(CATEGORIA) + ' — GODO Suplementos';

  alCambiar(() => {
    const badge = $('#badge-carrito');
    if (!badge) return;
    const n = contarUnidades();
    badge.textContent = n;
    badge.classList.toggle('g-oculto', n === 0);
  });

  productos = await obtenerPorCategoria(CATEGORIA);
  render();
}

iniciar();
