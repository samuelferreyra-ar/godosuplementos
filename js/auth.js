import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

// Registrar usuario y crear documento en Firestore
export async function registrarUsuario(email, password, nombre, telefono) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Guardar datos adicionales en Firestore
  await setDoc(doc(db, "usuarios", cred.user.uid), {
    email,
    nombre,
    telefono,
    direcciones: []
  });

  return cred.user;
}

// Iniciar sesión
export function loginUsuario(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Cerrar sesión
export function cerrarSesion() {
  return signOut(auth);
}

// Detectar cambios de sesión
export function detectarUsuario(callback) {
  onAuthStateChanged(auth, callback);
}

// Obtener datos del usuario logueado
export async function obtenerDatosUsuario(uid) {
  const docRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}