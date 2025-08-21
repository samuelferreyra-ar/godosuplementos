// js/resultados.js
import { obtenerProductosParaBusqueda } from "./productos.js";
import { inicializarFiltrado, renderControlCantidad } from "./main.js";
import { agregarProducto, getCarrito, actualizarCantidad, eliminarProducto } from "./carrito.js";

const $lista = document.getElementById("resultados-lista");
const $vacio = document.getElementById("resultados-vacio");
const $qSpan = document.getElementById("res-busqueda");

// Render idéntico a “Más vendidos”, usando renderControlCantidad
function renderizarResultados(lista) {
  if (!$lista || !$vacio) return;

  if (!Array.isArray(lista) || !lista.length) {
    $lista.innerHTML = "";
    $vacio.style.display = "block";
    return;
  }

  const carrito = getCarrito ? getCarrito() : [];

  $lista.innerHTML = lista.map(p => `
    <div class="col-6 col-md-3">
      <div class="godo-card w-100" data-id="${p.id}">
        <!-- Solo imagen y título navegan -->
        <a href="producto.html?id=${p.id}" class="d-block">
          <img src="${p.imagen1}" loading="lazy" class="godo-card-img" alt="${p.nombre}">
        </a>
        <div class="px-3 pt-2 pb-1 flex-grow-1 d-flex flex-column">
          <a href="producto.html?id=${p.id}" class="godo-card-title text-decoration-none d-block">
            ${p.nombre}
          </a>
          <div class="godo-card-price mb-2">$${Number(p.precio).toLocaleString("es-AR")}</div>
          ${renderControlCantidad(p, carrito.find(x => String(x.id) === String(p.id)))}
        </div>
      </div>
    </div>
  `).join("");

  //Bridge filtros



  // ==== Listeners de controles (igual que “Más vendidos”) ====

  // Blindaje: que los controles no “naveguen”
  $lista.addEventListener("click", (e) => {
    if (e.target.closest(".btn-carrito-mas, .btn-carrito-menos, .cantidad-input, .godo-card-btn, .agregar-carrito-btn, .btn-carrito-trash")) {
      e.preventDefault();
    }
  });

  // Agregar
  $lista.querySelectorAll(".agregar-carrito-btn, .godo-card-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const prod = lista.find(p => String(p.id) === String(id));
      // Tu firma real suele ser agregarProducto(producto, cantidad)
      try { agregarProducto(prod, 1); } catch { agregarProducto(id, 1); }
      if (window.mostrarToast) mostrarToast("Producto agregado al carrito!");
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      // Re-render para reflejar el estado actual
      renderizarResultados(lista);
    };
  });

  // Quitar
  $lista.querySelectorAll(".btn-carrito-trash").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      eliminarProducto && eliminarProducto(id);
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      renderizarResultados(lista);
    };
  });

  // –
  $lista.querySelectorAll(".btn-carrito-menos").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const enCarrito = getCarrito().find(p => String(p.id) === String(id));
      if (enCarrito && enCarrito.cantidad > 1) {
        actualizarCantidad && actualizarCantidad(id, enCarrito.cantidad - 1);
        if (window.actualizarCarritoContador) actualizarCarritoContador();
        if (window.mostrarBarraCarrito) mostrarBarraCarrito();
        renderizarResultados(lista);
      }
    };
  });

  // +
  $lista.querySelectorAll(".btn-carrito-mas").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const enCarrito = getCarrito().find(p => String(p.id) === String(id));
      const nueva = (enCarrito?.cantidad || 0) + 1;
      actualizarCantidad && actualizarCantidad(id, nueva);
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      renderizarResultados(lista);
    };
  });

  // Enter en input = setear cantidad
  $lista.querySelectorAll(".cantidad-input").forEach(input => {
    input.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const id = input.getAttribute("data-id");
      let val = parseInt(input.value, 10);
      if (!Number.isFinite(val) || val < 1) val = 1;
      actualizarCantidad && actualizarCantidad(id, val);
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      renderizarResultados(lista);
    };
  });

  $vacio.style.display = "none";
}

  function bridgeFiltrosOffcanvas() {
  const cont  = document.getElementById('filtros-contenedor');
  const aside = document.getElementById('filtros-aside');
  const off   = document.getElementById('offcanvasFiltros');
  const body  = document.getElementById('offcanvasFiltrosBody');

  if (!cont || !aside || !off || !body) {
    console.warn('Faltan nodos del offcanvas/aside', { cont, aside, off, body });
    return;
  }

  // Al abrir: mover el panel al offcanvas
  off.addEventListener('show.bs.offcanvas', () => {
    if (!body.contains(cont)) body.prepend(cont);
  });

  // Al cerrar: devolverlo al aside de escritorio
  off.addEventListener('hidden.bs.offcanvas', () => {
    if (!aside.contains(cont)) aside.prepend(cont);
  });

  // Botón “Aplicar filtros”
  document.querySelectorAll('.btn-apply-filters').forEach(btn => {
    btn.addEventListener('click', () => {
      // tu rerender habitual
      if (typeof rerender === 'function') rerender();
    });
  });
}

// ====== INIT ======
(async function initResultados() {
  const params = new URLSearchParams(location.search);
  const q = (params.get("q") || "").trim();
  if ($qSpan) $qSpan.textContent = q;

  const todos = await obtenerProductosParaBusqueda();

  // Búsqueda difusa con Fuse.js si está cargado, sino filtro simple
  let base = [];
  if (q && typeof Fuse !== "undefined") {
    const fuse = new Fuse(todos, {
      keys: ["nombre", "marca", "categoria", "subcategoria"],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    base = fuse.search(q).map(r => r.item);
  } else {
    const t = q.toLowerCase();
    base = t
      ? todos.filter(p =>
          (p.nombre || "").toLowerCase().includes(t) ||
          (p.marca  || "").toLowerCase().includes(t))
      : todos;
  }

  // 1) Pintá filtros + enganchá eventos según tu implementación “ideal”
  //    (inicializarFiltrado se encarga de armar el panel, bridge offcanvas, etc.)
  inicializarFiltrado(base, renderizarResultados);

  bridgeFiltrosOffcanvas();
  // 2) Primer pintado
  renderizarResultados(base);

  // IMPORTANTE: NO agregar listeners de click a '.godo-card' para navegar.
  // La navegación queda solo en los <a> de imagen y título.
})();