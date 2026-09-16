// Lectura de los pedidos del cliente.
//
// Las reglas solo dejan leer los propios. Los pedidos viejos guardan el dueño
// en `usuario.uid` y los nuevos en `clienteId`, así que se consultan los dos.
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc } from './tienda.js';

export const ESTADOS = {
  sin_preparar: { texto: 'Recibido', tono: 'aviso' },
  listo_retirar: { texto: 'Listo para retirar', tono: 'ok' },
  en_camino: { texto: 'En camino', tono: 'aviso' },
  entregado: { texto: 'Entregado', tono: 'ok' },
  cancelado: { texto: 'Cancelado', tono: 'sin' }
};

export const etiquetaEstado = (estado) => ESTADOS[estado] ?? { texto: estado ?? 'En proceso', tono: 'aviso' };

export const pildoraEstado = (estado) => {
  const e = etiquetaEstado(estado);
  return '<span class="g-pildora g-pildora-' + e.tono + '">' + esc(e.texto) + '</span>';
};

/** Fecha del pedido, del campo nuevo o del viejo. */
function fechaDe(p) {
  const v = p.creadoEn ?? p.fecha;
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const formatoFecha = (d) => (d
  ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  : 'sin fecha');

/** Normaliza un pedido, venga del modelo viejo o del nuevo. */
function normalizar(id, p) {
  const items = p.items ?? p.productos ?? [];
  return {
    id,
    numero: p.numero ?? p.numero_pedido ?? id.slice(0, 6),
    estado: p.estado ?? 'sin_preparar',
    fecha: fechaDe(p),
    items: items.map((i) => ({
      productoId: i.productoId ?? i.id ?? null,
      nombre: i.nombre ?? 'Producto',
      sabor: i.sabor ?? '',
      tamano: i.tamano ?? '',
      cantidad: i.cantidad ?? 1,
      precio: i.precio ?? 0,
      subtotal: i.subtotal ?? (i.precio ?? 0) * (i.cantidad ?? 1)
    })),
    total: p.total ?? items.reduce((a, i) => a + (i.precio ?? 0) * (i.cantidad ?? 1), 0),
    envio: p.envio ?? null,
    pago: p.pago ?? null,
    cupon: p.cupon ?? null,
    descuento: p.descuento ?? 0
  };
}

/**
 * Pedidos del usuario, del más nuevo al más viejo.
 * Se ordena en el cliente: con `where` más `orderBy` Firestore pediría un
 * índice compuesto, y a este volumen no vale la pena.
 */
export async function pedidosDe(uid) {
  const col = collection(db, 'pedidos');
  const consultas = [
    getDocs(query(col, where('clienteId', '==', uid))),
    getDocs(query(col, where('usuario.uid', '==', uid)))
  ];

  const resultados = await Promise.allSettled(consultas);
  const porId = new Map();
  for (const r of resultados) {
    if (r.status !== 'fulfilled') continue;
    r.value.forEach((d) => porId.set(d.id, normalizar(d.id, d.data())));
  }

  return [...porId.values()].sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
}

/** El pedido que todavía está en curso, si hay alguno. */
export const enCurso = (pedidos) =>
  pedidos.find((p) => !['entregado', 'cancelado'].includes(p.estado)) ?? null;
