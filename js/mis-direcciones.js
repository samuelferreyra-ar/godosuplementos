import { onUserStateChanged } from './auth.js';
import { getDirecciones, setDirecciones } from './direcciones.js';

let direcciones = [], uid = null, dirEditIdx = null;

function render() {
  const cont = document.getElementById("direcciones-lista");
  if (!direcciones.length) {
    cont.innerHTML = "<div>No tienes direcciones cargadas.</div>";
    return;
  }
  cont.innerHTML = direcciones.map((d, i) => `
    <div class="border p-2 mb-2 d-flex align-items-center justify-content-between">
      <div>
        <b>${d.calle} ${d.numero}</b>, Piso ${d.piso||'-'}, Depto ${d.departamento||'-'}, ${d.localidad}, ${d.provincia}, CP: ${d.codigo_postal}
        ${i===0 ? '<span class="badge bg-success ms-2">Principal</span>' : ''}
      </div>
      <div>
        <button class="btn btn-sm btn-secondary me-1" data-edit="${i}">Editar</button>
        <button class="btn btn-sm btn-danger" data-del="${i}">Borrar</button>
        ${i>0 ? `<button class="btn btn-sm btn-info ms-1" data-main="${i}">Principal</button>` : ''}
      </div>
    </div>
  `).join("");
  cont.querySelectorAll("[data-del]").forEach(btn => btn.onclick = async () => {
    const idx = +btn.dataset.del;
    direcciones.splice(idx,1);
    await setDirecciones(uid, direcciones);
    render();
  });
  cont.querySelectorAll("[data-main]").forEach(btn => btn.onclick = async () => {
    const idx = +btn.dataset.main;
    if(idx > 0) {
      const [d] = direcciones.splice(idx,1);
      direcciones.unshift(d);
      await setDirecciones(uid, direcciones);
      render();
    }
  });
  // Editar: (sólo muestra el form con los datos)
  cont.querySelectorAll("[data-edit]").forEach(btn => btn.onclick = () => {
    dirEditIdx = +btn.dataset.edit;
    const d = direcciones[dirEditIdx];
    document.getElementById("form-direccion").style.display = "";
    ["calle","numero","piso","departamento","localidad","provincia","cp"].forEach(f=>document.getElementById(f).value = d[f]||"");
  });
}

onUserStateChanged(async user => {
  if (!user) return location.href = "login.html";
  uid = user.uid;
  direcciones = await getDirecciones(uid);
  render();
});

document.getElementById("btn-nueva-direccion").onclick = () => {
  dirEditIdx = null;
  document.getElementById("form-direccion").style.display = "";
  ["calle","numero","piso","departamento","localidad","provincia","cp"].forEach(f=>document.getElementById(f).value = "");
};

document.getElementById("btn-cancelar-direccion").onclick = () => {
  document.getElementById("form-direccion").style.display = "none";
};

document.getElementById("btn-guardar-direccion").onclick = async () => {
  const d = {
    calle: calle.value, numero: numero.value, piso: piso.value, departamento: departamento.value,
    localidad: localidad.value, provincia: provincia.value, codigo_postal: cp.value
  };
  if (dirEditIdx == null) direcciones.push(d);
  else direcciones[dirEditIdx] = d;
  await setDirecciones(uid, direcciones);
  document.getElementById("form-direccion").style.display = "none";
  render();
};