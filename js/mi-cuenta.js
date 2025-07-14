import { onUserStateChanged, getUserData } from './auth.js';
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

onUserStateChanged(async user => {
  if (!user) return location.href = "login.html";
  const data = await getUserData(user.uid);
  document.getElementById("datos-cuenta").innerHTML = `
    <b>Nombre:</b> ${data?.nombre || '-'}<br>
    <b>Email:</b> ${user.email}<br>
    <b>Teléfono:</b> ${data?.telefono || '-'}<br>
    <b>Dirección principal:</b> ${data?.direcciones?.[0] ? `
      ${data.direcciones[0].calle} ${data.direcciones[0].numero}, ${data.direcciones[0].localidad}
    ` : "-"}
  `;
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