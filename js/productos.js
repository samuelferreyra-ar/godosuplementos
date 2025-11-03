import { db } from './firebase-config.js';
import {
  collection, getDocs, query, orderBy, limit, where, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Helper general: por defecto solo stock > 0
export async function obtenerProductos({ incluirSinStock = false } = {}) {
  const base = collection(db, "productos");
  const q = incluirSinStock ? base : query(base, where("stock", ">", 0));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMasVendidos(max = 8) {
  // Si más adelante usás "ventas", lo agregás al query ordenado
  const base = collection(db, "productos");
  const q = query(base, where("stock", ">", 0), /* orderBy("ventas","desc"), */ limit(max));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getProductoById(id) {
  const ref = doc(db, "productos", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id, ...snap.data() } : null;
}

// La usa búsqueda / listados públicos
export async function obtenerProductosParaBusqueda() {
  // Solo con stock
  return obtenerProductos({ incluirSinStock: false });
}