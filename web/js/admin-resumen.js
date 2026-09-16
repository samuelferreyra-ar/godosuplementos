// Panel · Resumen.
//
// La pantalla de entrada: qué hay que hacer hoy. No pretende ser un tablero
// de analítica — muestra solo lo accionable, y cada dato es un atajo a donde
// se resuelve.
import { exigirAdmin, montarPanel, actualizarPendientes, pintarReponer } from './panel.js';
import { escucharCatalogo, nivelDe, variantesAReponer } from './admin-datos.js';
import { db } from './firebase-config.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { precio, esc } from './tienda.js';

const $ = (s) => document.querySelector(s);

let productos = [];
let pedidos = [];
let nombre = '';

const fechaDe = (p) => {
  const v = p.creadoEn ?? p.fecha;
  if (!v) return null;
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

function saludo() {
  const h = new Date().getHours();
  const momento = h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  return momento + (nombre ? ', ' + nombre.split(' ')[0] : '');
}

// --- Piezas --------------------------------------------------------------

function tarjetasAccion() {
  const sinPreparar = pedidos.filter((p) => p.estado === 'sin_preparar' || p.estado === 'recibido').length;
  const aReponer = variantesAReponer(productos);
  const sinFoto = productos.filter((p) => !p.archivado && !(p.imagenes ?? []).length).length;

  const tarjeta = (icono, valor, titulo, nota, href, urgente) => `
    <a class="r-accion ${urgente ? 'es-urgente' : ''}" href="${href}">
      <span class="r-icono"><i class="bi bi-${icono}"></i></span>
      <span class="r-cuerpo">
        <b>${valor}</b>
        <span class="r-titulo">${esc(titulo)}</span>
        <small>${esc(nota)}</small>
      </span>
      <i class="bi bi-chevron-right"></i>
    </a>`;

  return `<div class="r-acciones">
    ${tarjeta('bag-check', sinPreparar, sinPreparar === 1 ? 'pedido sin preparar' : 'pedidos sin preparar',
      sinPreparar ? 'Armalos y marcá el avance' : 'Nada pendiente', 'admin-pedidos.html', sinPreparar > 0)}
    ${tarjeta('box-seam', aReponer, aReponer === 1 ? 'sabor para reponer' : 'sabores para reponer',
      aReponer ? 'Cargá la entrada de stock' : 'Todo con stock suficiente', 'admin-productos.html', aReponer > 0)}
    ${sinFoto ? tarjeta('image', sinFoto, sinFoto === 1 ? 'producto sin foto' : 'productos sin foto',
      'Se ven con el logo en su lugar', 'admin-productos.html', false) : ''}
  </div>`;
}

function tarjetasNumero() {
  const ahora = new Date();
  const desdeMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const vivos = pedidos.filter((p) => p.estado !== 'cancelado');
  const delMes = vivos.filter((p) => { const f = fechaDe(p); return f && f >= desdeMes; });
  const facturado = delMes.reduce((a, p) => a + (p.total ?? 0), 0);

  const publicados = productos.filter((p) => !p.archivado && (p.variantesActivas ?? 0) > 0).length;
  const unidades = productos.filter((p) => !p.archivado).reduce((a, p) => a + (p.stockTotal ?? 0), 0);

  const kpi = (etiqueta, valor, nota) => `
    <div class="n-kpi"><span>${etiqueta}</span><b>${valor}</b><small>${esc(nota)}</small></div>`;

  return `<div class="n-kpis">
    ${kpi('Facturado este mes', precio(facturado), delMes.length + ' pedido' + (delMes.length === 1 ? '' : 's'))}
    ${kpi('Ticket promedio', precio(delMes.length ? Math.round(facturado / delMes.length) : 0), 'del mes en curso')}
    ${kpi('Productos publicados', publicados, 'de ' + productos.filter((p) => !p.archivado).length + ' en el catálogo')}
    ${kpi('Unidades en stock', unidades, 'sumando todas las variantes')}
  </div>`;
}

function ultimosPedidos() {
  const ultimos = [...pedidos]
    .sort((a, b) => (fechaDe(b)?.getTime() ?? 0) - (fechaDe(a)?.getTime() ?? 0))
    .slice(0, 5);

  if (!ultimos.length) return '';

  return `<section style="margin-top:22px">
    <div class="r-seccion-alto">
      <h2 class="g-titulo-seccion" style="font-size:20px">Últimos pedidos</h2>
      <a class="r-ver-todo" href="admin-pedidos.html">Ver todos</a>
    </div>
    <div class="r-ultimos">
      ${ultimos.map((p) => {
        const f = fechaDe(p);
        return `<a class="g-tarjeta r-ultimo" href="admin-pedidos.html">
          <span class="r-ultimo-nombre">${esc(p.contacto?.nombre || p.usuario?.nombre || 'Cliente')}</span>
          <span class="g-nota">${f ? f.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—'}</span>
          <span class="r-ultimo-total">${precio(p.total ?? 0)}</span>
        </a>`;
      }).join('')}
    </div>
  </section>`;
}

function reponerAhora() {
  const criticas = productos
    .filter((p) => !p.archivado)
    .flatMap((p) => (p.listaVariantes ?? [])
      .filter((v) => nivelDe(p, v) !== 'normal')
      .map((v) => ({ producto: p, variante: v })))
    .sort((a, b) => (Number(a.variante.stock) || 0) - (Number(b.variante.stock) || 0))
    .slice(0, 6);

  if (!criticas.length) return '';

  return `<section style="margin-top:22px">
    <div class="r-seccion-alto">
      <h2 class="g-titulo-seccion" style="font-size:20px">Lo primero para reponer</h2>
      <a class="r-ver-todo" href="admin-productos.html">Ver todo</a>
    </div>
    <div class="r-ultimos">
      ${criticas.map(({ producto, variante }) => {
        const stock = Number(variante.stock) || 0;
        return `<a class="g-tarjeta r-ultimo" href="admin-productos.html">
          <span class="r-ultimo-nombre">${esc(producto.nombre)}</span>
          <span class="g-nota">${esc([variante.sabor, variante.tamano].filter(Boolean).join(' · ') || 'Único')}</span>
          <span class="r-ultimo-total ${stock === 0 ? 'es-cero' : 'es-bajo'}">${stock === 0 ? 'sin stock' : stock + ' u'}</span>
        </a>`;
      }).join('')}
    </div>
  </section>`;
}

function render() {
  $('#encabezado').innerHTML = `
    <div>
      <h1 class="n-titulo">${esc(saludo())}</h1>
      <p class="n-contexto">Esto es lo que hay para hacer hoy</p>
    </div>`;

  $('#lista').innerHTML = tarjetasAccion() + tarjetasNumero() + reponerAhora() + ultimosPedidos();
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  const sesion = await exigirAdmin();
  if (!sesion) return;
  nombre = sesion.datos?.nombre ?? '';
  montarPanel('resumen');
  render();

  escucharCatalogo((lista) => {
    productos = lista;
    pintarReponer(variantesAReponer(lista));
    render();
  });

  onSnapshot(collection(db, 'pedidos'), (snap) => {
    pedidos = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter(p => !p.esPrueba);
    actualizarPendientes(pedidos.filter((p) => p.estado === 'sin_preparar' || p.estado === 'recibido').length);
    render();
  }, (e) => console.warn('No se pudieron leer los pedidos:', e));
}

iniciar();
