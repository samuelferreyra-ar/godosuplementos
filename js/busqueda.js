import { obtenerProductosParaBusqueda } from './productos.js'; // Usá el método que ya tengas para traer productos

let fuse;
let productos = [];

async function initBuscador() {
  productos = await obtenerProductosParaBusqueda();
  fuse = new Fuse(productos, {
    keys: [
      { name: "nombre", weight: 0.65 },
      { name: "categoria", weight: 0.25 },
      { name: "descripcion", weight: 0.13 }
    ],
    threshold: 0.33,   // tolerancia al error (ajustá si querés)
    includeScore: false,
    minMatchCharLength: 2
  });

  const input = document.getElementById("godo-search-input");
  const sugerencias = document.getElementById("godo-search-suggestions");
  const form = document.getElementById("godo-search-form");

  // Mostrar sugerencias en tiempo real
  input.addEventListener("input", e => {
    const val = input.value.trim();
    if (val.length < 2) {
      sugerencias.style.display = "none";
      sugerencias.innerHTML = "";
      return;
    }
    const resultados = fuse.search(val, { limit: 7 });
    sugerencias.innerHTML = resultados.map(res => (
      `<li data-id="${res.item.id}">${res.item.nombre} <span class="text-muted small ms-1">${res.item.categoria}</span></li>`
    )).join("");
    sugerencias.style.display = resultados.length ? "block" : "none";
  });

  // Al hacer click en sugerencia
  sugerencias.addEventListener("click", e => {
    if (e.target.tagName === "LI") {
      const id = e.target.getAttribute("data-id");
      const prod = productos.find(p => p.id === id);
      if (prod) {
        // Redirigí a la página del producto (o resultados con filtro por producto)
        window.location.href = `resultados.html?q=${encodeURIComponent(prod.nombre)}`;
      }
    }
  });

  // Cerrar sugerencias si click afuera
  document.addEventListener("click", e => {
    if (!e.target.closest('.godo-searchbar-container')) {
      sugerencias.style.display = "none";
    }
  });

  // Submit con enter o lupa
  form.addEventListener("submit", e => {
    e.preventDefault();
    const q = input.value.trim();
    if (q.length >= 2) {
      window.location.href = `resultados.html?q=${encodeURIComponent(q)}`;
    }
  });
}

// Hacelo autoejecutarse (o exportalo y llamalo desde main.js cuando carguen productos)
initBuscador();

// Exportá función para refrescar productos (ej si cambia stock/catálogo)
export async function refrescarProductosBusqueda() {
  productos = await obtenerProductosParaBusqueda();
  fuse.setCollection(productos);
}