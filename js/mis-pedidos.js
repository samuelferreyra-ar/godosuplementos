import { onUserStateChanged, getUserData } from './auth.js';
import { getPedidosUsuario } from './pedidos.js';

document.addEventListener('DOMContentLoaded', () => {
  onUserStateChanged(async user => {
    if (!user) return location.href = "login.html";
    const pedidos = await getPedidosUsuario(user.email);
    const cont = document.getElementById("pedidos-lista");
    if (!pedidos.length) return cont.innerHTML = "<div>No tienes pedidos aún.</div>";
    cont.innerHTML = pedidos.map((p, i) => `
      <div class="accordion-item">
        <h2 class="accordion-header" id="head${i}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#body${i}">
            #${p.numero_pedido} | ${new Date(p.fecha).toLocaleDateString()} | ${p.productos.length} productos | $${p.productos.reduce((a,x)=>a+x.precio*x.cantidad,0)} | ${p.estado}
          </button>
        </h2>
        <div id="body${i}" class="accordion-collapse collapse" data-bs-parent="#pedidos-lista">
          <div class="accordion-body">
            <b>Método de entrega:</b> ${p.metodo_entrega || '-'}<br>
            <b>Método de pago:</b> ${p.metodo_pago || '-'}<br>
            <hr>
            <b>Productos:</b>
            <ul>
              ${p.productos.map(prod => `
                <li>${prod.nombre} x${prod.cantidad} — $${prod.precio} c/u</li>
              `).join("")}
            </ul>
            <b>Dirección:</b> ${p.direccion || '-'}
          </div>
        </div>
      </div>
    `).join("");
  });
});