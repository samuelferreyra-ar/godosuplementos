// Ficha de producto con selección de variante.
//
// Los chips de sabor y tamaño actualizan precio, stock y disponibilidad sin
// recargar, y el estado se refleja en la URL para que el enlace sea compartible.
import { obtenerProducto, hayStock, stockBajo, buscarVariante, varianteInicial, fotoDe } from './catalogo.js';
import { obtenerConfig, precio, esc, nombreCategoria } from './tienda.js';
import { agregar, contarUnidades, alCambiar } from './carrito.js';
import { marcarAgregado } from './tarjeta.js';
import { montarChrome, montarPie } from './chrome.js';
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, limit } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const $ = (s, raiz = document) => raiz.querySelector(s);
const params = new URLSearchParams(location.search);

let producto = null;
let elegido = { sabor: null, tamano: null };
let cantidad = 1;
let fotoActiva = 0;
let config = null;

// --- Badge del carrito ---------------------------------------------------

alCambiar(() => {
  const badge = $('#badge-carrito');
  const n = contarUnidades();
  badge.textContent = n;
  badge.classList.toggle('g-oculto', n === 0);
});

// --- Selección de variante ----------------------------------------------

const varianteActual = () => buscarVariante(producto, elegido.sabor, elegido.tamano);

/** Tamaños en los que existe este sabor (y viceversa), para saber qué deshabilitar. */
function variantesPara({ sabor, tamano }) {
  return producto.variantes.filter((v) =>
    (sabor == null || v.sabor === sabor) && (tamano == null || v.tamano === tamano));
}

function elegirSabor(sabor) {
  elegido.sabor = sabor;
  // Si el sabor no existe en el tamaño elegido, se cae al primero disponible.
  if (!hayStock(buscarVariante(producto, sabor, elegido.tamano))) {
    const alternativa = variantesPara({ sabor }).find(hayStock);
    if (alternativa) elegido.tamano = alternativa.tamano;
  }
  render();
}

function elegirTamano(tamano) {
  elegido.tamano = tamano;
  if (!hayStock(buscarVariante(producto, elegido.sabor, tamano))) {
    const alternativa = variantesPara({ tamano }).find(hayStock);
    if (alternativa) elegido.sabor = alternativa.sabor;
  }
  render();
}

function sincronizarUrl() {
  const u = new URL(location.href);
  u.searchParams.set('id', producto.id);
  if (elegido.sabor) u.searchParams.set('sabor', elegido.sabor); else u.searchParams.delete('sabor');
  if (elegido.tamano) u.searchParams.set('tamano', elegido.tamano); else u.searchParams.delete('tamano');
  history.replaceState(null, '', u);
}

function galeria() {
  const fotos = (producto.imagenes ?? []).filter(Boolean);
  const principal = fotos[fotoActiva] ?? fotos[0] ?? null;

  const miniaturas = fotos.length > 1
    ? `<div class="p-miniaturas">
        ${fotos.slice(0, 4).map((f, i) => `<button class="p-mini${i === fotoActiva ? ' es-elegida' : ''}" data-foto="${i}">
          <img src="${esc(f)}" alt="" onerror="this.closest('.p-mini').remove()">
        </button>`).join('')}
      </div>`
    : '';

  return `<div class="p-galeria d-solo">
    ${miniaturas}
    <div class="p-principal g-foto">
      ${principal ? `<img src="${esc(principal)}" alt="${esc(producto.nombre)}" onerror="this.remove()">` : ''}
    </div>
  </div>`;
}

// --- Render --------------------------------------------------------------

function chipsSabor() {
  if (!producto.sabores.length) return '';
  const chips = producto.sabores.map((sabor) => {
    const disponible = variantesPara({ sabor }).some(hayStock);
    const activo = sabor === elegido.sabor;
    return `<button class="g-chip${activo ? ' es-elegido' : ''}" data-sabor="${esc(sabor)}"${disponible ? '' : ' disabled'}>
      ${esc(sabor)}${disponible ? '' : ' · sin stock'}
    </button>`;
  }).join('');
  return `<div class="p-grupo p-chip-desktop">
    <span class="g-etiqueta">Sabor</span>
    <div class="g-chips">${chips}</div>
  </div>`;
}

