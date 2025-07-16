import { obtenerProductosParaBusqueda } from './productos.js';

export async function mostrarCategoria(nombreCategoria) {
  const productos = await obtenerProductosParaBusqueda();
  // Buscá por categoría (ajusta para matchear nombre exacto)
  const resultados = productos.filter(p => 
    (p.categoria || '').toLowerCase().replace(/á/g, "a").replace(/í/g, "i") === nombreCategoria.toLowerCase()
  );
  const cont = document.getElementById("categoria-lista");
  const vacio = document.getElementById("categoria-vacio");

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

  // Click en card para ir a la página del producto
  document.querySelectorAll('.godo-card').forEach(card => {
    card.addEventListener("click", function () {
      const id = this.getAttribute('data-id');
      if (id) window.location.href = `producto.html?id=${id}`;
    });
  });
}