import { onUserStateChanged, getUserData, esAdmin, logout, login } from "./auth.js";
import { getMasVendidos, obtenerProductosParaBusqueda } from "./productos.js";
import { agregarProducto, getCarrito, actualizarCantidad, eliminarProducto } from "./carrito.js";
import { mostrarToast } from "./ui.js";

// Estado de la barra de carrito
let barraAbierta = false;

// --- CONTADOR CARRITO ---
function actualizarCarritoContador() {
  const carrito = getCarrito();
  const cc = document.getElementById('carrito-contador');
  if (cc) {
    cc.textContent = carrito.length;
    cc.style.display = carrito.length > 0 ? '' : 'none';
  }
}

// --- CONTROL DE CANTIDAD DINÁMICO ---
export function renderControlCantidad(producto, enCarrito) {
  if (!enCarrito) {
    return `<button class="godo-card-btn agregar-carrito-btn" data-id="${producto.id}">Agregar al carrito</button>`;
  }
  let iconoMenos = enCarrito.cantidad === 1
    ? `<button class="btn btn-outline-danger btn-carrito-trash" data-id="${producto.id}" title="Quitar"><i class="bi bi-trash"></i></button>`
    : `<button class="btn btn-outline-secondary btn-carrito-menos" data-id="${producto.id}">–</button>`;
  return `
    <div class="input-group carrito-cantidad-control mt-2 justify-content-center">
      ${iconoMenos}
      <input type="number" class="form-control cantidad-input mx-1 text-center" style="width:60px"
        min="1" max="${producto.stock}" value="${enCarrito.cantidad}" data-id="${producto.id}">
      <button class="btn btn-outline-secondary btn-carrito-mas" data-id="${producto.id}">+</button>
    </div>
  `;
}

// === UNIFICADOR DE CARDS (idénticas a “más vendidos”) ===
export function renderCardsUnificado(contenedor, productos, onUpdate = () => {}) {
  const carrito = getCarrito();
  contenedor.innerHTML = productos.map(prod => `
    <div class="col-6 col-md-3">
      <div class="godo-card w-100" data-id="${prod.id}">
        <!-- Solo imagen y título navegan -->
        <a href="producto.html?id=${prod.id}" class="d-block">
          <img src="${prod.imagen1}" loading="lazy" class="godo-card-img" alt="${prod.nombre}">
        </a>
        <div class="px-3 pt-2 pb-1 flex-grow-1 d-flex flex-column">
          <a href="producto.html?id=${prod.id}" class="godo-card-title text-decoration-none d-block">
            ${prod.nombre}
          </a>
          <div class="godo-card-price mb-2">$${Number(prod.precio).toLocaleString('es-AR')}</div>
          ${renderControlCantidad(prod, carrito.find(p => p.id === prod.id))}
        </div>
      </div>
    </div>
  `).join("");

  attachCardListenersGenerico(productos, contenedor, onUpdate);
}

