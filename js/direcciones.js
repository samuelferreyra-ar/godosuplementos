import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Devuelve array de direcciones
export async function getDirecciones(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().direcciones || []) : [];
}

// Añade o actualiza direcciones (reemplaza todas, es lo más simple)
export async function setDirecciones(uid, direcciones) {
  const ref = doc(db, "usuarios", uid);
  await updateDoc(ref, { direcciones });
}