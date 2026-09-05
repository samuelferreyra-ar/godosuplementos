// Cupones de descuento.
//
// Los códigos se generan a pedido del dueño y son de un solo uso: si el mismo
// código sirviera dos veces, los clientes se lo pasarían entre sí y el
// descuento dejaría de ser para quien se lo dieron.
//
// La colección `cupones` está cerrada al navegador (ver firestore.rules). Un
// código solo se puede probar a través de validarCupon o canjear dentro de
// crearPedido, las dos del lado del servidor.
import { Timestamp } from 'firebase-admin/firestore';

// Sin I, O, 0 ni 1: se confunden al dictar un código por teléfono o WhatsApp.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO = 8;

export const PORCENTAJES_VALIDOS = [5, 7];

/** GODO-XXXX-XXXX — 32^8 combinaciones, imposible de adivinar a mano. */
export function generarCodigo() {
  const bytes = new Uint8Array(LARGO);
  crypto.getRandomValues(bytes);
  const chars = [...bytes].map((b) => ALFABETO[b % ALFABETO.length]);
  return 'GODO-' + chars.slice(0, 4).join('') + '-' + chars.slice(4).join('');
}

export function normalizarCodigo(codigo) {
  return String(codigo ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').trim();
}

/**
 * Motivo por el que un cupón no sirve, o null si sirve.
 * Se le pasa el snapshot para poder usarlo dentro de una transacción.
 */
export function motivoRechazo(snap, ahora = Timestamp.now()) {
  if (!snap?.exists) return 'Ese código no existe.';
  const c = snap.data();
  if (c.activo === false) return 'Ese código fue dado de baja.';
  if ((c.usos ?? 0) >= (c.maxUsos ?? 1)) return 'Ese código ya fue usado.';
  if (c.venceEn && c.venceEn.toMillis() < ahora.toMillis()) return 'Ese código está vencido.';
  if (!PORCENTAJES_VALIDOS.includes(Number(c.porcentaje))) return 'Ese código no es válido.';
  return null;
}

/** Descuento en pesos, redondeado a peso entero y acotado al subtotal. */
export function calcularDescuento(subtotal, porcentaje) {
  const bruto = Math.round((Number(subtotal) || 0) * (Number(porcentaje) || 0) / 100);
  return Math.max(0, Math.min(bruto, Number(subtotal) || 0));
}