// Listeners idénticos a “más vendidos”, pero parametrizados con onUpdate
function attachCardListenersGenerico(productos, contenedor, onUpdate = () => {}) {
  // Agregar al carrito
  contenedor.querySelectorAll(".agregar-carrito-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const prod = productos.find(p => p.id === id);
      agregarProducto(prod, 1);                         // <- usa (producto, cantidad)
      mostrarToast("Producto agregado al carrito!");
      actualizarCarritoContador();
      onUpdate();                                       // <- re-render del grid actual
      mostrarBarraCarrito();
    };
  });

  // Quitar (trash)
  contenedor.querySelectorAll(".btn-carrito-trash").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      eliminarProducto(id);
      actualizarCarritoContador();
      onUpdate();
      mostrarBarraCarrito();
    };
  });

  // Menos (–)
  contenedor.querySelectorAll(".btn-carrito-menos").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const enCarrito = getCarrito().find(p => p.id === id);
      if (enCarrito && enCarrito.cantidad > 1) {
        actualizarCantidad(id, enCarrito.cantidad - 1);
        actualizarCarritoContador();
        onUpdate();
        mostrarBarraCarrito();
      }
    };
  });

  // Más (+)
  contenedor.querySelectorAll(".btn-carrito-mas").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const prod = productos.find(p => p.id === id);
      const enCarrito = getCarrito().find(p => p.id === id);
      const actual = enCarrito ? enCarrito.cantidad : 0;
      if (actual < (prod.stock ?? Infinity)) {
        actualizarCantidad(id, actual + 1);
        actualizarCarritoContador();
        onUpdate();
        mostrarBarraCarrito();
      } else {
        mostrarToast("No hay más stock disponible", "danger");
      }
    };
  });

  // Enter en el input → setear cantidad
  contenedor.querySelectorAll(".cantidad-input").forEach(input => {
    input.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const id = input.getAttribute("data-id");
      const prod = productos.find(p => p.id === id);
      let val = parseInt(input.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (prod.stock != null && val > prod.stock) {
        val = prod.stock;
        mostrarToast("Solo hay " + prod.stock + " en stock.", "danger");
      }
      actualizarCantidad(id, val);
      actualizarCarritoContador();
      onUpdate();
      mostrarBarraCarrito();
    };
  });
}

// --- RENDER DE PRODUCTOS MÁS VENDIDOS ---
async function renderMasVendidos() {
  const contenedor = document.getElementById("productos-mas-vendidos");
  if (!contenedor) return;
  const productos = await getMasVendidos(8);
  renderCardsUnificado(contenedor, productos, () => renderMasVendidos());
}


// --- LISTENERS PARA LOS CONTROLES DINÁMICOS ---
function asignarListenersMasVendidos(productos, contenedor) {
  contenedor.querySelectorAll(".agregar-carrito-btn").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const prod = productos.find(p => p.id === id);
      agregarProducto(prod, 1);
      mostrarToast("Producto agregado al carrito!");
      actualizarCarritoContador();
      renderMasVendidos();
      mostrarBarraCarrito();
    };
  });
  contenedor.querySelectorAll(".btn-carrito-trash").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      eliminarProducto(id);
      actualizarCarritoContador();
      renderMasVendidos();
      mostrarBarraCarrito();
    };
  });
  contenedor.querySelectorAll(".btn-carrito-menos").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      let carrito = getCarrito();
      const prod = carrito.find(p => p.id === id);
      if (prod.cantidad > 1) {
        actualizarCantidad(id, prod.cantidad - 1);
        actualizarCarritoContador();
        renderMasVendidos();
        mostrarBarraCarrito();
      }
    };
  });
  contenedor.querySelectorAll(".btn-carrito-mas").forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const prod = productos.find(p => p.id === id);
      let carrito = getCarrito();
      const enCarrito = carrito.find(p => p.id === id);
      if (enCarrito.cantidad < prod.stock) {
        actualizarCantidad(id, enCarrito.cantidad + 1);
        actualizarCarritoContador();
        renderMasVendidos();
        mostrarBarraCarrito();
      } else {
        mostrarToast("No hay más stock disponible", "danger");
      }
    };
  });
  contenedor.querySelectorAll(".cantidad-input").forEach(input => {
    input.onkeydown = e => {
      if (e.key === "Enter") {
        const id = input.getAttribute("data-id");
        const prod = productos.find(p => p.id === id);
        let val = parseInt(input.value);
        if (val < 1) val = 1;
        if (val > prod.stock) {
          val = prod.stock;
          mostrarToast("Solo hay " + prod.stock + " en stock.", "danger");
        }
        actualizarCantidad(id, val);
        actualizarCarritoContador();
        renderMasVendidos();
        mostrarBarraCarrito();
      }
    };
  });
}

