import { obtenerProductosParaBusqueda } from './productos.js';

const params = new URLSearchParams(window.location.search);
const q = params.get('q') || "";

document.getElementById('res-busqueda').textContent = q;

// Función autoejecutable
(async () => {
  const productos = await obtenerProductosParaBusqueda();
  // Si hay una búsqueda, usamos Fuse.js para búsqueda difusa
  let resultados = [];
  if (q && typeof Fuse !== "undefined") {
    const fuse = new Fuse(productos, {
      keys: ["nombre", "categoria", "descripcion"],
      threshold: 0.35
    });
    resultados = fuse.search(q).map(r => r.item);
  } else if (q) {
    // Si no hay Fuse, filtrado simple por nombre/categoria/desc
    resultados = productos.filter(p =>
      (p.nombre && p.nombre.toLowerCase().includes(q.toLowerCase())) ||
      (p.categoria && p.categoria.toLowerCase().includes(q.toLowerCase())) ||
      (p.descripcion && p.descripcion.toLowerCase().includes(q.toLowerCase()))
    );
  }

  const cont = document.getElementById("resultados-lista");
  const vacio = document.getElementById("resultados-vacio");

  if (resultados.length) {
    cont.innerHTML = resultados.map(prod => `
      <div class="col-12 col-sm-6 col-md-4 d-flex">
        <div class="godo-card w-100" data-id="${prod.id}" style="cursor:pointer;">
          <img src="${prod.imagen1}" class="godo-card-img" alt="${prod.nombre}">
          <div class="px-3 pt-2 pb-1 flex-grow-1 d-flex flex-column">
            <div class="godo-card-title">${prod.nombre}</div>
            <div class="godo-card-price">$${Number(prod.precio).toLocaleString('es-AR')}</div>
          </div>
        </div>
      </div>
    `).join("");
    vacio.style.display = "none";
  } else {
    cont.innerHTML = "";
    vacio.style.display = "block";
  }

  // Asignar el click a cada card para ir al detalle del producto
  document.querySelectorAll('.godo-card').forEach(card => {
    card.addEventListener("click", function (e) {
      const id = this.getAttribute('data-id');
      if (id) {
        window.location.href = `producto.html?id=${id}`;
      } else {
        alert("Error: este producto no tiene ID.");
      }
    });
  });
})();