function chipsTamano() {
  if (producto.tamanos.length < 2) return '';
  const chips = producto.tamanos.map((tamano) => {
    const enTamano = variantesPara({ tamano });
    const disponible = enTamano.some(hayStock);
    const activo = tamano === elegido.tamano;
    // El precio va dentro del chip: cambiar tamaño cambia el precio.
    const suPrecio = (buscarVariante(producto, elegido.sabor, tamano) ?? enTamano[0])?.precio;
    return `<button class="g-chip${activo ? ' es-elegido' : ''}" data-tamano="${esc(tamano)}"${disponible ? '' : ' disabled'}>
      ${esc(tamano)}<small>${suPrecio != null ? precio(suPrecio) : 'sin stock'}</small>
    </button>`;
  }).join('');
  return `<div class="p-grupo p-chip-desktop">
    <span class="g-etiqueta">Tamaño</span>
    <div class="g-chips">${chips}</div>
  </div>`;
}

function bloqueConfianza() {
  const metodos = config.metodosPago ?? [];
  const nombres = { payway: 'tarjeta', transferencia: 'transferencia', efectivo: 'efectivo al retirar' };
  const listado = metodos.map((m) => nombres[m] ?? m).join(', ') || 'consultanos los medios de pago';

  return `<div class="g-tarjeta p-confianza">
    <div><i class="bi bi-truck"></i><span>Catamarca capital en el día · resto del país 2 a 4 días</span></div>
    <div><i class="bi bi-shop"></i><span>Retiro sin cargo en el local</span></div>
    <div><i class="bi bi-credit-card"></i><span>${esc(listado.charAt(0).toUpperCase() + listado.slice(1))}</span></div>
  </div>`;
}

function bloqueResenas(resenas) {
  if (!resenas.length) return '';
  const items = resenas.map((r) => `<div class="p-resena">
    <blockquote>“${esc(r.texto)}”</blockquote>
    <cite>${esc(r.autor ?? 'Cliente')} · por ${esc(r.origen === 'instagram' ? 'Instagram' : 'WhatsApp')}</cite>
  </div>`).join('');
  return `<section class="p-resenas">
    <span class="g-etiqueta"><i class="bi bi-whatsapp"></i> Lo que dicen</span>
    ${items}
  </section>`;
}

