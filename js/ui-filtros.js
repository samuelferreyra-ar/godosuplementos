// js/ui-filtros.js

// Facetas dinámicas a partir de una lista de productos
export function buildFacets(productos) {
  const marcas = new Map();
  const subcats = new Map();
  let min = Infinity, max = -Infinity;

  for (const p of (productos || [])) {
    const m = (p.marca || "").trim();
    const s = (p.subcategoria || "").trim();
    const precio = Number(p.precio) || 0;
    if (m) marcas.set(m, (marcas.get(m) || 0) + 1);
    if (s) subcats.set(s, (subcats.get(s) || 0) + 1);
    if (precio < min) min = precio;
    if (precio > max) max = precio;
  }
  if (min === Infinity) min = 0;
  if (max === -Infinity) max = 0;

  const toArr = (map) => [...map.entries()].sort((a,b) => a[0].localeCompare(b[0]))
                           .map(([value,count]) => ({ value, count }));

  return {
    marcas: toArr(marcas),
    subcategorias: toArr(subcats),
    precioMin: Math.floor(min),
    precioMax: Math.ceil(max)
  };
}

// Pinta los filtros en #filtros-contenedor (usa <form> para fácil lectura de estado)
export function renderFiltros($contenedor, facets, state = {}) {
  if (!$contenedor) return;
  const { marcas, subcategorias, precioMin, precioMax } = facets;

  const checked = (arr, v) => Array.isArray(arr) && arr.includes(v) ? 'checked' : '';

  $contenedor.innerHTML = `
    <form id="filtros-form" class="vstack gap-3">
      <section>
        <h6 class="mb-2">Precio</h6>
        <div class="d-flex align-items-center gap-2">
          <input type="number" class="form-control" name="min" placeholder="${precioMin}" min="0" value="${state.min ?? ''}">
          <span>–</span>
          <input type="number" class="form-control" name="max" placeholder="${precioMax}" min="0" value="${state.max ?? ''}">
        </div>
      </section>

      <section>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="solo-stock" name="stock" ${state.stock ? 'checked' : ''}>
          <label class="form-check-label" for="solo-stock">Solo en stock</label>
        </div>
      </section>

      <section>
        <h6 class="mb-2">Marca</h6>
        <div class="vstack gap-1">
          ${marcas.map(m => `
            <div class="form-check">
              <input class="form-check-input" type="checkbox" name="marca" value="${m.value}" id="marca-${cssId(m.value)}" ${checked(state.marca, m.value)}>
              <label class="form-check-label" for="marca-${cssId(m.value)}">${m.value} <span class="text-muted">(${m.count})</span></label>
            </div>`).join('')}
        </div>
      </section>

      <section>
        <h6 class="mb-2">Subcategoría</h6>
        <div class="vstack gap-1">
          ${subcategorias.map(s => `
            <div class="form-check">
              <input class="form-check-input" type="checkbox" name="subcat" value="${s.value}" id="subcat-${cssId(s.value)}" ${checked(state.subcat, s.value)}>
              <label class="form-check-label" for="subcat-${cssId(s.value)}">${s.value} <span class="text-muted">(${s.count})</span></label>
            </div>`).join('')}
        </div>
      </section>
    </form>
  `;
}

const cssId = (s) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g,'');

// Lee el estado actual del formulario de filtros
export function readFiltrosState($contenedor) {
  const $form = $contenedor?.querySelector('#filtros-form');
  if (!$form) return {};
  const fd = new FormData($form);

  const marcas = fd.getAll('marca');
  const subcats = fd.getAll('subcat');
  const min = fd.get('min');
  const max = fd.get('max');
  const stock = !!fd.get('stock');

  return {
    marca: marcas.length ? marcas : null,
    subcat: subcats.length ? subcats : null,
    min: min ? Number(min) : null,
    max: max ? Number(max) : null,
    stock
  };
}

// Aplica el estado de filtros a una lista de productos
export function filtrarProductos(productos, st) {
  if (!Array.isArray(productos) || !productos.length) return [];
  const s = st || {};
  return productos.filter(p => {
    const precio = Number(p.precio) || 0;

    if (s.stock && !(Number(p.stock) > 0)) return false;
    if (s.min != null && precio < s.min) return false;
    if (s.max != null && precio > s.max) return false;

    if (s.marca && s.marca.length && !s.marca.includes(p.marca || "")) return false;
    if (s.subcat && s.subcat.length && !s.subcat.includes(p.subcategoria || "")) return false;

    return true;
  });
}

// Bridge: mover #filtros-contenedor al offcanvas en móvil y devolverlo al aside al cerrar
export function attachOffcanvasBridge({
  filtrosContenedorId = 'filtros-contenedor',
  offcanvasId = 'offcanvasFiltros',
  offcanvasBodyId = 'offcanvasFiltrosBody',
  applyBtnSelector = '.btn-apply-filters',
  onApply = () => {}
} = {}) {
  const $cont = document.getElementById(filtrosContenedorId);
  const $off = document.getElementById(offcanvasId);
  const $body = document.getElementById(offcanvasBodyId);
  if (!$cont || !$off || !$body) return;

  const asideParent = $cont.parentElement;

  $off.addEventListener('show.bs.offcanvas', () => {
    $body.prepend($cont);
  });

  $off.addEventListener('hidden.bs.offcanvas', () => {
    asideParent.prepend($cont);
  });

  // Botón "Aplicar filtros" (dentro del offcanvas)
  document.querySelectorAll(applyBtnSelector).forEach(btn => {
    btn.addEventListener('click', () => {
      onApply();
    });
  });
}