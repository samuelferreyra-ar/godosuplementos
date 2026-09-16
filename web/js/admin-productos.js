// Panel · Productos.
//
// Resuelve el problema que originó el rediseño: el stock se administra por
// variante (sabor × tamaño), y se edita en el lugar, sin recargar la página
// ni perder el scroll.
import { exigirAdmin, montarPanel, pintarReponer, avisar, marcarGuardado } from './panel.js';
import { escucharCatalogo, moverStock, cambiarPausa, archivar, nivelDe, estadoDe, variantesAReponer } from './admin-datos.js';
import { abrirEntradaStock } from './entrada-stock.js';
import { abrirAltaProducto } from './alta-producto.js';
import { precio, esc, nombreCategoria } from './tienda.js';

const $ = (s) => document.querySelector(s);

let productos = [];
let usuario = null;
let busqueda = '';
let solapa = 'todos';
const abiertas = new Set();
const pendientes = new Map();   // productoId|varianteId -> temporizador

const SOLAPAS = [
  { id: 'todos', texto: 'Todos' },
  { id: 'bajo', texto: 'Stock bajo' },
  { id: 'sin-stock', texto: 'Sin stock' },
  { id: 'pausados', texto: 'Pausados' },
  { id: 'archivados', texto: 'Archivados' }
];

// --- Filtrado ------------------------------------------------------------

function cumpleSolapa(p, id) {
  if (id === 'archivados') return p.archivado === true;
  if (p.archivado) return false;
  const vs = p.listaVariantes ?? [];
  if (id === 'bajo') return vs.some((v) => nivelDe(p, v) === 'bajo');
  if (id === 'sin-stock') return vs.some((v) => (Number(v.stock) || 0) === 0);
  if (id === 'pausados') return vs.length > 0 && vs.every((v) => v.pausada);
  return true;
}

function cumpleBusqueda(p) {
  if (!busqueda) return true;
  const t = busqueda.toLowerCase();
  return [p.nombre, p.marca, p.categoria, ...(p.listaVariantes ?? []).map((v) => v.sabor)]
    .filter(Boolean).join(' ').toLowerCase().includes(t);
}

const visibles = () => productos.filter((p) => cumpleSolapa(p, solapa) && cumpleBusqueda(p));
const cuenta = (id) => productos.filter((p) => cumpleSolapa(p, id)).length;

// --- Piezas --------------------------------------------------------------

function control(productoId, varianteId, stock, nivel, { grande = false } = {}) {
  const clase = nivel === 'cero' ? ' es-cero' : nivel === 'bajo' ? ' es-bajo' : '';
  return `<div class="n-control" data-control="${esc(productoId)}|${esc(varianteId)}">
    <button data-paso="-1" ${stock <= 0 ? 'disabled' : ''} aria-label="Quitar una unidad">−</button>
    <input type="number" inputmode="numeric" value="${stock}" min="0" class="${clase.trim()}"
      aria-label="Stock" ${grande ? 'style="width:52px"' : ''}>
    <button data-paso="1" aria-label="Sumar una unidad">+</button>
  </div>`;
}

