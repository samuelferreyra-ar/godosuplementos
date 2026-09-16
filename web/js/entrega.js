// Cómo recibe el pedido el cliente: retiro o envío, y en qué zona.
//
// Se elige en el carrito y viaja al checkout por localStorage, para que no
// tenga que decidirlo dos veces. El costo que se muestra es informativo: el
// que se cobra lo recalcula crearPedido contra config/tienda.
const CLAVE = 'godo.entrega.v1';

export function obtenerEntrega() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (guardado?.tipo === 'retiro' || (guardado?.tipo === 'envio' && guardado.zona)) return guardado;
  } catch { /* dato ilegible: se empieza de nuevo */ }
  return { tipo: 'retiro', zona: null };
}

export function guardarEntrega(entrega) {
  try { localStorage.setItem(CLAVE, JSON.stringify(entrega)); } catch { /* sin persistencia */ }
  return entrega;
}

/** Costo a mostrar, con el umbral de envío gratis ya aplicado. */
export function costoEntrega(entrega, subtotal, config, zonas) {
  if (entrega.tipo === 'retiro') return { costo: 0, gratis: false, etiqueta: 'Retiro en el local' };

  const zona = zonas.find((z) => z.id === entrega.zona);
  if (!zona) return { costo: null, gratis: false, etiqueta: 'Elegí la zona' };

  const umbral = config?.umbralEnvioGratis;
  if (typeof umbral === 'number' && umbral > 0 && subtotal >= umbral) {
    return { costo: 0, gratis: true, etiqueta: zona.nombre };
  }
  return { costo: zona.costo, gratis: false, etiqueta: zona.nombre };
}
