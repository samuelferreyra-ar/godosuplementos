// Tarjeta de producto, compartida por la home, las categorías y la búsqueda.
//
// El botón "Agregar" solo agrega directo cuando el producto tiene una sola
// variante disponible. Si tiene varias, lleva a la ficha: elegirle el sabor
// al cliente sería adivinar.
import { hayStock, stockBajo, fotoDe } from './catalogo.js';
import { precio, esc } from './tienda.js';
import { agregar } from './carrito.js';
import { latirCarrito } from './nav.js';

/** La variante que representa al producto en un listado: la más barata con stock. */
export function varianteVitrina(p) {
  const disponibles = p.variantes.filter(hayStock);
  return disponibles.sort((a, b) => a.precio - b.precio)[0] ?? p.variantes[0] ?? null;
}

function lineaVariantes(p) {
  const sabores = p.sabores.filter((s) => p.variantes.some((v) => v.sabor === s && hayStock(v)));
  const tamanos = p.tamanos.filter((t) => p.variantes.some((v) => v.tamano === t && hayStock(v)));
  const partes = [];
  if (sabores.length > 1) partes.push(sabores.length + ' sabores');
  else if (sabores.length === 1) partes.push(sabores[0]);
  if (tamanos.length > 1) partes.push(tamanos.length + ' tamaños');
  else if (tamanos.length === 1 && tamanos[0] !== 'Único') partes.push(tamanos[0]);
  return partes.join(' · ');
}

export function tarjetaProducto(p) {
  const v = varianteVitrina(p);
  const foto = fotoDe(p);
  const unaSola = p.variantes.filter(hayStock).length === 1;
  const bajo = stockBajo(p, v);
  const desde = p.precioMin !== p.precioMax;

  return `<article class="t-card g-tarjeta" data-producto="${esc(p.id)}">
    <a href="producto.html?id=${encodeURIComponent(p.id)}" class="t-foto g-foto">
      ${foto ? `<img src="${esc(foto)}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.remove()">` : ''}
      ${bajo ? `<span class="t-badge">quedan ${v.stock}</span>` : ''}
    </a>
    <div class="t-cuerpo">
      <span class="t-marca">${esc(p.marca)}</span>
      <a href="producto.html?id=${encodeURIComponent(p.id)}" class="t-nombre">${esc(p.nombre)}</a>
      <span class="t-variantes">${esc(lineaVariantes(p))}</span>
      <span class="t-precio">${desde ? 'desde ' : ''}${precio(p.precioMin)}</span>
      ${unaSola
        ? `<button class="t-agregar" data-agregar="${esc(p.id)}">Agregar</button>`
        : `<a class="t-agregar" href="producto.html?id=${encodeURIComponent(p.id)}">Elegir</a>`}
    </div>
  </article>`;
}

/**
 * Señal de que el producto entró al carrito: texto, tilde y color.
 * Se guarda el contenido original para poder volver a dejarlo como estaba.
 */
export function marcarAgregado(boton, textoOriginal = 'Agregar') {
  if (boton.dataset.ocupado) return;
  boton.dataset.ocupado = '1';
  boton.classList.add('es-agregado');
  boton.innerHTML = '<i class="bi bi-check-lg"></i> Agregado';
  setTimeout(() => {
    boton.classList.remove('es-agregado');
    boton.textContent = textoOriginal;
    delete boton.dataset.ocupado;
  }, 1400);
}

/** Conecta los botones "Agregar" de un contenedor ya renderizado. */
export function conectarTarjetas(raiz, catalogo) {
  raiz.querySelectorAll('[data-agregar]').forEach((b) => {
    b.onclick = () => {
      const p = catalogo.find((x) => x.id === b.dataset.agregar);
      const v = p?.variantes.find(hayStock);
      if (!p || !v) return;
      agregar(p, v, 1);
      latirCarrito();
      marcarAgregado(b);
    };
  });
}

export const ESTILOS_TARJETA = `
  .t-card { overflow: hidden; display: flex; flex-direction: column; }
  .t-foto { position: relative; display: block; height: 108px; margin: 10px 10px 0; border-radius: 12px; }
  .t-badge { position: absolute; top: 6px; right: 6px; background: var(--godo-paper); border-radius: 999px; padding: 2px 8px; font-size: 10.5px; font-weight: 600; color: var(--godo-warn-text); }
  .t-cuerpo { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 3px; flex: 1; }
  .t-marca { font-size: 10px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--godo-muted-2); }
  .t-nombre { font-family: var(--titulo); font-size: 17px; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; line-height: 1.1; min-height: 37px; color: var(--godo-navy); }
  .t-variantes { font-size: 10.5px; color: var(--godo-muted); min-height: 14px; }
  .t-precio { font-size: 18px; font-weight: 700; margin-top: 2px; }
  .t-agregar { display: block; width: 100%; margin-top: 9px; padding: 9px 14px; text-align: center;
    background: var(--godo-amber); color: var(--godo-navy); border: 0; border-radius: 12px; cursor: pointer;
    font-family: var(--titulo); font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
  .t-agregar:hover { background: var(--godo-amber-hover); }
  @media (min-width: 1024px) {
    .t-foto { height: 150px; }
    .t-nombre { font-size: 21px; min-height: 46px; }
    .t-precio { font-size: 22px; }
    .t-variantes { font-size: 12.5px; }
    .t-card:hover { border-color: var(--godo-navy); }
  }
`;
