// Carrito en localStorage. La clave de línea es productoId + varianteId, para
// que dos sabores del mismo producto sean dos líneas distintas.
//
// Guarda el precio solo para poder mostrar el resumen sin releer Firestore.
// Nunca se usa para cobrar: crearPedido lo recalcula en el servidor.
const CLAVE = 'godo.carrito.v2';
const oyentes = new Set();

const claveLinea = (productoId, varianteId) => productoId + '|' + varianteId;

function leer() {
  try {
    const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? '[]');
    return Array.isArray(crudo) ? crudo.filter((l) => l?.productoId && l?.varianteId) : [];
  } catch {
    return [];
  }
}

function guardar(lineas) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(lineas));
  } catch {
    // Modo privado o almacenamiento lleno: el carrito sigue vivo en memoria
    // durante la sesión, que es mejor que romper la página.
  }
  oyentes.forEach((cb) => cb(lineas));
}

export const obtenerCarrito = () => leer();

export const contarUnidades = () => leer().reduce((a, l) => a + l.cantidad, 0);

export const subtotalCarrito = () => leer().reduce((a, l) => a + l.precio * l.cantidad, 0);

export function agregar(producto, variante, cantidad = 1) {
  const lineas = leer();
  const clave = claveLinea(producto.id, variante.varianteId);
  const existente = lineas.find((l) => claveLinea(l.productoId, l.varianteId) === clave);

  if (existente) {
    // No se puede pasar del stock de esa variante.
    existente.cantidad = Math.min(existente.cantidad + cantidad, variante.stock);
  } else {
    lineas.push({
      productoId: producto.id,
      varianteId: variante.varianteId,
      nombre: producto.nombre,
      marca: producto.marca ?? '',
      sabor: variante.sabor ?? '',
      tamano: variante.tamano ?? '',
      precio: variante.precio,
      imagen: producto.imagenes?.[0] ?? null,
      cantidad: Math.min(cantidad, variante.stock)
    });
  }
  guardar(lineas);
  return lineas;
}

export function cambiarCantidad(productoId, varianteId, cantidad) {
  const lineas = leer();
  const linea = lineas.find((l) => claveLinea(l.productoId, l.varianteId) === claveLinea(productoId, varianteId));
  if (!linea) return lineas;

  if (cantidad <= 0) return quitar(productoId, varianteId);
  linea.cantidad = cantidad;
  guardar(lineas);
  return lineas;
}

/** Corrige el precio guardado cuando cambió en Firestore. */
export function actualizarPrecio(productoId, varianteId, nuevoPrecio) {
  const lineas = leer();
  const linea = lineas.find((l) => claveLinea(l.productoId, l.varianteId) === claveLinea(productoId, varianteId));
  if (!linea || linea.precio === nuevoPrecio) return lineas;
  linea.precio = nuevoPrecio;
  guardar(lineas);
  return lineas;
}

export function quitar(productoId, varianteId) {
  const lineas = leer().filter((l) => claveLinea(l.productoId, l.varianteId) !== claveLinea(productoId, varianteId));
  guardar(lineas);
  return lineas;
}

export function vaciar() {
  guardar([]);
}

/** Lo que viaja a crearPedido: solo qué y cuánto, nunca el precio. */
export const itemsParaPedido = () =>
  leer().map((l) => ({ productoId: l.productoId, varianteId: l.varianteId, cantidad: l.cantidad }));

export function alCambiar(cb) {
  oyentes.add(cb);
  cb(leer());
  return () => oyentes.delete(cb);
}

// Otra pestaña tocó el carrito: reflejarlo acá también.
window.addEventListener('storage', (e) => {
  if (e.key === CLAVE) oyentes.forEach((cb) => cb(leer()));
});
