import { onUserStateChanged, getUserData } from "./auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { mostrarToast } from "./ui.js";

// Función para renderizar los datos, incluyendo la edición de teléfono
function renderDatosCuenta(user, userData) {
  const div = document.getElementById("datos-cuenta");
  // Dirección principal (si hay)
  let dirPrincipal = "-";
  if (userData.direcciones && userData.direcciones.length) {
    const d = userData.direcciones[0];
    dirPrincipal = `${d.calle} ${d.numero}, ${d.localidad}, ${d.provincia}`;
  }

  div.innerHTML = `
    <b>Nombre:</b> ${userData?.nombre || "-"}<br>
    <b>Email:</b> ${user.email || "-"}<br>
    <b>Teléfono:</b>
      <span id="telefono-actual">${userData?.telefono || ""}</span>
      <button id="btn-editar-telefono" class="btn btn-sm btn-outline-secondary ms-1" title="Editar">
        <i class="bi bi-pencil"></i>
      </button>
      <span id="telefono-form" style="display:none;">
        <input type="tel" id="telefono-input" class="form-control d-inline-block" style="width:150px;" />
        <button class="btn btn-sm btn-success" id="btn-guardar-telefono" title="Guardar">
          <i class="bi bi-check-lg"></i>
        </button>
        <button class="btn btn-sm btn-outline-danger" id="btn-cancelar-telefono" title="Cancelar">
          <i class="bi bi-x"></i>
        </button>
      </span>
      <small id="msg-telefono" class="text-danger ms-2"></small>
    <br>
    <b>Dirección principal:</b> ${dirPrincipal}
  `;

  // Lógica para edición de teléfono (todo aquí adentro)
  const btnEditar = document.getElementById("btn-editar-telefono");
  const formTel = document.getElementById("telefono-form");
  const inputTel = document.getElementById("telefono-input");
  const btnGuardar = document.getElementById("btn-guardar-telefono");
  const btnCancelar = document.getElementById("btn-cancelar-telefono");
  const msgTel = document.getElementById("msg-telefono");
  const telefonoActual = document.getElementById("telefono-actual");

  btnEditar.onclick = () => {
    inputTel.value = telefonoActual.textContent;
    formTel.style.display = "";
    btnEditar.style.display = "none";
    msgTel.textContent = "";
    inputTel.focus();
  };

  btnGuardar.onclick = async () => {
    const nuevoTel = inputTel.value.trim();
    if (!nuevoTel) {
      msgTel.textContent = "El teléfono no puede estar vacío.";
      inputTel.focus();
      return;
    }
    try {
      await updateDoc(doc(db, "usuarios", user.uid), { telefono: nuevoTel });
      telefonoActual.textContent = nuevoTel;
      msgTel.textContent = "";
      formTel.style.display = "none";
      btnEditar.style.display = "";
      mostrarToast("Teléfono actualizado", "success");
    } catch {
      msgTel.textContent = "Error al actualizar el teléfono.";
    }
  };

  btnCancelar.onclick = () => {
    formTel.style.display = "none";
    btnEditar.style.display = "";
    msgTel.textContent = "";
  };
}

document.addEventListener("DOMContentLoaded", () => {
  onUserStateChanged(async user => {
    if (!user) {
      location.href = "login.html";
      return;
    }
    const userData = await getUserData(user.uid);
    renderDatosCuenta(user, userData);
  });
});


document.getElementById("btn-cambiar-pass").onclick = async () => {
  const pass = document.getElementById("new-pass").value;
  const msg = document.getElementById("msg-pass");
  try {
    const user = (await import('./auth.js')).auth.currentUser;
    await updatePassword(user, pass);
    msg.textContent = "Contraseña actualizada con éxito.";
    msg.className = "text-success mt-2";
  } catch (e) {
    msg.textContent = "Error: " + e.message;
    msg.className = "text-danger mt-2";
  }
};