/*import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, addDoc, orderBy, limit, updateDoc, doc, getDoc, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Crea nuevo pedido
//export async function crearPedido(pedidoData) {
//  const pedidosRef = collection(db, "pedidos");
//  return await addDoc(pedidosRef, pedidoData);
//}

//----NUEVA FUNCIÓN ---
export async function guardarPedidoDescontandoStock(pedidoData) {
  // GENERÁ EL NUEVO ID ANTES
  const pedidosCol = collection(db, "pedidos");
  const nuevoPedidoRef = doc(pedidosCol); // Esto genera el id sin guardar nada

  await runTransaction(db, async (transaction) => {
    // Verificar y descontar stock
    for (const prod of pedidoData.productos) {
      const prodRef = doc(db, "productos", prod.id);
      const prodSnap = await transaction.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`Producto no encontrado: ${prod.nombre}`);
      }
      const stockActual = prodSnap.data().stock;
      if (prod.cantidad > stockActual) {
        throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${stockActual}`);
      }
      transaction.update(prodRef, { stock: stockActual - prod.cantidad });
    }
    // Usá SIEMPRE la misma referencia de pedido
    transaction.set(nuevoPedidoRef, pedidoData);
  });
}

// Listar pedidos por usuario
export async function getPedidosUsuario(uid) {
  const q = query(collection(db, "pedidos"), where("usuario.uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
}*/

import { db } from './firebase-config.js';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
  updateDoc,
  doc,
  getDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Crea nuevo pedido (manual, NO usar en flujo normal)
export async function crearPedido(pedidoData) {
  const pedidosRef = collection(db, "pedidos");
  return await addDoc(pedidosRef, pedidoData);
}

// Listar pedidos por usuario
export async function getPedidosUsuario(uid) {
  const q = query(collection(db, "pedidos"), where("usuario.uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

// CREA PEDIDO Y DESCUENTA STOCK DE MANERA TRANSACCIONAL Y SEGURA
export async function guardarPedidoDescontandoStock(pedidoData) {
  // 1. Genera el id fuera de la transacción
  const pedidosCol = collection(db, "pedidos");
  const nuevoPedidoRef = doc(pedidosCol); // genera el id

  // 2. (opcional) Agregá el id del pedido al objeto, si lo necesitás
  pedidoData.id = nuevoPedidoRef.id;

  await runTransaction(db, async (transaction) => {
    // LEE todos los productos primero
    const productosAFacturar = [];
    for (const prod of pedidoData.productos) {
      const prodRef = doc(db, "productos", prod.id);
      const prodSnap = await transaction.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`Producto no encontrado: ${prod.nombre}`);
      }
      const stockActual = prodSnap.data().stock;
      if (prod.cantidad > stockActual) {
        throw new Error(`Stock insuficiente para "${prod.nombre}". Disponible: ${stockActual}`);
      }
      productosAFacturar.push({ prodRef, nuevoStock: stockActual - prod.cantidad });
    }

    // SOLO DESPUÉS de haber leído todo, escribí
    for (const { prodRef, nuevoStock } of productosAFacturar) {
      transaction.update(prodRef, { stock: nuevoStock });
    }

    transaction.set(nuevoPedidoRef, pedidoData);
  });
}
