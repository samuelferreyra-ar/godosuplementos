const STORAGE_KEY = 'godo_carrito';

export function getCarrito() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) { return []; }
}

export function setCarrito(carrito) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito));
}

export function vaciarCarrito() {
  localStorage.removeItem(STORAGE_KEY);
}

export function agregarProducto(producto, cantidad = 1) {
  let carrito = getCarrito();
  const idx = carrito.findIndex(p => p.id === producto.id);
  if (idx > -1) {
    carrito[idx].cantidad += cantidad;
  } else {
    carrito.push({ ...producto, cantidad });
  }
  setCarrito(carrito);
  return carrito;
}

export function actualizarCantidad(id, nuevaCantidad) {
  let carrito = getCarrito();
  carrito = carrito.map(item =>
    item.id === id ? { ...item, cantidad: nuevaCantidad } : item
  ).filter(item => item.cantidad > 0);
  setCarrito(carrito);
  return carrito;
}

export function eliminarProducto(id) {
  let carrito = getCarrito().filter(item => item.id !== id);
  setCarrito(carrito);
  return carrito;
}