function render(resenas = null) {
  if (resenas) render.resenas = resenas;
  const v = varianteActual();
  const disponible = hayStock(v);
  cantidad = Math.min(cantidad, Math.max(1, v?.stock ?? 1));

  // Cobrar con tarjeta y ofrecer cuotas son dos cosas distintas: el formulario
  // muestra las cuotas que el comercio tenga habilitadas con Payway, que puede
  // ser una sola. Por eso hacen falta las dos condiciones — anunciar cuotas
  // que después no aparecen es peor que no anunciarlas.
  const cuotas = (config.metodosPago ?? []).includes('payway') && config.payway?.ofrecerCuotas === true
    ? '<span class="g-nota">Cuotas con todas las tarjetas</span>' : '';

  const urgencia = stockBajo(producto, v)
    ? `<div class="p-urgencia">${v.stock === 1 ? 'Queda' : 'Quedan'} ${v.stock} ${
        v.sabor ? 'de este sabor' : (v.stock === 1 ? 'unidad' : 'unidades')}</div>` : '';

  const foto = fotoDe(producto);

  $('#contenido').innerHTML = `
    ${galeria()}
    <div class="g-foto p-foto m-solo">
      ${foto ? `<img src="${esc(foto)}" alt="${esc(producto.nombre)}" onerror="this.remove()">` : ''}
    </div>

    <div>
      <div class="p-cabecera">
        <div class="p-marca">${esc(producto.marca)} · ${esc(nombreCategoria(producto.categoria))}</div>
        <h1 class="p-titulo">${esc(producto.nombre)}</h1>
        <div class="p-precio-fila">
          <span class="g-precio">${v ? precio(v.precio) : '—'}</span>
          ${cuotas}
        </div>
        ${urgencia}
      </div>

      ${chipsSabor()}
      ${chipsTamano()}
      ${bloqueConfianza()}

      <div class="g-pie-fijo">
        <div class="p-pie">
          <div class="p-cantidad">
            <button id="menos" ${cantidad <= 1 ? 'disabled' : ''} aria-label="Quitar uno">−</button>
            <span id="cantidad">${cantidad}</span>
            <button id="mas" ${!disponible || cantidad >= v.stock ? 'disabled' : ''} aria-label="Agregar uno">+</button>
          </div>
          <button class="g-btn g-btn-primario" id="agregar" ${disponible ? '' : 'disabled'}>
            ${disponible ? 'Agregar al carrito' : 'Sin stock'}
          </button>
        </div>
      </div>
    </div>

    <div class="p-abajo">
      <div>
        <h2>Descripción</h2>
        ${producto.descripcion
          ? `<div class="p-descripcion">${esc(producto.descripcion)}</div>`
          : '<p class="g-nota">Este producto todavía no tiene descripción cargada.</p>'}
      </div>
      <div>
        <h2>Opiniones</h2>
        ${(render.resenas ?? []).length
          ? bloqueResenas(render.resenas)
          : '<p class="p-sin-resenas">Todavía no hay opiniones de este producto.</p>'}
      </div>
    </div>`;

  conectar();
  sincronizarUrl();
}

function conectar() {
  document.querySelectorAll('[data-sabor]').forEach((b) => {
    b.onclick = () => elegirSabor(b.dataset.sabor);
  });
  document.querySelectorAll('[data-tamano]').forEach((b) => {
    b.onclick = () => elegirTamano(b.dataset.tamano);
  });

  document.querySelectorAll('[data-foto]').forEach((b) => {
    b.onclick = () => { fotoActiva = Number(b.dataset.foto); render(); };
  });

  const v = varianteActual();
  $('#menos').onclick = () => { cantidad = Math.max(1, cantidad - 1); render(); };
  $('#mas').onclick = () => { cantidad = Math.min(v?.stock ?? 1, cantidad + 1); render(); };

  $('#agregar').onclick = () => {
    if (!hayStock(v)) return;
    agregar(producto, v, cantidad);
    const badge = $('#badge-carrito');
    badge.classList.add('late');
    setTimeout(() => badge.classList.remove('late'), 220);
    // Se marca el botón antes de repintar; el render posterior lo dejaría
    // como estaba, así que la señal se muestra sobre el botón actual.
    marcarAgregado($('#agregar'), 'Agregar al carrito');
    cantidad = 1;
  };
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  montarChrome({});
  montarPie();

  const id = params.get('id');
  if (!id) {
    $('#contenido').innerHTML = '<div class="p-error">No se indicó qué producto mostrar.</div>';
    return;
  }

  [producto, config] = await Promise.all([obtenerProducto(id), obtenerConfig()]);

  if (!producto) {
    $('#contenido').innerHTML = '<div class="p-error">Ese producto ya no está disponible.<br><a href="index.html">Volver a la tienda</a></div>';
    return;
  }

  document.title = producto.nombre + ' — GODO Suplementos';

  const inicial = varianteInicial(producto, { sabor: params.get('sabor'), tamano: params.get('tamano') });
  elegido = { sabor: inicial?.sabor ?? null, tamano: inicial?.tamano ?? null };
  render();

  // Las reseñas no bloquean la ficha: llegan después y se repinta.
  try {
    const q = query(collection(db, 'resenas'),
      where('productoId', '==', producto.id), where('publicada', '==', true), limit(4));
    const snap = await getDocs(q);
    if (!snap.empty) render(snap.docs.map((d) => d.data()));
  } catch {
    // Sin reseñas cargadas todavía; el bloque simplemente no se muestra.
  }
}

iniciar();
