// Capa de datos sobre productos_v2: un documento por producto, con las
// variantes como mapa embebido.
//
// El catálogo se cachea en memoria: el sitio anterior releía la colección
// entera en cada navegación, que es el único gasto de Firestore que se puede
// escapar a esta escala.
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where, orderBy, limit, doc, getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const COLECCION = 'productos_v2';

let cache = null;
let cargando = null;

/** Valores únicos de un eje, con los que tienen stock adelante. */
function ordenarPorDisponibilidad(variantes, campo) {
  const valores = [...new Set(variantes.map((v) => v[campo]).filter(Boolean))];
  const conStock = (valor) => variantes.some((v) => v[campo] === valor && !v.pausada && v.stock > 0);
  return valores.sort((a, b) => Number(conStock(b)) - Number(conStock(a)));
}

/** Aplana el mapa de variantes a un array ordenado y con id adentro. */
function normalizar(id, data) {
  const variantes = Object.entries(data.variantes ?? {})
    .map(([varianteId, v]) => ({ varianteId, ...v }))
    .sort((a, b) => (a.tamano ?? '').localeCompare(b.tamano ?? '') || (a.sabor ?? '').localeCompare(b.sabor ?? ''));

  return {
    id, ...data, variantes,
    // Disponibles primero: los agotados se muestran igual, pero al final.
    sabores: ordenarPorDisponibilidad(variantes, 'sabor'),
    tamanos: ordenarPorDisponibilidad(variantes, 'tamano'),
    // Un producto sin ninguna variante publicada no se muestra en la tienda.
    disponible: variantes.some((v) => !v.pausada && v.stock > 0)
  };
}

/** Trae el catálogo publicado. Una sola lectura por sesión. */
export async function obtenerCatalogo() {
  if (cache) return cache;
  if (cargando) return cargando;

  cargando = (async () => {
    const q = query(collection(db, COLECCION), where('variantesActivas', '>', 0));
    const snap = await getDocs(q);
    cache = snap.docs
      .map((d) => normalizar(d.id, d.data()))
      .filter((p) => !p.archivado && p.disponible);
    cargando = null;
    return cache;
  })();

  return cargando;
}

export async function obtenerPorCategoria(categoria) {
  const todos = await obtenerCatalogo();
  const buscada = String(categoria ?? '').toLowerCase();
  return todos.filter((p) => String(p.categoria ?? '').toLowerCase() === buscada);
}

export async function obtenerDestacados(max = 8) {
  const todos = await obtenerCatalogo();
  const destacados = todos.filter((p) => p.destacado);
  return (destacados.length ? destacados : todos).slice(0, max);
}

/** Lectura directa: la ficha se resuelve con un solo get, sin traer el catálogo. */
export async function obtenerProducto(id) {
  if (cache) {
    const enCache = cache.find((p) => p.id === id);
    if (enCache) return enCache;
  }
  const snap = await getDoc(doc(db, COLECCION, id));
  return snap.exists() ? normalizar(snap.id, snap.data()) : null;
}

export async function buscar(texto) {
  const t = String(texto ?? '').trim().toLowerCase();
  if (t.length < 2) return [];
  const todos = await obtenerCatalogo();
  return todos.filter((p) =>
    [p.nombre, p.marca, p.categoria, p.subcategoria, ...p.sabores]
      .filter(Boolean).join(' ').toLowerCase().includes(t));
}

// --- Ayudas de variante --------------------------------------------------

export const hayStock = (v) => Boolean(v) && !v.pausada && (v.stock ?? 0) > 0;

/** Stock bajo pero no agotado: es la condición para mostrar "Quedan N". */
export function stockBajo(producto, variante) {
  const umbral = producto?.umbralStock ?? 5;
  return hayStock(variante) && variante.stock <= umbral;
}

export function buscarVariante(producto, sabor, tamano) {
  return producto.variantes.find((v) =>
    (sabor == null || v.sabor === sabor) && (tamano == null || v.tamano === tamano)) ?? null;
}

/**
 * Primera variante seleccionable. Preferimos la que respeta lo pedido; si esa
 * combinación no existe o está sin stock, se cae a la primera disponible.
 */
export function varianteInicial(producto, { sabor, tamano } = {}) {
  const pedida = (sabor || tamano) ? buscarVariante(producto, sabor ?? null, tamano ?? null) : null;
  if (hayStock(pedida)) return pedida;
  return producto.variantes.find(hayStock) ?? producto.variantes[0] ?? null;
}

/** La primera imagen utilizable, o null para que el CSS ponga el pozo con logo. */
export function fotoDe(producto, indice = 0) {
  return producto?.imagenes?.[indice] ?? producto?.imagenes?.[0] ?? null;
}

export function etiquetaVariante(v) {
  return [v?.sabor, v?.tamano].filter(Boolean).join(' · ');
}
