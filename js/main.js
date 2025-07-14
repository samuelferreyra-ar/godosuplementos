import { onUserStateChanged, getUserData, esAdmin, logout, login } from "./auth.js";
import { getMasVendidos } from "./productos.js";
import { agregarProducto, getCarrito, actualizarCantidad, eliminarProducto } from "./carrito.js";
import { mostrarToast } from "./ui.js";

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
function renderControlCantidad(producto, enCarrito) {
  if (!enCarrito) {
    return `<button class="btn btn-success agregar-carrito-btn" data-id="${producto.id}">Agregar al carrito</button>`;
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

// --- RENDER DE PRODUCTOS MÁS VENDIDOS ---
async function renderMasVendidos() {
  const contenedor = document.getElementById("productos-mas-vendidos");
  if (!contenedor) return;
  const productos = await getMasVendidos(8);
  const carrito = getCarrito();
  contenedor.innerHTML = productos.map(prod =>
    `<div class="col-12 col-sm-6 col-md-3">
      <div class="card h-100 text-center">
        <img src="${prod.imagen1}" class="card-img-top" style="max-height:150px;object-fit:cover;">
        <div class="card-body">
          <h5 class="card-title">${prod.nombre}</h5>
          <div>${prod.categoria}</div>
          <div class="my-2 fw-bold">$${prod.precio}</div>
          ${renderControlCantidad(prod, carrito.find(p => p.id === prod.id))}
        </div>
      </div>
    </div>`
  ).join("");
  asignarListenersMasVendidos(productos, contenedor);
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
  const barra = document.getElementById('barra-carrito');
  if (!barra) return;
  const carrito = getCarrito();
  if (!carrito.length) {
    barra.innerHTML = '';
    barra.style.display = 'none';
    document.body.style.marginRight = '0';
    return;
  }
  barra.style.display = 'block';
  document.body.style.marginRight = '370px';
  const total = carrito.reduce((a,p)=>a+p.precio*p.cantidad,0);
  barra.innerHTML = `
    <div style="
      position:fixed; top:0; right:0; height:100vh; width:370px; background:#fff; box-shadow:-2px 0 8px #aaa;
      z-index:1100; display:flex; flex-direction:column;">
      <div class="p-3 border-bottom fw-bold fs-5">Mi carrito</div>
      <div class="flex-grow-1 overflow-auto">
        ${carrito.map(prod=>`
          <div class="d-flex align-items-center border-bottom p-2">
            <img src="${prod.imagen1}" width="42" height="42" class="rounded me-2" style="object-fit:cover">
            <div class="flex-grow-1">
              <b>${prod.nombre}</b>
              <div class="small">x${prod.cantidad} – $${prod.precio * prod.cantidad}</div>
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
}

// --- MENU CUENTA Y LOGIN ---
document.addEventListener('DOMContentLoaded', async () => {
  // CUENTA
  onUserStateChanged(async user => {
    const cuentaDropdown = document.getElementById("cuenta-dropdown");
    const loginForm = document.getElementById("login-form");
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
  }

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
  mostrarBarraCarrito();

  // CONTADOR CARRITO AL INICIO
  actualizarCarritoContador();

});