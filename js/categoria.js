// js/categoria.js
import { obtenerProductosParaBusqueda } from "./productos.js";
import { inicializarFiltrado, renderControlCantidad } from "./main.js";
import { agregarProducto, getCarrito, actualizarCantidad, eliminarProducto } from "./carrito.js";

const $lista = document.getElementById("categoria-lista");
const $vacio = document.getElementById("categoria-vacio");

const norm = (s) =>
  (s || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[áä]/g, "a")
    .replace(/[éë]/g, "e")
    .replace(/[íï]/g, "i")
    .replace(/[óö]/g, "o")
    .replace(/[úü]/g, "u");

function slugFromPath() {
  const m = (location.pathname || "").match(/\/([^\/]+)\.html$/i);
  return m ? m[1] : "";
}

function getCategoriaSlug(pref) {
  return pref || document.body?.dataset?.categoria || slugFromPath();
}

// Estado local
let _listaActual = [];      // última lista pintada (ya filtrada)
let _delegationReady = false;
let _bridgeReady = false;

// ============ RENDER (idéntico a Resultados / “Más vendidos”) ============
function renderizarCategoria(lista) {
  if (!$lista || !$vacio) return;

  _listaActual = Array.isArray(lista) ? lista : [];

  if (!_listaActual.length) {
    $lista.innerHTML = "";
    $vacio.style.display = "block";
    return;
  }

  const carrito = typeof getCarrito === "function" ? getCarrito() : [];

  $lista.innerHTML = _listaActual.map((p) => {
    const enCarrito = carrito.find((x) => String(x.id) === String(p.id));
    return `
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
            ${renderControlCantidad(p, enCarrito)}
          </div>
        </div>
      </div>
    `;
  }).join("");

  $vacio.style.display = "none";

  if (!_delegationReady) {
    attachDelegation();     // << igual que resultados: un solo handler delegado
    _delegationReady = true;
  }
}

// ============ DELEGACIÓN (calcada a Resultados, sin captura) ============
function attachDelegation() {
  // Un solo listener para toda la grilla
  $lista.addEventListener("click", (e) => {
    const card = e.target.closest(".godo-card");
    if (!card) return;

    const id = card.getAttribute("data-id");
    if (!id) return;

    // Si es un control de la card, no queremos comportamiento por defecto (ni navegación)
    if (e.target.closest(".agregar-carrito-btn, .godo-card-btn, .btn-carrito-mas, .btn-carrito-menos, .btn-carrito-trash, .cantidad-input")) {
      e.preventDefault();
    }

    const prod = _listaActual.find((p) => String(p.id) === String(id));
    const input = card.querySelector(".cantidad-input");

    // Agregar al carrito
    if (e.target.closest(".agregar-carrito-btn, .godo-card-btn")) {
      const cant = Math.max(1, parseInt(input?.value || "1", 10));
      // Igual que resultados: pasar el objeto producto
      agregarProducto(prod, cant);
      if (window.mostrarToast) mostrarToast("Producto agregado al carrito!");
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      renderizarCategoria(_listaActual);
      return;
    }

    // +
    if (e.target.closest(".btn-carrito-mas")) {
      const enCarrito = getCarrito().find((p) => String(p.id) === String(id));
      const nueva = (enCarrito?.cantidad || 0) + 1;
      if (typeof actualizarCantidad === "function") actualizarCantidad(id, nueva);
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      renderizarCategoria(_listaActual);
      return;
    }

    // −
    if (e.target.closest(".btn-carrito-menos")) {
      const enCarrito = getCarrito().find((p) => String(p.id) === String(id));
      if (enCarrito && enCarrito.cantidad > 1) {
        if (typeof actualizarCantidad === "function") actualizarCantidad(id, enCarrito.cantidad - 1);
        if (window.actualizarCarritoContador) actualizarCarritoContador();
        if (window.mostrarBarraCarrito) mostrarBarraCarrito();
        renderizarCategoria(_listaActual);
      }
      return;
    }

    // Quitar (trash)
    if (e.target.closest(".btn-carrito-trash")) {
      if (typeof eliminarProducto === "function") eliminarProducto(id);
      if (window.actualizarCarritoContador) actualizarCarritoContador();
      if (window.mostrarBarraCarrito) mostrarBarraCarrito();
      renderizarCategoria(_listaActual);
      return;
    }
  });

  // Enter en input = setear cantidad
  $lista.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target.closest(".godo-card");
    if (!card) return;

    const id = card.getAttribute("data-id");
    if (!id) return;

    const input = card.querySelector(".cantidad-input");
    let val = parseInt(input?.value, 10);
    if (!Number.isFinite(val) || val < 1) val = 1;

    if (typeof actualizarCantidad === "function") actualizarCantidad(id, val);
    if (window.actualizarCarritoContador) actualizarCarritoContador();
    if (window.mostrarBarraCarrito) mostrarBarraCarrito();
    renderizarCategoria(_listaActual);
  }, true);
}

// ============ BRIDGE OFFCANVAS (para que en móvil se vean los filtros) ============
function bridgeFiltrosOffcanvas() {
  if (_bridgeReady) return;
  const off = document.getElementById("offcanvasFiltros");
  const body = document.getElementById("offcanvasFiltrosBody");
  const cont = document.getElementById("filtros-contenedor");
  const aside = document.getElementById("filtros-aside");

  if (!off || !body || !cont || !aside) {
    // Si faltan nodos, no rompemos; puede que inicializarFiltrado ya resuelva todo.
    _bridgeReady = true;
    return;
  }

  off.addEventListener("show.bs.offcanvas", () => {
    // Wrapper scrollable para móvil (coincide con CSS que ya usás)
    let wrap = body.querySelector(".filtros-scroll");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "filtros-scroll";
      body.prepend(wrap);
    }
    if (!wrap.contains(cont)) wrap.appendChild(cont);
  });

  off.addEventListener("hidden.bs.offcanvas", () => {
    if (!aside.contains(cont)) aside.prepend(cont);
  });

  // Botón Aplicar (si existe)
  document.querySelectorAll(".btn-apply-filters").forEach((btn) => {
    btn.addEventListener("click", () => {
      // `inicializarFiltrado` ya debería disparar el re-render al cambiar el form.
      // Si tu implementación requiere un llamado manual, podés forzar:
      // renderizarCategoria(_listaActual);
    });
  });

  _bridgeReady = true;
}

// ============ INIT / EXPORT ============
export async function mostrarCategoria(pref) {
  const slug = getCategoriaSlug(pref);
  const todos = await obtenerProductosParaBusqueda();
  const base = todos.filter((p) => norm(p.categoria) === norm(slug));

  // 1) Filtros idénticos a resultados (pinta panel + setea listeners de cambios)
  //    Usa tus mismos IDs: #filtros-contenedor (aside) y #offcanvasFiltros/#offcanvasFiltrosBody (móvil)
  if (typeof inicializarFiltrado === "function") {
    inicializarFiltrado(base, renderizarCategoria);
  }

  // 2) Asegurar bridge del offcanvas (si tu inicializador no lo hace)
  bridgeFiltrosOffcanvas();

  // 3) Primer pintado
  renderizarCategoria(base);
}