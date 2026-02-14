import { onUserStateChanged, getUserData, esAdmin } from './auth.js';
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast} from './ui.js';

let productos = [], editIdx = null;
let productoModal = null;

function render() {
  const cont = document.getElementById("productos-tabla");
  if (!productos.length) {
    cont.innerHTML = "<div>No hay productos.</div>";
    return;
  }
  cont.innerHTML = `
    <table class="table table-bordered table-sm align-middle">
      <thead><tr>
        <th>Nombre</th><th>Marca</th><th>Categoría</th><th>Subcat.</th><th>Sabor</th><th>Peso</th><th>Unidad</th><th>Precio</th><th>Stock</th><th>Imagen1</th><th>Imagen2</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${productos.map((p,i)=>`
          <tr>
            <td>${p.nombre}</td>
            <td>${p.marca}</td>
            <td>${p.categoria}</td>
            <td>${p.subcategoria}</td>
            <td>${p.sabor}</td>
            <td>${p.peso}</td>
            <td>${p.unidad}</td>
            <td>$${p.precio}</td>
            <td>${p.stock}</td>
            <td><img src="${p.imagen1}" width="40" height="40" style="object-fit:cover"></td>
            <td><img src="${p.imagen2}" width="40" height="40" style="object-fit:cover"></td>
            <td>
              <button class="btn btn-sm btn-secondary me-1" data-edit="${i}">Editar</button>
              <button class="btn btn-sm btn-danger" data-del="${i}">Borrar</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  cont.querySelectorAll("[data-edit]").forEach(btn => btn.onclick = () => mostrarForm(btn.dataset.edit));
  cont.querySelectorAll("[data-del]").forEach(btn => btn.onclick = async () => {
    const idx = +btn.dataset.del;
    if(confirm("¿Borrar este producto?")) {
      await deleteDoc(doc(db, "productos", productos[idx].id));
      productos.splice(idx,1);
      render();
    }
  });
}

function mostrarForm(idx = null) {
  editIdx = idx;

  // Título del modal
  document.getElementById("productoModalTitle").textContent =
    (idx !== null) ? "Editar producto" : "Agregar producto";

  const prod = idx !== null ? productos[idx] : {};

  ["id","nombre","marca","categoria","subcategoria","sabor","peso","unidad","precio","stock","desc","img1","img2"].forEach(f => {
    const k = f === "img1" ? "imagen1" : f === "img2" ? "imagen2" : f;
    document.getElementById("prod-" + f).value = prod?.[k] || "";
  });

  productoModal.show();
}

function ocultarForm() {
  // Limpieza opcional (no cambia el contenido, solo lo deja "en blanco")
  ["id","nombre","marca","categoria","subcategoria","sabor","peso","unidad","precio","stock","desc","img1","img2"].forEach(f=>{
    document.getElementById("prod-" + f).value = "";
  });

  productoModal.hide();
}

onUserStateChanged(async user => {
  if (!user) return location.href = "login.html";
  const userData = await getUserData(user.uid);
  if (!esAdmin(userData)) return location.href = "index.html";
  const snap = await getDocs(collection(db, "productos"));
  productos = [];
  snap.forEach(docu => productos.push({ id: docu.id, ...docu.data() }));
  render();
});

// Inicializar modal Bootstrap
productoModal = new bootstrap.Modal(document.getElementById("productoModal"), {
  backdrop: "static", // opcional: evita cerrar tocando afuera
  keyboard: false     // opcional: evita cerrar con ESC
});


document.getElementById("btn-nuevo-prod").onclick = () => mostrarForm();
document.getElementById("btn-cancelar-prod").onclick = ocultarForm;

document.getElementById('btn-guardar-prod').onclick = async function() {
  // Tomar los valores del formulario (¡con los IDs correctos!)
  const id = document.getElementById('prod-id').value; // vacío si es nuevo
  const nombre = document.getElementById('prod-nombre').value.trim();
  const marca = document.getElementById('prod-marca').value.trim();
  const categoria = document.getElementById('prod-categoria').value.trim();
  const subcategoria = document.getElementById('prod-subcategoria').value.trim();
  const sabor = document.getElementById('prod-sabor').value.trim();
  const peso = document.getElementById('prod-peso').value.trim();
  const unidad = document.getElementById('prod-unidad').value.trim();
  const precio = Number(document.getElementById('prod-precio').value);
  const stock = Number(document.getElementById('prod-stock').value);
  const descripcion = document.getElementById('prod-desc').value.trim(); // OJO acá
  const imagen1 = document.getElementById('prod-img1').value.trim();     // OJO acá
  const imagen2 = document.getElementById('prod-img2').value.trim();     // OJO acá

  const nombreOk    = !!nombre;
  const categoriaOk = !!categoria;
  // Ajustá las reglas a tu negocio:
  const precioOk    = Number.isFinite(precio) && precio > 0;   // >0 si no querés precios en 0
  const stockOk     = Number.isFinite(stock)  && stock >= 0;   // >=0 para permitir “sin stock”

  if (!nombreOk || !categoriaOk || !precioOk || !stockOk) {
    mostrarToast('Faltan datos obligatorios (revisá precio/stock)', 'danger');
    return;
  }

  // Armar el objeto producto
  const nuevoProducto = {
    nombre,
    marca,
    categoria,
    subcategoria,
    sabor,
    peso,
    unidad,
    precio,
    stock,
    descripcion,
    imagen1,
    imagen2,
  };

  try {
    if (id) {
      await actualizarProducto(id, nuevoProducto);
      mostrarToast('Producto actualizado', 'success');
    } else {
      await crearProducto(nuevoProducto);
      mostrarToast('Producto creado', 'success');
    }

    ocultarForm();

    setTimeout(() => {
    location.reload();
  }, 700); // 700 ms es tiempo suficiente para ver el mensaje

  } catch (e) {
    mostrarToast('Error al guardar el producto: ' + e.message, 'danger');
  }
};

// Crear producto
export async function crearProducto(producto) {
  await addDoc(collection(db, "productos"), producto);
}

// Actualizar producto
export async function actualizarProducto(id, producto) {
  await updateDoc(doc(db, "productos", id), producto);
}