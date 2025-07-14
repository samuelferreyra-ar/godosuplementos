import { onUserStateChanged, getUserData, esAdmin } from './auth.js';
import { getUltimosPedidos, cambiarEstadoPedido } from './pedidos.js';

document.addEventListener('DOMContentLoaded', () => {
  onUserStateChanged(async user => {
    if (!user) return location.href = "login.html";
    const userData = await getUserData(user.uid);
    if (!esAdmin(userData)) return location.href = "index.html";
    const pedidos = await getUltimosPedidos(50);
    const cont = document.getElementById("admin-pedidos-lista");
    if (!pedidos.length) return cont.innerHTML = "<div>No hay pedidos.</div>";
    cont.innerHTML = pedidos.map((p, i) => `
      <div class="accordion-item">
        <h2 class="accordion-header" id="head${i}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#body${i}">
            #${p.numero_pedido} | ${new Date(p.fecha).toLocaleDateString()} | ${p.productos.length} productos | $${p.productos.reduce((a,x)=>a+x.precio*x.cantidad,0)} | <b>${p.estado}</b>
          </button>
        </h2>
        <div id="body${i}" class="accordion-collapse collapse" data-bs-parent="#admin-pedidos-lista">
          <div class="accordion-body">
            <b>Cliente:</b> ${p.usuario?.nombre || "-"}<br>
            <b>Email:</b> ${p.usuario?.email || "-"}<br>
            <b>Teléfono:</b> ${p.usuario?.telefono || "-"}<br>
            <b>Dirección:</b> ${p.direccion ? 
              (p.direccion.calle + " " + p.direccion.numero + ", " + p.direccion.localidad) : "-"}<br>
            <b>Método de entrega:</b> ${p.metodo_entrega || '-'}<br>
            <b>Método de pago:</b> ${p.metodo_pago || '-'}<br>
            <hr>
            <b>Productos:</b>
            <ul>
              ${p.productos.map(prod => `
                <li>${prod.nombre} x${prod.cantidad} — $${prod.precio} c/u</li>
              `).join("")}
            </ul>
            <hr>
            <label for="estado${i}" class="me-2">Estado:</label>
            <select id="estado${i}" data-id="${p.id}" class="form-select d-inline-block w-auto">
              <option value="recibido" ${p.estado==="recibido"?"selected":""}>Recibido</option>
              <option value="preparando" ${p.estado==="preparando"?"selected":""}>Preparando</option>
              <option value="entregado" ${p.estado==="entregado"?"selected":""}>Entregado</option>
              <option value="cancelado" ${p.estado==="cancelado"?"selected":""}>Cancelado</option>
            </select>
            <span id="msg-estado${i}" class="ms-3"></span>
          </div>
        </div>
      </div>
    `).join("");

    // Listeners para cambio de estado
    pedidos.forEach((p, i) => {
      const sel = document.getElementById(`estado${i}`);
      const msg = document.getElementById(`msg-estado${i}`);
      sel.onchange = async () => {
        try {
          await cambiarEstadoPedido(p.id, sel.value);
          msg.textContent = "Estado actualizado!";
          msg.className = "text-success ms-3";
          setTimeout(()=>{msg.textContent="";},1200);
        } catch (e) {
          msg.textContent = "Error!";
          msg.className = "text-danger ms-3";
        }
      };
    });
  });
});