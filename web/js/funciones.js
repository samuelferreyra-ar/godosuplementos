// Cliente de las Cloud Functions.
//
// Se llaman por HTTP en vez de importar el SDK de functions: es una petición
// menos que descargar y el protocolo de las callables es simple.
import { auth } from './firebase-config.js';

const REGION = 'southamerica-west1';
const PROYECTO = 'godo-suplementos';
const DIRECTO = 'https://' + REGION + '-' + PROYECTO + '.cloudfunctions.net/';

// Servido desde Firebase Hosting, las funciones se llaman por /api/: mismo
// origen que el sitio, así que no hay CORS ni una resolución DNS extra.
// En el servidor de previsualización local ese rewrite no existe, así que
// desde ahí se va derecho a cloudfunctions.net.
const ES_LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const BASE = ES_LOCAL ? DIRECTO : '/api/';
// Las nuevas funciones de MODO se prueban también en previews, sin depender
// de rewrites desplegados en el dominio que todavía sirve el sitio anterior.
const MODO = new Set(['opcionesModoPrueba', 'crearPedidoModo', 'iniciarPagoModo', 'consultarPagoModo', 'finalizarPruebaModo']);

/** Error con el mensaje que mandó la Function, listo para mostrar. */
export class ErrorFuncion extends Error {
  constructor(codigo, mensaje, detalles) {
    super(mensaje);
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.detalles = detalles;
  }
}

export async function llamar(nombre, datos = {}) {
  const cabeceras = { 'Content-Type': 'application/json' };

  // Si hay sesión, el pedido queda asociado al usuario. Sin sesión también
  // funciona: el diseño permite comprar sin cuenta.
  const usuario = auth.currentUser;
  if (usuario) {
    try { cabeceras.Authorization = 'Bearer ' + (await usuario.getIdToken()); } catch { /* sigue como invitado */ }
  }

  let respuesta;
  try {
    respuesta = await fetch((MODO.has(nombre) ? DIRECTO : BASE) + nombre, {
      method: 'POST', headers: cabeceras, body: JSON.stringify({ data: datos })
    });
  } catch {
    throw new ErrorFuncion('sin-red', 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.');
  }

  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch { /* respuesta sin JSON */ }

  if (!respuesta.ok || cuerpo?.error) {
    const e = cuerpo?.error ?? {};
    throw new ErrorFuncion(e.status ?? 'error', e.message ?? 'Algo salió mal. Probá de nuevo.', e.details);
  }

  return cuerpo?.result;
}
