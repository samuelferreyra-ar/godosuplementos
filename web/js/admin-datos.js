// Operaciones de stock del panel.
//
// Todo cambio de stock pasa por una transacción: se lee el producto, se
// calcula y se escribe junto con los campos desnormalizados (stockTotal,
// variantesActivas). Si se usara increment() suelto, esos campos quedarían
// desfasados y la tienda mostraría cosas que no hay.
//
// Cada movimiento queda asentado en `movimientosStock`, que es de solo
// agregar: el historial no se edita ni se borra.
import { db } from './firebase-config.js';
import {
  collection, doc, runTransaction, serverTimestamp,
  onSnapshot, query, where, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const PRODUCTOS = 'productos_v2';

/** Recalcula lo desnormalizado a partir del mapa de variantes. */
function derivados(variantes) {
  const vs = Object.values(variantes);
  const activas = vs.filter((v) => !v.pausada);
  return {
    stockTotal: vs.reduce((a, v) => a + (Number(v.stock) || 0), 0),
    variantesActivas: activas.length,
    precioMin: vs.length ? Math.min(...vs.map((v) => Number(v.precio) || 0)) : 0,
    precioMax: vs.length ? Math.max(...vs.map((v) => Number(v.precio) || 0)) : 0
  };
}

/**
 * Aplica cambios de stock a varias variantes de un producto.
 * @param {string} productoId
 * @param {Record<string, number>} deltas varianteId -> cuánto sumar (puede ser negativo)
 * @param {'entrada'|'ajuste'|'correccion'} motivo
 * @param {string|null} usuarioId
 */
export async function moverStock(productoId, deltas, motivo, usuarioId = null) {
  const entradas = Object.entries(deltas).filter(([, n]) => Number.isFinite(n) && n !== 0);
  if (!entradas.length) return { cambiadas: 0 };

  const ref = doc(db, PRODUCTOS, productoId);
  const movimientos = [];

  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('El producto ya no existe.');

    const producto = snap.data();
    const variantes = { ...producto.variantes };
    movimientos.length = 0;

    for (const [varianteId, delta] of entradas) {
      const v = variantes[varianteId];
      if (!v) throw new Error('La variante "' + varianteId + '" ya no existe.');

      const antes = Number(v.stock) || 0;
      const despues = Math.max(0, antes + delta);
      if (despues === antes) continue;

      variantes[varianteId] = {
        ...v,
        stock: despues,
        // Una variante en cero se pausa sola; al recibir mercadería vuelve.
        pausada: despues === 0 ? true : (antes === 0 ? false : v.pausada)
      };
      movimientos.push({ varianteId, delta: despues - antes, antes, despues });
    }

    if (!movimientos.length) return;

    t.update(ref, { variantes, ...derivados(variantes), actualizadoEn: serverTimestamp() });

    for (const m of movimientos) {
      t.set(doc(collection(db, 'movimientosStock')), {
        productoId, varianteId: m.varianteId,
        delta: m.delta, motivo, usuarioId,
        stockResultante: m.despues,
        fecha: serverTimestamp()
      });
    }
  });

  return { cambiadas: movimientos.length, movimientos };
}

/** Publica o pausa una variante a mano, sin tocar su stock. */
export async function cambiarPausa(productoId, varianteId, pausada) {
  const ref = doc(db, PRODUCTOS, productoId);

  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('El producto ya no existe.');

    const producto = snap.data();
    const v = producto.variantes?.[varianteId];
    if (!v) throw new Error('Esa variante ya no existe.');
    if (!pausada && (Number(v.stock) || 0) === 0) {
      throw new Error('No se puede publicar una variante sin stock.');
    }

    const variantes = { ...producto.variantes, [varianteId]: { ...v, pausada } };
    t.update(ref, { variantes, ...derivados(variantes), actualizadoEn: serverTimestamp() });
  });
}

/** Archivar en vez de borrar: nada se pierde y se puede deshacer. */
export async function archivar(productoId, archivado = true) {
  const ref = doc(db, PRODUCTOS, productoId);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('El producto ya no existe.');
    t.update(ref, { archivado, actualizadoEn: serverTimestamp() });
  });
}

/** Precio de una variante. */
export async function cambiarPrecio(productoId, varianteId, precio) {
  const nuevo = Number(precio);
  if (!Number.isFinite(nuevo) || nuevo <= 0) throw new Error('El precio tiene que ser un número mayor que cero.');

  const ref = doc(db, PRODUCTOS, productoId);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw new Error('El producto ya no existe.');
    const producto = snap.data();
    const v = producto.variantes?.[varianteId];
    if (!v) throw new Error('Esa variante ya no existe.');
    const variantes = { ...producto.variantes, [varianteId]: { ...v, precio: Math.round(nuevo) } };
    t.update(ref, { variantes, ...derivados(variantes), actualizadoEn: serverTimestamp() });
  });
}

/**
 * Catálogo completo en vivo, incluidos archivados y pausados.
 * Con onSnapshot, dos personas trabajando a la vez ven lo mismo.
 */
export function escucharCatalogo(alCambiar, alFallar) {
  return onSnapshot(collection(db, PRODUCTOS),
    (snap) => {
      const productos = snap.docs.map((d) => {
        const data = d.data();
        const variantes = Object.entries(data.variantes ?? {})
          .map(([varianteId, v]) => ({ varianteId, ...v }));
        return { id: d.id, ...data, listaVariantes: variantes };
      });
      alCambiar(productos.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '')));
    },
    (e) => { console.error('El catálogo dejó de escucharse:', e); alFallar?.(e); });
}

/** Últimos movimientos de un producto, para el historial. */
export async function movimientosDe(productoId, cuantos = 20) {
  const q = query(collection(db, 'movimientosStock'),
    where('productoId', '==', productoId), orderBy('fecha', 'desc'), limit(cuantos));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// --- Ayudas de clasificación --------------------------------------------

export const UMBRAL_POR_DEFECTO = 5;

export function nivelDe(producto, variante) {
  const umbral = producto?.umbralStock ?? UMBRAL_POR_DEFECTO;
  const stock = Number(variante?.stock) || 0;
  if (stock === 0) return 'cero';
  if (stock <= umbral) return 'bajo';
  return 'normal';
}

export function estadoDe(producto) {
  if (producto.archivado) return { id: 'archivado', texto: 'Archivado', tono: 'sin' };

  const vs = producto.listaVariantes ?? [];
  const conStock = vs.filter((v) => (Number(v.stock) || 0) > 0);
  if (!conStock.length) return { id: 'sin-stock', texto: 'Sin stock', tono: 'sin' };

  const sinStock = vs.length - conStock.length;
  const bajas = vs.filter((v) => nivelDe(producto, v) === 'bajo').length;

  if (bajas) return { id: 'bajo', texto: 'Stock bajo', tono: 'aviso' };
  if (sinStock) return { id: 'parcial', texto: sinStock + ' sin stock', tono: 'aviso' };
  if (vs.every((v) => v.pausada)) return { id: 'pausado', texto: 'Pausado', tono: 'sin' };
  return { id: 'publicado', texto: 'Publicado', tono: 'ok' };
}

/** Variantes que hay que reponer: es el contador del sidebar. */
export const variantesAReponer = (productos) => productos
  .filter((p) => !p.archivado)
  .flatMap((p) => (p.listaVariantes ?? []).filter((v) => nivelDe(p, v) !== 'normal')).length;
