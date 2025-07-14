import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.getElementById("btn-recuperar").onclick = async () => {
  const email = rec-email.value;
  const msg = document.getElementById("recuperar-msg");
  msg.textContent = "";
  if (!email) {
    msg.innerHTML = `<div class="alert alert-warning">Ingresá tu email.</div>`;
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    msg.innerHTML = `<div class="alert alert-success">Email enviado. Revisa tu bandeja de entrada.</div>`;
  } catch(e) {
    msg.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
};