function matriz(p) {
  const vs = p.listaVariantes ?? [];
  const sabores = [...new Set(vs.map((v) => v.sabor || 'Único'))];
  const tamanos = [...new Set(vs.map((v) => v.tamano || 'Único'))];
  const buscar = (sabor, tamano) => vs.find((v) =>
    (v.sabor || 'Único') === sabor && (v.tamano || 'Único') === tamano);

  const columnas = '150px ' + '1fr '.repeat(tamanos.length) + '120px';
  const cabecera = `<div class="n-grilla-fila n-grilla-cabecera" style="grid-template-columns:${columnas}">
    <span>Sabor</span>
    ${tamanos.map((t) => {
      const alguna = vs.find((v) => (v.tamano || 'Único') === t);
      return `<span>${esc(t)}<em>${precio(alguna?.precio ?? 0)}</em></span>`;
    }).join('')}
    <span>En la tienda</span>
  </div>`;

  const filas = sabores.map((sabor) => {
    const celdas = tamanos.map((tamano) => {
      const v = buscar(sabor, tamano);
      if (!v) return '<span class="n-nota">—</span>';
      const nivel = nivelDe(p, v);
      const nota = nivel === 'cero' ? 'sin stock' : nivel === 'bajo' ? 'quedan pocas' : '';
      return `<div class="n-celda">
        ${control(p.id, v.varianteId, Number(v.stock) || 0, nivel)}
        <span class="n-nota ${nivel === 'cero' ? 'es-cero' : nivel === 'bajo' ? 'es-bajo' : ''}"
          data-nota="${esc(p.id)}|${esc(v.varianteId)}">${nota}</span>
      </div>`;
    }).join('');

    // El switch actúa sobre la primera variante del sabor: es el eje que el
    // dueño piensa cuando dice "sacá la vainilla de la tienda".
    const primera = vs.find((v) => (v.sabor || 'Único') === sabor);
    const visible = primera && !primera.pausada;
    return `<div class="n-grilla-fila" style="grid-template-columns:${columnas}">
      <span class="n-sabor">${esc(sabor)}</span>
      ${celdas}
      <div class="n-switch">
        <button class="${visible ? 'es-on' : ''}" data-pausa="${esc(p.id)}|${esc(primera?.varianteId ?? '')}"
          aria-label="${visible ? 'Pausar' : 'Publicar'}" ${primera ? '' : 'disabled'}></button>
        <span>${visible ? 'Visible' : 'Pausado'}</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="n-matriz">
    <div class="n-matriz-cabecera">
      <div>
        <h3>Stock por sabor y tamaño</h3>
        <p>Cada celda se guarda sola. Un sabor en cero desaparece de la tienda pero no se borra.</p>
      </div>
      <div class="n-matriz-acciones">
        <button class="g-btn g-btn-primario" data-entrada="${esc(p.id)}">Entrada de stock</button>
      </div>
    </div>
    <div class="n-grilla">${cabecera}${filas}</div>
    <div class="n-matriz-pie">
      <span class="g-nota">${vs.length} variante${vs.length === 1 ? '' : 's'}</span>
      <span data-guardado="${esc(p.id)}"></span>
    </div>
  </div>`;
}

function fila(p) {
  const vs = p.listaVariantes ?? [];
  const estado = estadoDe(p);
  const foto = p.imagenes?.[0];
  const abierta = abiertas.has(p.id);
  const rango = p.precioMin === p.precioMax
    ? precio(p.precioMin)
    : precio(p.precioMin) + ' – ' + precio(p.precioMax);

  // En la fila, el control edita la variante con menos stock: es la que
  // importa. El resto se toca desplegando la matriz.
  const critica = [...vs].sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0))[0];

  return `<article class="n-ficha g-tarjeta">
    <div class="n-fila ${abierta ? 'es-abierta' : ''}">
      <div class="n-ficha-alto">
        <span class="g-foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
        <div class="n-ficha-nombre">
          <b>${esc(p.nombre)}</b>
          <small>${esc(p.marca)} · ${esc(nombreCategoria(p.categoria))}</small>
        </div>
        <button class="n-variantes-celda" data-desplegar="${esc(p.id)}">
          ${vs.length} variante${vs.length === 1 ? '' : 's'}
          <i class="bi bi-chevron-${abierta ? 'up' : 'down'}"></i>
        </button>
        <span class="n-precio-celda">${rango}</span>
        ${critica ? control(p.id, critica.varianteId, Number(critica.stock) || 0, nivelDe(p, critica)) : '<span></span>'}
        <span class="g-pildora g-pildora-${estado.tono}">${esc(estado.texto)}</span>
        <button class="n-mas" data-acciones="${esc(p.id)}" aria-label="Más acciones">⋯</button>
      </div>
    </div>
    ${abierta ? matriz(p) : ''}
  </article>`;
}

