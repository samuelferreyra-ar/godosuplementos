import { agregarAlCarritoLocal, getCarritoLocal, setCantidadProducto, sincronizarCarritoConFirestore, cargarCarritoDesdeFirestore } from './carrito.js';
import { db, auth } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { detectarUsuario, cerrarSesion, loginUsuario } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {

  // =============================
  //   RENDER PRODUCTOS DINÁMICOS
  // =============================
  
  const productosContenedor = document.getElementById("productos-mas-vendidos");
if (productosContenedor) {
  const productosSnap = await getDocs(collection(db, "productos"));
  let productos = [];
  productosSnap.forEach(doc => {
    const data = doc.data();
    if (data.stock > 0) {
      productos.push({ id: doc.id, ...data });
    }
  });
  productos = shuffleArray(productos).slice(0, 8);

  // 1. Render tarjetas
  productosContenedor.innerHTML = productos.map(producto => {
    const carrito = getCarritoLocal();
    const itemEnCarrito = carrito.find(x => x.id === producto.id);
    const cantidad = itemEnCarrito ? itemEnCarrito.cantidad : 0;
    return `
      <div class="col-6 col-md-3">
        <div class="product-card h-100 p-2 d-flex flex-column justify-content-between" data-id="${producto.id}">
          <img src="${producto.imagen1}" class="img-fluid mb-2" alt="${producto.nombre}" />
          <h5>${producto.nombre}</h5>
          <p class="text-muted">${producto.categoria}</p>
          <h4 class="fw-bold text-primary">$${producto.precio.toLocaleString('es-AR')}</h4>

          <button class="btn btn-godo-yellow w-100 py-2 agregar-carrito" data-id="${producto.id}" style="${cantidad > 0 ? 'display:none;' : ''}">
            Agregar al carrito
          </button>
          <div class="carrito-cantidad-control d-flex justify-content-center align-items-center my-1" style="${cantidad > 0 ? '' : 'display:none;'}">
            <button class="btn btn-outline-secondary btn-restar" type="button">-</button>
            <input type="text" class="form-control mx-1 cantidad-input" value="${cantidad || 1}">
            <button class="btn btn-outline-secondary btn-sumar" type="button">+</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 2. Asignar listeners para cada tarjeta
      productos.forEach(producto => {
        const card = productosContenedor.querySelector(`.product-card[data-id="${producto.id}"]`);
        if (!card) return;

        const btnAgregar = card.querySelector('.agregar-carrito');
        const controlCantidad = card.querySelector('.carrito-cantidad-control');
        const inputCantidad = card.querySelector('.cantidad-input');
        const btnSumar = card.querySelector('.btn-sumar');
        const btnRestar = card.querySelector('.btn-restar');

        // --- Agregar al carrito
        if (btnAgregar) {
          btnAgregar.onclick = () => {
            agregarAlCarritoLocal(producto.id, 1);
            btnAgregar.style.display = "none";
            controlCantidad.style.display = "";
            inputCantidad.value = 1;
            // Animación
            controlCantidad.classList.add("added-flash");
            setTimeout(() => controlCantidad.classList.remove("added-flash"), 500);
            // Toast
            mostrarToastAgregado();
            actualizarDropdownCarrito();
            actualizarContadorCarrito();
          };
        }

        // --- Sumar
        btnSumar.onclick = () => {
          let cantidad = parseInt(inputCantidad.value) || 1;
          cantidad++;
          inputCantidad.value = cantidad;
          agregarAlCarritoLocal(producto.id, cantidad);
          controlCantidad.classList.add("added-flash");
          setTimeout(() => controlCantidad.classList.remove("added-flash"), 400);
          actualizarDropdownCarrito();
          actualizarContadorCarrito();
        };

        // --- Restar
        btnRestar.onclick = () => {
          let cantidad = parseInt(inputCantidad.value) || 1;
          cantidad--;
          if (cantidad <= 0) {
            // Quitar del carrito y volver a mostrar botón agregar
            agregarAlCarritoLocal(producto.id, 0);
            controlCantidad.style.display = "none";
            btnAgregar.style.display = "";
          } else {
            inputCantidad.value = cantidad;
            agregarAlCarritoLocal(producto.id, cantidad);
            controlCantidad.classList.add("added-flash");
            setTimeout(() => controlCantidad.classList.remove("added-flash"), 400);
          }
          actualizarDropdownCarrito();
          actualizarContadorCarrito();
        };

        // --- Cambiar cantidad manualmente
        inputCantidad.onblur = () => {
          let cantidad = parseInt(inputCantidad.value) || 1;
          if (cantidad <= 0) {
            agregarAlCarritoLocal(producto.id, 0);
            controlCantidad.style.display = "none";
            btnAgregar.style.display = "";
          } else {
            inputCantidad.value = cantidad;
            agregarAlCarritoLocal(producto.id, cantidad);
            controlCantidad.classList.add("added-flash");
            setTimeout(() => controlCantidad.classList.remove("added-flash"), 400);
          }
          actualizarDropdownCarrito();
          actualizarContadorCarrito();
        };
      });
    }

  // =============================
  //     DROPDOWN DEL CARRITO
  // =============================
  const carritoBtn = document.getElementById("btn-carrito");
  if (carritoBtn) {
    carritoBtn.addEventListener("mouseenter", actualizarDropdownCarrito);
  }

  // =============================
  //     BOTÓN "CUENTA" Y DROPDOWN
  // =============================

  const cuentaBtn = document.getElementById("btn-cuenta");
  const cuentaDropdown = document.getElementById("cuenta-dropdown");

  detectarUsuario((user) => {
    if (!cuentaBtn || !cuentaDropdown) return;

    if (user) {
      cuentaBtn.classList.remove("btn-godo-blue");
      cuentaBtn.classList.add("btn-success");
      cuentaBtn.classList.add("square-btn");
      cuentaBtn.innerHTML = `<i class="bi bi-person"></i>`;

      cuentaDropdown.innerHTML = `
        <div class="dropdown-header fw-bold text-success">${user.email}</div>
        <a class="dropdown-item" href="mis-datos.html">Mis datos</a>
        <a class="dropdown-item" href="mis-direcciones.html">Mis direcciones</a>
        <a class="dropdown-item" href="mis-pedidos.html">Mis pedidos</a>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item text-danger" id="btn-cerrar-sesion">Cerrar sesión</button>
      `;
      document.getElementById("btn-cerrar-sesion").onclick = cerrarSesion;
    } else {
      cuentaBtn.classList.remove("btn-success");
      cuentaBtn.classList.add("btn-godo-blue");
      cuentaBtn.classList.add("square-btn");
      cuentaBtn.innerHTML = `<i class="bi bi-person"></i>`;
      cuentaDropdown.innerHTML = `
        <div class="dropdown-header">Inicie sesión para acceder a su cuenta.</div>
        <form class="px-4 py-3">
          <div class="mb-3">
            <input type="email" class="form-control" id="login-email" placeholder="Correo electrónico">
          </div>
          <div class="mb-3">
            <input type="password" class="form-control" id="login-password" placeholder="Contraseña">
          </div>
          <button type="button" class="btn btn-primary w-100" id="btn-login">Iniciar sesión</button>
          <a href="registro.html" class="btn btn-link w-100">Nuevo usuario</a>
        </form>
      `;
      document.getElementById("btn-login").onclick = () => {
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-password").value;
        loginUsuario(email, pass);
      }
    }
  });

    actualizarContadorCarrito();

}); // Fin de DOMContentLoaded

// ========= FUNCIONES AUXILIARES =========

//Toast de agregado al carrito

function mostrarToastAgregado() {
  const toast = document.getElementById("toast-agregado");
  if (!toast) return;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 1200);
}

// Mezcla un array (Fisher-Yates)
function shuffleArray(array) {
  return array.map(value => ({ value, sort: Math.random() }))
              .sort((a, b) => a.sort - b.sort)
              .map(({ value }) => value);
}

//Función de actualización del contador del carrito

function actualizarContadorCarrito() {
  const carrito = getCarritoLocal();
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0);
  const badge = document.getElementById("carrito-contador");
  if (badge) {
    badge.textContent = totalItems;
    badge.style.display = totalItems > 0 ? "inline-block" : "none";
  }
}

// Renderiza el dropdown del carrito
async function actualizarDropdownCarrito() {
  const dropdown = document.getElementById("carrito-dropdown");
  const carrito = getCarritoLocal();

  if (!dropdown) return;

  if (carrito.length === 0) {
    dropdown.innerHTML = `<div class="text-center text-muted">Tu carrito está vacío.</div>`;
    return;
  }

  let productosSnap = await getDocs(collection(db, "productos"));
  let productos = [];
  productosSnap.forEach(docu => productos.push({id: docu.id, ...docu.data()}));

  let html = "";
  carrito.forEach(item => {
    const prod = productos.find(p => p.id === item.id);
    if (!prod) return;
    html += `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <img src="${prod.imagen1}" width="40" height="40"/>
        <span class="mx-2">${prod.nombre}</span>
        <div class="d-flex">
          <button class="btn btn-sm btn-outline-secondary btn-restar" data-id="${prod.id}">-</button>
          <span class="px-2">${item.cantidad}</span>
          <button class="btn btn-sm btn-outline-secondary btn-sumar" data-id="${prod.id}">+</button>
        </div>
      </div>
    `;
  });

  html += `<button class="btn btn-success w-100 mt-2" id="btn-comprar">COMPRAR</button>
          <button class="btn btn-outline-primary w-100 mt-2" id="btn-ver-carrito">Ver carrito</button>`;
  dropdown.innerHTML = html;

  // Listeners para sumar/restar cantidades
  dropdown.querySelectorAll(".btn-sumar").forEach(btn => {
    btn.onclick = () => {
      setCantidadProducto(btn.dataset.id, getCarritoLocal().find(x=>x.id===btn.dataset.id).cantidad+1);
      actualizarDropdownCarrito();
      actualizarContadorCarrito();
    };
  });
  dropdown.querySelectorAll(".btn-restar").forEach(btn => {
    btn.onclick = () => {
      setCantidadProducto(btn.dataset.id, getCarritoLocal().find(x=>x.id===btn.dataset.id).cantidad-1);
      actualizarDropdownCarrito();
      actualizarContadorCarrito();
    };
  });
  // Comprar
  dropdown.querySelector("#btn-comprar").onclick = () => {
    if (!auth.currentUser) {
      window.location.href = "login.html";
    } else {
      window.location.href = "comprar.html";
    }
  };
  // Ver carrito
  dropdown.querySelector("#btn-ver-carrito").onclick = () => {
    window.location.href = "carrito.html";
  };

  actualizarContadorCarrito();

}

// Sincronización del carrito al loguear
onAuthStateChanged(auth, async (user) => {
  if (user) {
    await sincronizarCarritoConFirestore(user);
    await cargarCarritoDesdeFirestore(user);
    actualizarDropdownCarrito();
    actualizarContadorCarrito();
  }
});
