import { getCarrito, vaciarCarrito } from './carrito.js';
import { onUserStateChanged, getUserData } from './auth.js';
import { guardarPedidoDescontandoStock } from './pedidos.js';

let userData, user;

onUserStateChanged(async u => {
  if (!u) return location.href = "login.html";
  user = u;
  userData = await getUserData(u.uid);
  mostrarCarrito();
  cargarDirecciones();
});

function mostrarCarrito() {
  const carrito = getCarrito();
  if (!carrito.length) {
    document.getElementById("comprar-lista").innerHTML = "<div>No hay productos en el carrito.</div>";
    document.getElementById("comprar-total").textContent = "$0";
    document.getElementById("btn-realizar-pedido").disabled = true;
    return;
  }
  document.getElementById("btn-realizar-pedido").disabled = false;
  document.getElementById("comprar-lista").innerHTML = carrito.map(p => `
    <div class="d-flex align-items-center border p-2 mb-2">
      <img src="${p.imagen1}" width="40" height="40" class="me-2 rounded" style="object-fit:cover">
      <div class="flex-grow-1">
        <b>${p.nombre}</b> x${p.cantidad} — $${p.precio} c/u
      </div>
      <div>
        $${p.precio * p.cantidad}
      </div>
    </div>
  `).join("");
  const total = carrito.reduce((a, p) => a + p.precio * p.cantidad, 0);
  document.getElementById("comprar-total").textContent = "$" + total;
}

function cargarDirecciones() {
  const direcciones = userData?.direcciones || [];
  const select = document.getElementById("direccion-select");
  select.innerHTML = direcciones.map((d, i) =>
    `<option value="${i}">${d.calle} ${d.numero}, ${d.localidad} (${d.provincia})</option>`
  ).join("");
}

document.getElementById("btn-realizar-pedido").onclick = async () => {
  const carrito = getCarrito();
  if (!carrito.length) return;
  const dirIdx = document.getElementById("direccion-select").value;
  const direccion = userData?.direcciones?.[dirIdx] || null;
  const metodoEntrega = document.getElementById("entrega-select").value;
  const metodoPago = document.getElementById("pago-select").value;
  const pedido = {
    usuario: {
      email: user.email,
      nombre: userData?.nombre || "",
      telefono: userData?.telefono || "",
      uid: user.uid
    },
    numero_pedido: Date.now(),
    fecha: new Date().toISOString(),
    estado: "recibido",
    direccion: direccion,
    productos: carrito,
    metodo_entrega: metodoEntrega,
    metodo_pago: metodoPago
  };
  try {
    await guardarPedidoDescontandoStock(pedido);
    vaciarCarrito();
    document.getElementById("compra-msg").innerHTML = `<div class="alert alert-success">¡Pedido realizado con éxito! Redirigiendo...</div>`;
    setTimeout(()=>location.href="index.html",1500);
  } catch (e) {
    document.getElementById("compra-msg").innerHTML = `<div class="alert alert-danger">Error al crear el pedido: ${e.message}</div>`;
  }
};