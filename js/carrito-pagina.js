import { getCarrito, actualizarCantidad, eliminarProducto } from './carrito.js';

function render() {
  const carrito = getCarrito();
  const cont = document.getElementById("carrito-lista");
  const total = carrito.reduce((a, p) => a + p.precio * p.cantidad, 0);
  document.getElementById("carrito-total").textContent = "Total: $" + total;
  if (!carrito.length) {
    cont.innerHTML = "<div>El carrito está vacío.</div>";
    document.getElementById("btn-comprar").disabled = true;
    return;
  }
  document.getElementById("btn-comprar").disabled = false;
  cont.innerHTML = carrito.map((prod, i) => `
    <div class="d-flex align-items-center border p-2 mb-2">
      <img src="${prod.imagen1}" width="50" height="50" class="me-2 rounded" style="object-fit:cover">
      <div class="flex-grow-1">
        <b>${prod.nombre}</b><br>
        <span>$${prod.precio} x ${prod.cantidad} = $${prod.precio * prod.cantidad}</span>
      </div>
      <div>
        <button class="btn btn-outline-secondary btn-sm" data-menos="${prod.id}">-</button>
        <input type="number" min="1" value="${prod.cantidad}" class="mx-1 form-control d-inline-block cantidad-input" style="width:60px;" data-cant="${prod.id}">
        <button class="btn btn-outline-secondary btn-sm" data-mas="${prod.id}">+</button>
        <button class="btn btn-danger btn-sm ms-2" data-del="${prod.id}"><i class="bi bi-trash"></i></button>
      </div>
    </div>
  `).join("");

  // Listeners
  cont.querySelectorAll("[data-menos]").forEach(btn => btn.onclick = () => {
    const id = btn.dataset.menos;
    const item = carrito.find(x => x.id === id);
    if (item.cantidad > 1) {
      actualizarCantidad(id, item.cantidad - 1);
      render();
    }
  });
  cont.querySelectorAll("[data-mas]").forEach(btn => btn.onclick = () => {
    const id = btn.dataset.mas;
    const item = carrito.find(x => x.id === id);
    // (Opcional) Lógica de stock máximo
    actualizarCantidad(id, item.cantidad + 1);
    render();
  });
  cont.querySelectorAll("[data-del]").forEach(btn => btn.onclick = () => {
    eliminarProducto(btn.dataset.del);
    render();
  });
  cont.querySelectorAll("[data-cant]").forEach(input => {
    input.onchange = () => {
      let val = Math.max(1, parseInt(input.value));
      actualizarCantidad(input.dataset.cant, val);
      render();
    }
  });
}

render();

document.getElementById("btn-comprar").onclick = () => {
  // Solo usuarios logueados pueden comprar
  if (!localStorage.getItem("firebase:authUser:" + location.hostname + ":authUser")) {
    document.getElementById("carrito-msg").textContent = "Debes iniciar sesión para comprar.";
    setTimeout(() => location.href = "login.html", 1200);
    return;
  }
  location.href = "comprar.html";
};