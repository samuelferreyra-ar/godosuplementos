import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, addDoc, orderBy, limit, updateDoc, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Crea nuevo pedido
export async function crearPedido(pedidoData) {
  const pedidosRef = collection(db, "pedidos");
  return await addDoc(pedidosRef, pedidoData);
}

// Listar pedidos por usuario
export async function getPedidosUsuario(email) {
  const q = query(collection(db, "pedidos"), where("usuario.email", "==", email), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  let pedidos = [];
  snap.forEach(doc => pedidos.push({ id: doc.id, ...doc.data() }));
  return pedidos;
}

// Listar últimos X pedidos (admin)
export async function getUltimosPedidos(cant = 50) {
  const q = query(collection(db, "pedidos"), orderBy("fecha", "desc"), limit(cant));
  const snap = await getDocs(q);
  let pedidos = [];
  snap.forEach(doc => pedidos.push({ id: doc.id, ...doc.data() }));
  return pedidos;
}

// Cambiar estado de pedido
export async function cambiarEstadoPedido(pedidoId, nuevoEstado) {
  const ref = doc(db, "pedidos", pedidoId);
  await updateDoc(ref, { estado: nuevoEstado });
}