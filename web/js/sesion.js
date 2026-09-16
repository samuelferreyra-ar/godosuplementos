// Sesión del cliente.
//
// El sitio se puede recorrer y comprar sin cuenta: la sesión solo agrega
// historial de pedidos y direcciones guardadas.
import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification, updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const oyentes = new Set();
let ultimo = { usuario: null, datos: null, resuelto: false };

async function traerDatos(uid) {
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

onAuthStateChanged(auth, async (usuario) => {
  let datos = usuario ? await traerDatos(usuario.uid) : null;
  if (usuario && !datos) datos = await asegurarPerfil(usuario);
  ultimo = { usuario, datos, resuelto: true };
  oyentes.forEach((cb) => cb(usuario, datos));
});

/** Avisa el estado actual y cada vez que cambie. */
export function onUsuario(cb) {
  oyentes.add(cb);
  if (ultimo.resuelto) cb(ultimo.usuario, ultimo.datos);
  return () => oyentes.delete(cb);
}

/** Espera a que Firebase resuelva si hay sesión o no. */
export function esperarSesion() {
  if (ultimo.resuelto) return Promise.resolve(ultimo);
  return new Promise((resolver) => {
    const quitar = onUsuario(() => { quitar(); resolver(ultimo); });
  });
}

export const esAdmin = () => ultimo.datos?.admin === true;

export const cerrarSesion = () => signOut(auth);

// --- Entrar, registrarse, recuperar -------------------------------------

/** Traduce los códigos de Firebase a algo que un cliente entienda. */
export function mensajeDeError(e) {
  const codigo = e?.code ?? '';
  if (codigo.includes('invalid-credential') || codigo.includes('wrong-password') || codigo.includes('user-not-found')) {
    return 'El mail o la contraseña no coinciden.';
  }
  if (codigo.includes('invalid-email')) return 'Ese mail no parece válido.';
  if (codigo.includes('email-already-in-use')) return 'Ya hay una cuenta con ese mail. Probá iniciar sesión.';
  if (codigo.includes('weak-password')) return 'La contraseña necesita al menos 6 caracteres.';
  if (codigo.includes('too-many-requests')) return 'Demasiados intentos. Esperá un rato y probá de nuevo.';
  if (codigo.includes('network')) return 'No pudimos conectarnos. Revisá tu conexión.';
  return 'Algo salió mal. Probá de nuevo en un momento.';
}

export const entrar = (email, clave) => signInWithEmailAndPassword(auth, email.trim(), clave);

export async function registrar({ nombre, email, telefono, clave }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), clave);

  try {
    await updateProfile(cred.user, { displayName: nombre.trim() });
  } catch (e) {
    console.warn('No se pudo guardar el nombre en el perfil:', e);
  }

  // El documento es lo que importa: sin él no hay direcciones ni historial.
  // Si falla acá, asegurarPerfil lo vuelve a intentar en la próxima sesión.
  try {
    await crearPerfil(cred.user, { nombre, email, telefono });
  } catch (e) {
    console.warn('No se pudo crear el perfil; se reintentará al abrir sesión:', e);
  }

  // El mail de verificación es lo menos importante de los tres.
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.warn('No se pudo enviar el mail de verificación:', e);
  }

  return cred.user;
}

/** Documento de perfil del cliente. Las reglas exigen que admin sea false. */
function crearPerfil(usuario, { nombre, email, telefono } = {}) {
  return setDoc(doc(db, 'usuarios', usuario.uid), {
    nombre: (nombre ?? usuario.displayName ?? '').trim(),
    email: (email ?? usuario.email ?? '').trim().toLowerCase(),
    telefono: (telefono ?? '').trim(),
    direcciones: [],
    admin: false,
    creadoEn: new Date()
  }, { merge: true });
}

/**
 * Repara el perfil de quien no lo tenga.
 * Un registro puede fallar a mitad de camino —se crea la cuenta de Auth pero
 * no el documento—, y ese cliente quedaría sin direcciones ni historial para
 * siempre. Acá se rehace solo, sin que tenga que hacer nada.
 */
async function asegurarPerfil(usuario) {
  try {
    await crearPerfil(usuario);
    return await traerDatos(usuario.uid);
  } catch (e) {
    console.warn('No se pudo reparar el perfil:', e);
    return null;
  }
}

export const recuperarClave = (email) => sendPasswordResetEmail(auth, email.trim());
