import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onUserStateChanged } from './auth.js';

onUserStateChanged(user => {
  if (user) location.href = "index.html";
});

document.getElementById("btn-registrar").onclick = async () => {
  const nombre = reg-nombre.value;
  const email = reg-email.value;
  const pass = reg-pass.value;
  const telefono = reg-telefono.value;
  const msg = document.getElementById("registro-msg");
  msg.textContent = "";
  if (!nombre || !email || !pass) {
    msg.innerHTML = `<div class="alert alert-warning">Completa todos los campos.</div>`;
    return;
  }
  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, "usuarios", res.user.uid), {
      nombre,
      email,
      telefono,
      direcciones: []
    });
    msg.innerHTML = `<div class="alert alert-success">¡Cuenta creada! Redirigiendo...</div>`;
    setTimeout(()=>location.href="index.html", 1000);
  } catch(e) {
    msg.innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
};