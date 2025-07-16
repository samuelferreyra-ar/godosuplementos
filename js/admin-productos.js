import { onUserStateChanged, getUserData, esAdmin } from './auth.js';
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast} from './ui.js';

let productos = [], editIdx = null;

function render() {
  const cont = document.getElementById("productos-tabla");
  if (!productos.length) {
    cont.innerHTML = "<div>No hay productos.</div>";
    return;
  }
  cont.innerHTML = `
    <table class="table table-bordered table-sm align-middle">
      <thead><tr>
        <th>Nombre</th><th>Marca</th><th>Categoría</th><th>Subcat.</th><th>Peso</th><th>Unidad</th><th>Precio</th><th>Stock</th><th>Imagen1</th><th>Imagen2</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${productos.map((p,i)=>`
          <tr>
            <td>${p.nombre}</td>
            <td>${p.marca}</td>
            <td>${p.categoria}</td>
            <td>${p.subcategoria}</td>
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
  document.getElementById("form-producto").style.display = "";
  const prod = idx!==null ? productos[idx] : {};
  ["id","nombre","marca","categoria","subcategoria","peso","unidad","precio","stock","desc","img1","img2"].forEach(f=>{
    const k = f==="img1"?"imagen1":f==="img2"?"imagen2":f;
    document.getElementById("prod-"+f).value = prod?.[k] || "";
  });
}

function ocultarForm() {
  document.getElementById("form-producto").style.display = "none";
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

document.getElementById("btn-nuevo-prod").onclick = () => mostrarForm();
document.getElementById("btn-cancelar-prod").onclick = ocultarForm;

document.getElementById('btn-guardar-prod').onclick = async function() {
  // Tomar los valores del formulario (¡con los IDs correctos!)
  const id = document.getElementById('prod-id').value; // vacío si es nuevo
  const nombre = document.getElementById('prod-nombre').value.trim();
  const marca = document.getElementById('prod-marca').value.trim();
  const categoria = document.getElementById('prod-categoria').value.trim();
  const subcategoria = document.getElementById('prod-subcategoria').value.trim();
  const peso = document.getElementById('prod-peso').value.trim();
  const unidad = document.getElementById('prod-unidad').value.trim();
  const precio = Number(document.getElementById('prod-precio').value);
  const stock = Number(document.getElementById('prod-stock').value);
  const descripcion = document.getElementById('prod-desc').value.trim(); // OJO acá
  const imagen1 = document.getElementById('prod-img1').value.trim();     // OJO acá
  const imagen2 = document.getElementById('prod-img2').value.trim();     // OJO acá

  // Validación básica
  if (!nombre || !categoria || !precio || !stock) {
    mostrarToast('Faltan datos obligatorios', 'danger');
    return;
  }

  // Armar el objeto producto
  const nuevoProducto = {
    nombre,
    marca,
    categoria,
    subcategoria,
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
    // Opcional: cerrá el form/modal, refrescá la lista, etc.
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