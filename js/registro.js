import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { mostrarToast } from "./ui.js";

// Asume que tienes un form con los IDs de campos: nombre, email, pass, telefono
document.getElementById("form-registro").onsubmit = async (e) => {
  e.preventDefault();

  const nombre = document.getElementById("registro-nombre").value.trim();
  const email = document.getElementById("registro-email").value.trim();
  const pass = document.getElementById("registro-pass").value;
  const telefono = document.getElementById("registro-telefono")?.value.trim() || "";

  if (!nombre || !email || !pass) {
    mostrarToast("Todos los campos son obligatorios", "danger");
    return;
  }
  if (pass.length < 6) {
    mostrarToast("La contraseña debe tener al menos 6 caracteres", "danger");
    return;
  }

  try {
    // 1. Crear usuario en Auth
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    // 2. Crear usuario en Firestore
    await setDoc(doc(db, "usuarios", user.uid), {
      nombre,
      email,
      telefono,
      direcciones: [],
      admin: false
    });

    mostrarToast("¡Registro exitoso! Redirigiendo...", "success");
    setTimeout(() => location.href = "index.html", 1000);
  } catch (e) {
    // Si ya existe en Auth pero falla Firestore, borrar usuario de Auth
    if (auth.currentUser) {
      try { await deleteUser(auth.currentUser); } catch {}
    }
    if (e.code === "auth/email-already-in-use") {
      mostrarToast("El email ya está registrado.", "danger");
    } else {
      mostrarToast(e.message, "danger");
    }
  }
};