/** En el teléfono la tabla no entra: cada producto es una ficha. */
function ficha(p) {
  const vs = p.listaVariantes ?? [];
  const estado = estadoDe(p);
  const foto = p.imagenes?.[0];

  const variantes = vs.map((v) => {
    const nivel = nivelDe(p, v);
    const etiqueta = [v.sabor, v.tamano].filter(Boolean).join(' · ') || 'Único';
    const pildora = v.pausada ? '<span class="g-pildora g-pildora-sin">pausado</span>'
      : nivel === 'cero' ? '<span class="g-pildora g-pildora-sin">sin stock</span>'
      : nivel === 'bajo' ? '<span class="g-pildora g-pildora-aviso">quedan pocas</span>' : '';
    return `<div class="n-variante">
      <span class="n-variante-nombre ${nivel === 'cero' ? 'es-cero' : nivel === 'bajo' ? 'es-bajo' : ''}">${esc(etiqueta)}</span>
      ${pildora}
      ${control(p.id, v.varianteId, Number(v.stock) || 0, nivel, { grande: true })}
    </div>`;
  }).join('');

  return `<article class="n-ficha g-tarjeta">
    <div class="n-ficha-alto">
      <span class="g-foto">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>
      <div class="n-ficha-nombre">
        <b>${esc(p.nombre)}</b>
        <small>${precio(p.precioMin)} · ${vs.length} variante${vs.length === 1 ? '' : 's'}</small>
      </div>
      <span class="g-pildora g-pildora-${estado.tono}">${esc(estado.texto)}</span>
      <button class="n-mas" data-acciones="${esc(p.id)}" aria-label="Más acciones">⋯</button>
    </div>
    ${variantes}
    <div style="text-align:right"><span data-guardado="${esc(p.id)}"></span></div>
  </article>`;
}

// --- Render --------------------------------------------------------------

function render() {
  const lista = visibles();
  const totalVariantes = productos.reduce((a, p) => a + (p.listaVariantes?.length ?? 0), 0);

  $('#encabezado').innerHTML = `
    <div>
      <h1 class="n-titulo">Productos</h1>
      <p class="n-contexto">${productos.length} productos · ${totalVariantes} variantes</p>
    </div>
    <div class="n-acciones">
      <div class="n-buscador">
        <i class="bi bi-search"></i>
        <input id="buscar" type="search" placeholder="Buscar nombre, marca o sabor"
          value="${esc(busqueda)}" autocomplete="off">
      </div>
      <button class="g-btn g-btn-primario" id="entrada-general">
        <i class="bi bi-box-arrow-in-down"></i> Entrada de stock
      </button>
      <button class="g-btn g-btn-acento" id="nuevo-producto">+ Nuevo</button>
    </div>`;

  $('#solapas').innerHTML = SOLAPAS.map((s) => `
    <button class="n-solapa ${s.id === solapa ? 'es-activa' : ''}" data-solapa="${s.id}">
      ${s.texto}<em>${cuenta(s.id)}</em>
    </button>`).join('');

  $('#lista').innerHTML = lista.length
    ? `<div class="n-tabla-cabecera d-solo">
         <span></span><span>Producto</span><span>Variantes</span><span>Precio</span>
         <span>Stock</span><span>Estado</span><span></span>
       </div>
       <div class="m-solo">${lista.map(ficha).join('')}</div>
       <div class="d-solo">${lista.map(fila).join('')}</div>`
    : `<div class="n-vacio">No hay productos con este filtro.</div>`;

  conectar();
}

// --- Eventos -------------------------------------------------------------

