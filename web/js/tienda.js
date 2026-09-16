// Parámetros de la tienda y utilidades compartidas.
//
// Zonas de envío, umbral de envío gratis y medios de pago viven en Firestore
// (config/tienda), no en el código: cambiar una tarifa es editar el documento.
import { db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const POR_DEFECTO = {
  zonasEnvio: {},
  umbralEnvioGratis: null,
  metodosPago: ['transferencia', 'efectivo'],
  whatsapp: '5493834235967'
};

let cache = null;

export async function obtenerConfig() {
  if (cache) return cache;
  try {
    const snap = await getDoc(doc(db, 'config', 'tienda'));
    cache = { ...POR_DEFECTO, ...(snap.exists() ? snap.data() : {}) };
  } catch {
    cache = { ...POR_DEFECTO };
  }
  return cache;
}

export async function zonasOrdenadas() {
  const { zonasEnvio } = await obtenerConfig();
  return Object.entries(zonasEnvio)
    .map(([id, z]) => ({ id, ...z }))
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
}

/** Cuánto falta para el envío sin cargo. null si no hay umbral o ya se alcanzó. */
export function faltaParaEnvioGratis(subtotal, config) {
  const umbral = config?.umbralEnvioGratis;
  if (typeof umbral !== 'number' || umbral <= 0) return null;
  return subtotal >= umbral ? null : umbral - subtotal;
}

// Intl mete un espacio duro entre el signo y el número; el diseño lo pega.
export const precio = (n) =>
  (Number(n) || 0).toLocaleString('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).replace(/ /g, '');

// Las categorías se guardan sin acentos y en minúscula. Para mostrarlas hay
// que devolverles la tilde: el dato es una clave, no una etiqueta.
const NOMBRES_CATEGORIA = {
  proteinas: 'Proteínas',
  creatinas: 'Creatinas',
  aminoacidos: 'Aminoácidos',
  'pre-entrenos': 'Pre-entrenos',
  vitaminas: 'Vitaminas',
  magnesio: 'Magnesio',
  colageno: 'Colágeno',
  omega: 'Omega',
  ganadores: 'Ganadores',
  quemadores: 'Quemadores',
  combos: 'Combos',
  otros: 'Otros'
};

export const nombreCategoria = (c) => {
  const clave = String(c ?? '').toLowerCase().trim();
  return NOMBRES_CATEGORIA[clave] ?? (clave ? clave.charAt(0).toUpperCase() + clave.slice(1) : '');
};

export const numero = (n) => (Number(n) || 0).toLocaleString('es-AR');

/** Escapa texto que viene de Firestore antes de meterlo en innerHTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function mensajeWhatsApp(lineas, { numeroPedido, total, entrega, costoEnvio, aCoordinar = false } = {}) {
  const items = lineas.map((l) => {
    const variante = [l.sabor, l.tamano].filter(Boolean).join(' ');
    return '• ' + l.nombre + (variante ? ' (' + variante + ')' : '') + ' x' + l.cantidad;
  }).join('\n');

  return [
    numeroPedido ? '*Pedido #' + numeroPedido + '* — GODO Suplementos' : '*Consulta de pedido* — GODO Suplementos',
    '',
    items,
    '',
    entrega ? '*Entrega:* ' + entrega : '',
    costoEnvio != null ? '*Costo de entrega:* ' + precio(costoEnvio) : '',
    total != null ? (aCoordinar ? '*Total estimado:* ' : '*Total:* ') + precio(total) : '',
    aCoordinar ? 'Quiero coordinar la disponibilidad, el pago y la entrega de este pedido.' : ''
  ].filter(Boolean).join('\n');
}

export function enlaceWhatsApp(numeroDestino, texto) {
  const n = String(numeroDestino ?? '').replace(/\D/g, '');
  const esMovil = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return esMovil
    ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(texto)
    : 'https://web.whatsapp.com/send?phone=' + n + '&text=' + encodeURIComponent(texto);
}

export function abrirWhatsApp(numeroDestino, texto) {
  window.open(enlaceWhatsApp(numeroDestino, texto), '_blank', 'noopener');
}
