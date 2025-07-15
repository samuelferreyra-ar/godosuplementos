import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast } from "./ui.js";

// Asume un form con id="form-login" y campos: login-email, login-pass
document.getElementById("form-login").onsubmit = async (e) => {
  e.preventDefault();

  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;

  if (!email || !pass) {
    mostrarToast("Email y contraseña requeridos", "danger");
    return;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // **Chequeo de verificación de email**
    if (!user.emailVerified) {
      mostrarToast("Debes verificar tu correo antes de ingresar. Te reenviamos el mail.", "warning");
      // Reenviar mail de verificación si querés:
      try { await sendEmailVerification(user); } catch {}
      setTimeout(() => { auth.signOut(); }, 600);
      return;
    }

    // Buscar datos extendidos en Firestore
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (!userSnap.exists()) {
      mostrarToast("Usuario registrado solo parcialmente. Contacte soporte.", "danger");
      return;
    }

    mostrarToast("¡Login exitoso!", "success");
    setTimeout(() => location.href = "index.html", 1000);

  } catch (e) {
    if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password") {
      mostrarToast("Usuario o contraseña incorrectos", "danger");
    } else {
      mostrarToast(e.message, "danger");
    }
  }
};