function conectar() {
  const buscar = $('#buscar');
  if (buscar) {
    buscar.oninput = () => { busqueda = buscar.value.trim(); render(); $('#buscar').focus(); };
  }
  $('#entrada-general').onclick = () => abrirEntradaStock({ productos, usuario, alGuardar: () => avisar('Entrada registrada', { icono: 'check-circle', segundos: 4 }) });
  $('#nuevo-producto').onclick = () => abrirAltaProducto({
    productos,
    alGuardar: (id, nombre) => avisar('"' + nombre + '" creado', { icono: 'check-circle', segundos: 5 })
  });

  document.querySelectorAll('[data-solapa]').forEach((b) => {
    b.onclick = () => { solapa = b.dataset.solapa; render(); };
  });
  document.querySelectorAll('[data-desplegar]').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.desplegar;
      if (abiertas.has(id)) abiertas.delete(id); else abiertas.add(id);
      render();
    };
  });
  document.querySelectorAll('[data-entrada]').forEach((b) => {
    b.onclick = () => abrirEntradaStock({
      productos, usuario, productoId: b.dataset.entrada,
      alGuardar: () => avisar('Entrada registrada', { icono: 'check-circle', segundos: 4 })
    });
  });
  document.querySelectorAll('[data-acciones]').forEach((b) => {
    b.onclick = () => menuAcciones(b.dataset.acciones);
  });
  document.querySelectorAll('[data-pausa]').forEach((b) => {
    b.onclick = async () => {
      const [productoId, varianteId] = b.dataset.pausa.split('|');
      if (!varianteId) return;
      const encendido = b.classList.contains('es-on');
      try {
        await cambiarPausa(productoId, varianteId, encendido);
      } catch (e) {
        avisar(e.message, { icono: 'exclamation-triangle', segundos: 5 });
      }
    };
  });

  conectarControles();
}

/**
 * Los −/+ escriben con espera: se ve el número al instante y se guarda
 * cuando el dueño deja de tocar. Si falla, el número vuelve a lo que estaba.
 */
function conectarControles() {
  document.querySelectorAll('[data-control]').forEach((caja) => {
    const [productoId, varianteId] = caja.dataset.control.split('|');
    const input = caja.querySelector('input');
    const producto = productos.find((p) => p.id === productoId);
    const variante = producto?.listaVariantes.find((v) => v.varianteId === varianteId);
    if (!variante) return;

    const original = Number(variante.stock) || 0;

    const programar = () => {
      const clave = productoId + '|' + varianteId;
      clearTimeout(pendientes.get(clave));
      pendientes.set(clave, setTimeout(async () => {
        pendientes.delete(clave);
        const delta = (Number(input.value) || 0) - original;
        if (!delta) return;
        try {
          await moverStock(productoId, { [varianteId]: delta }, 'ajuste', usuario?.uid ?? null);
          marcarGuardado(document.querySelector('[data-guardado="' + productoId + '"]'));
        } catch (e) {
          input.value = original;
          avisar('No se pudo guardar: ' + e.message, { icono: 'exclamation-triangle', segundos: 6 });
        }
      }, 600));
    };

    caja.querySelectorAll('[data-paso]').forEach((b) => {
      b.onclick = () => {
        input.value = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.paso));
        programar();
      };
    });
    input.oninput = programar;
  });
}

function menuAcciones(productoId) {
  const p = productos.find((x) => x.id === productoId);
  if (!p) return;

  if (p.archivado) {
    if (!confirm('¿Devolver "' + p.nombre + '" al catálogo?')) return;
    archivar(productoId, false)
      .then(() => avisar('"' + p.nombre + '" volvió al catálogo', { icono: 'arrow-counterclockwise', segundos: 4 }))
      .catch((e) => avisar(e.message, { icono: 'exclamation-triangle' }));
    return;
  }

  // Archivar, no borrar: el historial de pedidos sigue necesitando el producto.
  if (!confirm('¿Archivar "' + p.nombre + '"?\n\nSale de la tienda pero no se borra, y se puede recuperar.')) return;
  archivar(productoId, true)
    .then(() => avisar('"' + p.nombre + '" archivado', {
      etiqueta: 'Deshacer',
      accion: () => archivar(productoId, false)
    }))
    .catch((e) => avisar(e.message, { icono: 'exclamation-triangle' }));
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  const sesion = await exigirAdmin();
  if (!sesion) return;
  usuario = sesion.usuario;

  montarPanel('productos');

  escucharCatalogo((lista) => {
    productos = lista;
    render();
    pintarReponer(variantesAReponer(lista));
  }, () => {
    $('#lista').innerHTML = '<div class="n-vacio">Se perdió la conexión con el catálogo. Recargá la página.</div>';
  });
}

iniciar();
