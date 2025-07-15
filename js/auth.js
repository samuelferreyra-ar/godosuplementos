import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Login
export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

// Logout
export async function logout() {
  return await signOut(auth);
}

// Escucha cambios de usuario logueado
export function onUserStateChanged(cb) {
  onAuthStateChanged(auth, cb);
}

// Trae datos de usuario Firestore
export async function getUserData(uid) {
  const docRef = doc(db, "usuarios", uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// Helper para saber si es admin (ajusta el campo según tu modelo)
export function esAdmin(userData) {
  return userData?.admin === true; // O pon un campo rol en Firestore
}