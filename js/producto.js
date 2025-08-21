import { obtenerProductosParaBusqueda } from './productos.js'; // O la función que uses
import { agregarProducto, getCarrito, actualizarCantidad, eliminarProducto } from "./carrito.js"; // Tu lógica actual para el carrito
import { mostrarToast } from './ui.js';

// 1. Obtener ID de la URL
const params = new URLSearchParams(window.location.search);
const id = params.get('id');

if (!id) {
  document.body.innerHTML = "<div class='container my-5'><div class='alert alert-danger'>Producto no especificado.</div></div>";
  throw new Error("Sin ID de producto");
}

// 2. Buscar el producto y mostrarlo
(async () => {
  const productos = await obtenerProductosParaBusqueda();
  const prod = productos.find(p => p.id === id);
  if (!prod) {
    document.body.innerHTML = "<div class='container my-5'><div class='alert alert-warning'>Producto no encontrado.</div></div>";
    return;
  }

  // Nombre, marca, peso, etc
  document.querySelector('.producto-nombre').textContent = prod.nombre;
  document.querySelector('.producto-marca-peso').textContent =
    `${prod.categoria}${prod.marca ? " / " + prod.marca : ""} - ${prod.peso || ""} ${prod.unidad || ""}`;
  document.querySelector('.producto-precio').innerHTML =
    `<span class="godo-card-price">$${Number(prod.precio).toLocaleString('es-AR')}</span>`;
  document.querySelector('.producto-stock').innerHTML =
    (prod.stock > 0)
      ? `<span class="badge bg-success">Stock: ${prod.stock}</span>`
      : `<span class="badge bg-danger">Sin stock</span>`;
  document.querySelector('.producto-descripcion').textContent = prod.descripcion || '';

  // Imágenes
  const imagenes = [prod.imagen1, prod.imagen2].filter(Boolean);
  const imgsHtml = imagenes.map((src, i) => `
    <div class="carousel-item${i === 0 ? " active" : ""}">
      <img src="${src}" class="d-block w-100 rounded shadow" alt="Imagen ${i + 1}" style="background:#fff;object-fit:contain;height:320px;">
    </div>
  `).join('');
  document.getElementById('producto-imagenes').innerHTML = imgsHtml;

  // Control de cantidad
  const inputCantidad = document.getElementById('cantidad-input');
  const btnMas = document.getElementById('cantidad-mas');
  const btnMenos = document.getElementById('cantidad-menos');
  btnMas.onclick = () => {
    let val = parseInt(inputCantidad.value) || 1;
    if (val < prod.stock) inputCantidad.value = val + 1;
  };
  btnMenos.onclick = () => {
    let val = parseInt(inputCantidad.value) || 1;
    if (val > 1) inputCantidad.value = val - 1;
  };
  inputCantidad.oninput = () => {
    let val = parseInt(inputCantidad.value) || 1;
    if (val < 1) inputCantidad.value = 1;
    if (val > prod.stock) inputCantidad.value = prod.stock;
  };

  // Agregar al carrito (handler único para desktop y móvil)
function handleAddToCart() {
  const inputCantidad = document.getElementById('cantidad-input');
  const cant = parseInt(inputCantidad.value) || 1;
  if (cant < 1 || cant > prod.stock) {
    mostrarToast("Cantidad inválida.", "danger");
    return;
  }
  agregarProducto(prod, cant);
  mostrarToast("Producto agregado al carrito.", "success");
}

const btnDesktop = document.getElementById('agregar-carrito-btn');
if (btnDesktop) btnDesktop.onclick = handleAddToCart;

const btnSticky = document.getElementById('agregar-carrito-btn-sticky');
if (btnSticky) btnSticky.onclick = handleAddToCart;

})();
