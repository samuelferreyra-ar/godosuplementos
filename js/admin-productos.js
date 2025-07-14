import { onUserStateChanged, getUserData, esAdmin } from './auth.js';
import { db } from './firebase-config.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
        <th>Nombre</th><th>Categoría</th><th>Subcat.</th><th>Peso</th><th>Unidad</th><th>Precio</th><th>Stock</th><th>Imagen1</th><th>Acciones</th>
      </tr></thead>
      <tbody>
        ${productos.map((p,i)=>`
          <tr>
            <td>${p.nombre}</td>
            <td>${p.categoria}</td>
            <td>${p.subcategoria}</td>
            <td>${p.peso}</td>
            <td>${p.unidad}</td>
            <td>$${p.precio}</td>
            <td>${p.stock}</td>
            <td><img src="${p.imagen1}" width="40" height="40" style="object-fit:cover"></td>
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
  ["id","nombre","categoria","subcategoria","peso","unidad","precio","stock","desc","img1","img2"].forEach(f=>{
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

document.getElementById("btn-guardar-prod").onclick = async () => {
  const d = {
    nombre: prod-nombre.value,
    categoria: prod-categoria.value,
    subcategoria: prod-subcategoria.value,
    peso: prod-peso.value,
    unidad: prod-unidad.value,
    precio: parseFloat(prod-precio.value),
    stock: parseInt(prod-stock.value),
    descripcion: prod-desc.value,
    imagen1: prod-img1.value,
    imagen2: prod-img2.value
  };
  if (editIdx !== null) {
    await updateDoc(doc(db,"productos",productos[editIdx].id), d);
    productos[editIdx] = { ...productos[editIdx], ...d };
  } else {
    const ref = await addDoc(collection(db,"productos"), d);
    productos.push({ id: ref.id, ...d });
  }
  ocultarForm();
  render();
};