// --- BARRA LATERAL DE CARRITO ---
function mostrarBarraCarrito() {
  const barra = document.getElementById("barra-carrito");
  if (!barra) return;
  const carrito = getCarrito();

  const isDesktop = window.innerWidth >= 992;

  // Si no hay items, cerramos siempre
  if (!carrito.length) {
    barra.innerHTML = "";
    barra.style.display = "none";
    document.body.style.marginRight = "0";
    barraAbierta = false;
    return;
  }

  const width = isDesktop ? Math.min(370, Math.floor(window.innerWidth * 0.9)) : window.innerWidth;
  const height = "100vh";

  // En escritorio, si hay items, dejar abierta
  if (isDesktop && carrito.length) barraAbierta = true;


  const total = carrito.reduce((a, p) => a + p.precio * p.cantidad, 0).toLocaleString("es-AR");

  barra.innerHTML = `
    <div style="
      position:fixed; top:0; right:0;
      height:${height}; width:${width}px;
      background:#fff; box-shadow:-2px 0 8px #aaa;
      display:flex; flex-direction:column; z-index:1040;">
      <div class="d-flex align-items-center justify-content-between p-3 border-bottom">
        <div class="fw-bold"><i class="bi bi-cart me-2"></i> Tu carrito</div>
        ${!isDesktop ? `<button class="btn-close barra-cerrar" aria-label="Cerrar"></button>` : ""}
      </div>
      <div class="flex-grow-1 overflow-auto p-3">
        ${carrito.map(prod => `
          <div class="d-flex align-items-center mb-3">
            <img src="${prod.imagen1 || ""}" alt="${prod.nombre}" style="width:60px;height:60px;object-fit:contain" class="me-2">
            <div class="flex-grow-1">
              <div class="small text-muted">${prod.marca || ""}</div>
              <div class="fw-semibold">${prod.nombre}</div>
              <div class="text-muted small">${prod.peso || ""} ${prod.unidad || ""}</div>
              <div class="text-muted small">Precio: $${Number(prod.precio).toLocaleString("es-AR")}</div>
            </div>
            <div class="d-flex align-items-center">
              <div class="btn-group me-2" style="min-width:120px">
                <button class="btn btn-outline-secondary btn-sm barra-menos" data-id="${prod.id}">–</button>
                <input type="number" min="1" max="${prod.stock}" value="${prod.cantidad}" data-id="${prod.id}"
                  class="form-control form-control-sm text-center barra-cant" style="width:45px;">
                <button class="btn btn-outline-secondary btn-sm barra-mas" data-id="${prod.id}">+</button>
              </div>
              <button class="btn btn-danger btn-sm barra-del ms-2" data-id="${prod.id}" title="Eliminar">
                <i class="bi bi-x"></i>
              </button>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="p-3 border-top">
        <div class="fw-bold mb-2">Total: $${total}</div>
        <a href="comprar.html" class="btn btn-success w-100">Comprar</a>
      </div>
    </div>
  `;

  // Mostrar/ocultar
  if (barraAbierta) {
    barra.style.display = "block";
    document.body.style.marginRight = `${width}px`;
  } else {
    barra.style.display = "none";
    document.body.style.marginRight = "0";
  }

  // Listeners
  const closeBtn = barra.querySelector(".barra-cerrar");
    if (closeBtn) closeBtn.addEventListener("click", () => {
    if (!isDesktop) { barraAbierta = false; mostrarBarraCarrito(); }
  });

  barra.querySelectorAll(".barra-menos").forEach(btn => {
    btn.onclick = () => { const id = btn.dataset.id; let carrito = getCarrito();
      const prod = carrito.find(p => p.id === id);
      if (prod && prod.cantidad > 1) { actualizarCantidad(id, prod.cantidad - 1); actualizarCarritoContador(); mostrarBarraCarrito(); renderMasVendidos?.(); }
    };
  });

  barra.querySelectorAll(".barra-mas").forEach(btn => {
    btn.onclick = () => { const id = btn.dataset.id; let carrito = getCarrito();
      const prod = carrito.find(p => p.id === id);
      if (prod && prod.cantidad < prod.stock) { actualizarCantidad(id, prod.cantidad + 1); actualizarCarritoContador(); mostrarBarraCarrito(); renderMasVendidos?.(); }
    };
  });

  barra.querySelectorAll(".barra-cant").forEach(inp => {
    inp.onchange = () => { const id = inp.dataset.id; let val = parseInt(inp.value) || 1;
      let carrito = getCarrito(); const prod = carrito.find(p => p.id === id);
      if (!prod) return; if (val < 1) val = 1; if (val > prod.stock) val = prod.stock;
      actualizarCantidad(id, val); actualizarCarritoContador(); mostrarBarraCarrito(); renderMasVendidos?.();
    };
  });

  barra.querySelectorAll(".barra-del").forEach(btn => {
    btn.onclick = () => { const id = btn.dataset.id;
      eliminarProducto(id); actualizarCarritoContador(); mostrarBarraCarrito(); renderMasVendidos?.();
    };
  });
}

//HELPERS

function abrirBarraCarrito() { barraAbierta = true; mostrarBarraCarrito(); }
function cerrarBarraCarrito() { barraAbierta = false; mostrarBarraCarrito(); }

// --- MENU CUENTA Y LOGIN ---
document.addEventListener('DOMContentLoaded', async () => {
  // CUENTA
  onUserStateChanged(async user => {
    const cuentaDropdown = document.getElementById("cuenta-dropdown");
    const loginForm = document.getElementById("form-login-dropdown");
    const userOptions = document.getElementById("user-options");
    const userEmailSpan = document.getElementById("user-email");
    const linkMisPedidos = document.getElementById("link-mis-pedidos");
    const linkMisDirecciones = document.getElementById("link-mis-direcciones");
    const linkMiCuenta = document.getElementById("link-mi-cuenta");
    const linkAdminPedidos = document.getElementById("link-admin-pedidos");
    const linkAdminProductos = document.getElementById("link-admin-productos");

    if (user) {
      const userData = await getUserData(user.uid);
      loginForm.style.display = "none";
      userOptions.style.display = "block";
      if (userEmailSpan) userEmailSpan.textContent = user.email;

      if (esAdmin(userData)) {
        if (linkMisPedidos) linkMisPedidos.style.display = "none";
        if (linkMisDirecciones) linkMisDirecciones.style.display = "none";
        if (linkMiCuenta) linkMiCuenta.style.display = "none";
        if (linkAdminPedidos) linkAdminPedidos.style.display = "block";
        if (linkAdminProductos) linkAdminProductos.style.display = "block";
      } else {
        if (linkMisPedidos) linkMisPedidos.style.display = "block";
        if (linkMisDirecciones) linkMisDirecciones.style.display = "block";
        if (linkMiCuenta) linkMiCuenta.style.display = "block";
        if (linkAdminPedidos) linkAdminPedidos.style.display = "none";
        if (linkAdminProductos) linkAdminProductos.style.display = "none";
      }
    } else {
      loginForm.style.display = "block";
      userOptions.style.display = "none";
      if (userEmailSpan) userEmailSpan.textContent = "";
    }
  });

  // LOGIN

  const form = document.getElementById("form-login-dropdown");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;
      try {
        await login(email, pass);
        location.reload();
      } catch (e) {
        mostrarToast("Usuario o contraseña inválidos", "danger");
      }
    };
  }

  /*
  const btnLogin = document.getElementById("btn-login");
  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      const email = document.getElementById("login-email").value;
      const pass = document.getElementById("login-password").value;
      try {
        await login(email, pass);
        location.reload();
      } catch (e) {
        mostrarToast("Usuario o contraseña inválidos", "danger");
      }
    });
  }*/

  // LOGOUT
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await logout();
      location.reload();
    });
  }

  // MÁS VENDIDOS
  renderMasVendidos();

  // BARRA CARRITO AL INICIO
  barraAbierta = window.innerWidth >= 992 && getCarrito().length > 0;
  mostrarBarraCarrito();


  // CONTADOR CARRITO AL INICIO
  actualizarCarritoContador();

});

const btnCarrito = document.getElementById('btn-carrito');
if (btnCarrito) {
  btnCarrito.addEventListener('click', () => {
    if (!getCarrito().length) {
      mostrarToast("Tu carrito está vacío", "info");
      return;
    }
    barraAbierta = !barraAbierta;
    mostrarBarraCarrito();
  });
}

// ==================== FILTRADO DINÁMICO ====================

function pesoEnGramos(peso, unidad) {
  const num = parseFloat(peso);
  if (isNaN(num)) return null;

  switch ((unidad || '').toLowerCase()) {
    case 'g':
    case 'gr':
    case 'gramos':
      return num;
    case 'kg':
    case 'k':
    case 'kilogramos':
      return num * 1000;
    case 'lb':
    case 'lbs':
    case 'libra':
    case 'libras':
      return num * 453.6;
    default:
      return null;
  }
}

function rangoPeso(gr) {
  if (gr === null) return 'Sin datos';
  if (gr <= 250) return '≤ 250g';
  if (gr <= 500) return '250g - 500g';
  if (gr <= 1000) return '500g - 1kg';
  return '> 1kg';
}

export function renderizarFiltros(productos, contenedorId) {
  const campos = ['marca', 'peso', 'subcategoria', 'sabor'];
  const contenedor = document.getElementById(contenedorId);
  contenedor.innerHTML = '';

  campos.forEach(campo => {
    const valoresUnicos = [...new Set(productos.map(p => {
      if (campo === 'peso') {
        const gr = pesoEnGramos(p.peso, p.unidad);
        return rangoPeso(gr);
      } else {
        return p[campo];
      }
    }).filter(Boolean))].sort();

    if (valoresUnicos.length > 0) {
      const divGrupo = document.createElement('div');
      divGrupo.classList.add('mb-3');

      const titulo = document.createElement('strong');
      titulo.classList.add('d-block', 'mb-1', 'text-capitalize');
      titulo.textContent = campo;
      divGrupo.appendChild(titulo);

      valoresUnicos.forEach(valor => {
        const id = `${campo}-${valor.replace(/\s+/g, '-')}`;
        const wrapper = document.createElement('div');
        wrapper.classList.add('form-check');

        const input = document.createElement('input');
        input.classList.add('form-check-input', 'filtro-checkbox');
        input.type = 'checkbox';
        input.dataset.campo = campo;
        input.value = valor;
        input.id = id;

        const label = document.createElement('label');
        label.classList.add('form-check-label');
        label.htmlFor = id;
        label.textContent = valor
          .split(' ')
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join(' ');

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        divGrupo.appendChild(wrapper);
      });

      contenedor.appendChild(divGrupo);
    }
  });
}

export function aplicarFiltros(productos) {
  const checkboxes = document.querySelectorAll('.filtro-checkbox:checked');
  const filtros = {};

  checkboxes.forEach(cb => {
    const campo = cb.dataset.campo;
    if (!filtros[campo]) filtros[campo] = [];
    filtros[campo].push(cb.value);
  });

  return productos.filter(p => {
    return Object.entries(filtros).every(([campo, valores]) => {
      if (campo === 'peso') {
        const gr = pesoEnGramos(p.peso, p.unidad);
        const rango = rangoPeso(gr);
        return valores.includes(rango);
      } else {
        return valores.includes(p[campo]);
      }
    });
  });
}

export function inicializarFiltrado(productos, renderFuncion, contenedorFiltro = 'filtros-contenedor') {
  renderizarFiltros(productos, contenedorFiltro);
  document.getElementById(contenedorFiltro).addEventListener('change', () => {
    const productosFiltrados = aplicarFiltros(productos);
    renderFuncion(productosFiltrados);
  });
}

window.addEventListener('resize', () => {
  const isDesktop = window.innerWidth >= 992;
  const tieneItems = getCarrito().length > 0;
  if (isDesktop && tieneItems) barraAbierta = true;
  if (!tieneItems) barraAbierta = false;
  mostrarBarraCarrito();
});