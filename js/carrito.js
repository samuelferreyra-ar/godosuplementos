import { auth, db } from './firebase.js';
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Leer carrito de localStorage
export function getCarritoLocal() {
  return JSON.parse(localStorage.getItem("carrito")) || [];
}

// Guardar carrito en localStorage
export function setCarritoLocal(carrito) {
  localStorage.setItem("carrito", JSON.stringify(carrito));
}

// Agregar producto (o sumar cantidad)
export function agregarAlCarritoLocal(idProducto, cantidad = 1) {
  let carrito = getCarritoLocal();
  const idx = carrito.findIndex(p => p.id === idProducto);
  if (idx > -1) {
    carrito[idx].cantidad += cantidad;
  } else {
    carrito.push({ id: idProducto, cantidad });
  }
  setCarritoLocal(carrito);
}

// Quitar producto
export function quitarDelCarritoLocal(idProducto) {
  let carrito = getCarritoLocal();
  carrito = carrito.filter(p => p.id !== idProducto);
  setCarritoLocal(carrito);
}

// Actualizar cantidad
export function setCantidadProducto(idProducto, cantidad) {
  let carrito = getCarritoLocal();
  const idx = carrito.findIndex(p => p.id === idProducto);
  if (idx > -1) {
    carrito[idx].cantidad = cantidad;
    if (carrito[idx].cantidad < 1) carrito = carrito.filter(p => p.id !== idProducto);
    setCarritoLocal(carrito);
  }
}

// Sincronizar carrito local a Firestore
export async function sincronizarCarritoConFirestore(user) {
  const carritoLocal = getCarritoLocal();
  const userRef = doc(db, "usuarios", user.uid);
  await setDoc(userRef, { carrito: carritoLocal }, { merge: true });
}

// Traer carrito desde Firestore y guardar localmente
export async function cargarCarritoDesdeFirestore(user) {
  const userRef = doc(db, "usuarios", user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && snap.data().carrito) {
    setCarritoLocal(snap.data().carrito);
  }
}
