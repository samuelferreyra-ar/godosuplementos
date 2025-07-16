import { db } from './firebase-config.js';
import { collection, getDocs, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function getMasVendidos(max = 8) {
  // Idealmente usá un campo ventas, por ahora trae los primeros 8 que haya
  const q = query(collection(db, "productos"), /*orderBy("ventas", "desc"),*/ limit(max));
  const snap = await getDocs(q);
  let productos = [];
  snap.forEach(doc => productos.push({ id: doc.id, ...doc.data() }));
  // Si no hay campo ventas, solo toma los primeros 8
  return productos;
}

export async function getProductoById(id) {
  const ref = doc(db, "productos", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id, ...snap.data() } : null;
}

// ¡Esta función sirve tanto para el main como para la búsqueda!
export async function obtenerProductosParaBusqueda() {
  const snapshot = await getDocs(collection(db, "productos"));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}