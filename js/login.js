import { login } from './auth.js';
import { onUserStateChanged } from './auth.js';

onUserStateChanged(user => {
  if (user) location.href = "index.html";
});

document.getElementById("btn-login").onclick = async () => {
  const email = login-email.value;
  const pass = login-password.value;
  const msg = document.getElementById("login-msg");
  msg.textContent = "";
  try {
    await login(email, pass);
    location.href = "index.html";
  } catch(e) {
    msg.innerHTML = `<div class="alert alert-danger">Usuario o contraseña incorrectos.</div>`;
  }
};