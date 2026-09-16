// Panel · Pedidos.
//
// Es la pantalla que el dueño abre todos los días: qué hay que preparar, para
// quién y cómo se entrega.
//
// El cambio de estado se escribe directo desde acá porque las reglas solo
// permiten tocar `estado`. Cancelar es distinto: pasa por la Cloud Function,
// que además devuelve el stock al catálogo.
import { exigirAdmin, montarPanel, actualizarPendientes, avisar } from './panel.js';
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { llamar } from './funciones.js';
import { precio, esc } from './tienda.js';

const $ = (s) => document.querySelector(s);

const ESTADOS = [
  { id: 'sin_preparar', texto: 'Sin preparar' },
  { id: 'listo_retirar', texto: 'Listo para retirar' },
  { id: 'en_camino', texto: 'En camino' },
  { id: 'entregado', texto: 'Entregado' }
];

let pedidos = [];
let busqueda = '';
const abiertos = new Set();

// --- Normalización -------------------------------------------------------

function fechaDe(p) {
  const v = p.creadoEn ?? p.fecha;
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Los pedidos de julio de 2025 usaban Date.now() como número y 'recibido'
// como estado. Se traducen para que convivan con los nuevos sin ensuciar
// la pantalla ni perder información.
const ES_TIMESTAMP = 1e10;
const ESTADOS_VIEJOS = { recibido: 'sin_preparar', preparando: 'sin_preparar', entregado: 'entregado', cancelado: 'cancelado' };

function numeroDe(id, p) {
  const n = Number(p.numero ?? p.numero_pedido);
  if (Number.isFinite(n) && n > 0 && n < ES_TIMESTAMP) return String(n);
  return id.slice(0, 6).toUpperCase();
}

function normalizar(id, p) {
  const items = p.items ?? p.productos ?? [];
  return {
    id,
    esPrueba: p.esPrueba === true,
    numero: numeroDe(id, p),
    estado: ESTADOS_VIEJOS[p.estado] ?? p.estado ?? 'sin_preparar',
    esViejo: !Number.isFinite(Number(p.numero)) || Number(p.numero ?? p.numero_pedido) >= ES_TIMESTAMP,
    fecha: fechaDe(p),
    contacto: {
      // Con ?? una cadena vacía pasa igual; con || cae al respaldo.
      nombre: p.contacto?.nombre || p.usuario?.nombre || p.usuario?.email || 'Cliente sin nombre',
      email: p.contacto?.email || p.usuario?.email || '',
      telefono: p.contacto?.telefono || p.usuario?.telefono || ''
    },
    items: items.map((i) => ({
      nombre: i.nombre ?? 'Producto',
      sabor: i.sabor ?? '', tamano: i.tamano ?? '',
      cantidad: i.cantidad ?? 1,
      subtotal: i.subtotal ?? (i.precio ?? 0) * (i.cantidad ?? 1)
    })),
    envio: p.envio ?? (p.metodo_entrega ? { tipo: p.metodo_entrega } : null),
    direccion: p.envio?.direccion ?? p.direccion ?? null,
    pago: p.pago ?? (p.metodo_pago ? { metodo: p.metodo_pago, estado: 'pendiente' } : null),
    cupon: p.cupon ?? null,
    descuento: p.descuento ?? 0,
    subtotal: p.subtotal ?? null,
    total: p.total ?? items.reduce((a, i) => a + (i.precio ?? 0) * (i.cantidad ?? 1), 0),
    canal: p.canal ?? 'web'
  };
}

// --- Formato -------------------------------------------------------------

const hora = (d) => (d ? d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '');
const dia = (d) => (d ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : 'sin fecha');

function antiguedad(d) {
  if (!d) return '';
  const horas = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (horas < 1) return 'hace minutos';
  if (horas < 24) return 'hace ' + horas + ' h';
  const dias = Math.floor(horas / 24);
  return 'hace ' + dias + (dias === 1 ? ' día' : ' días');
}

const textoEstado = (id) => ESTADOS.find((e) => e.id === id)?.texto ?? (id === 'cancelado' ? 'Cancelado' : id);
const pildora = (id) => `<span class="g-pildora p-estado-${esc(String(id).replace(/_/g, '-'))}">${esc(textoEstado(id))}</span>`;

function comoLlega(p) {
  if (!p.envio) return '—';
  if (p.envio.tipo === 'retiro') return 'Retiro en el local';
  return 'Envío' + (p.envio.nombreZona ? ' · ' + p.envio.nombreZona : '');
}

const resumenProductos = (p) => {
  const unidades = p.items.reduce((a, i) => a + i.cantidad, 0);
  const nombres = p.items.map((i) => i.nombre).slice(0, 2).join(', ');
  return unidades + ' u · ' + nombres + (p.items.length > 2 ? '…' : '');
};

// --- KPIs ----------------------------------------------------------------

function kpis() {
  const vivos = pedidos.filter((p) => p.estado !== 'cancelado' && !p.esPrueba);
  const sinPreparar = vivos.filter((p) => p.estado === 'sin_preparar');
  const enCamino = vivos.filter((p) => p.estado === 'en_camino');
  const masViejo = sinPreparar.map((p) => p.fecha).filter(Boolean).sort((a, b) => a - b)[0];
  const ticket = vivos.length ? Math.round(vivos.reduce((a, p) => a + p.total, 0) / vivos.length) : 0;

  // El diseño pedía "carritos sin pagar", pero no guardamos carritos
  // abandonados: no hay con qué calcularlo. Se muestra algo que sí existe y
  // que además hay que perseguir: pedidos confirmados cuyo pago no entró.
  const sinPagar = vivos.filter((p) => p.pago && p.pago.estado !== 'pagado');

  const tarjeta = (etiqueta, valor, nota, urgente = false) => `
    <div class="n-kpi ${urgente ? 'es-urgente' : ''}">
      <span>${etiqueta}</span><b>${valor}</b><small>${esc(nota)}</small>
    </div>`;

  return `<div class="n-kpis">
    ${tarjeta('Sin preparar', sinPreparar.length, masViejo ? 'el más viejo, ' + antiguedad(masViejo) : 'nada pendiente', sinPreparar.length > 0)}
    ${tarjeta('En camino', enCamino.length, enCamino.length ? 'en la calle ahora' : 'nada en tránsito')}
    ${tarjeta('Ticket promedio', precio(ticket), vivos.length + ' pedido' + (vivos.length === 1 ? '' : 's'))}
    ${tarjeta('Pago pendiente', sinPagar.length, sinPagar.length ? 'esperando comprobante' : 'todo cobrado')}
  </div>`;
}

// --- Filas ---------------------------------------------------------------

function detalle(p) {
  const d = p.direccion;
  const domicilio = d ? [d.calle, d.numero, d.piso ? 'piso ' + d.piso : '', d.departamento ? 'depto ' + d.departamento : '', d.localidad]
    .filter(Boolean).join(' ') : null;

  const botones = ESTADOS.map((e) => `<button data-estado="${p.id}|${e.id}"
    class="${p.estado === e.id ? 'es-actual' : ''}" ${p.estado === 'cancelado' || p.esPrueba ? 'disabled' : ''}>${e.texto}</button>`).join('');

  return `<div class="n-detalle">
    ${p.esPrueba ? `<p><strong>PRUEBA MODO · No preparar ni entregar.</strong> <a href="confirmacion.html?modo=1&pedido=${encodeURIComponent(p.id)}">Consultar o finalizar la prueba</a></p>` : ''}
    <div class="n-detalle-columnas">
      <div>
        <ul>${p.items.map((i) => `<li>${esc(i.nombre)}${
          [i.sabor, i.tamano].filter(Boolean).length ? ' (' + esc([i.sabor, i.tamano].filter(Boolean).join(' · ')) + ')' : ''
        } × ${i.cantidad} — ${precio(i.subtotal)}</li>`).join('')}</ul>
      </div>
      <div class="n-detalle-datos">
        <div><span>Cliente:</span> ${esc(p.contacto.nombre)}</div>
        <div><span>Teléfono:</span> ${esc(p.contacto.telefono || '—')}</div>
        <div><span>Mail:</span> ${esc(p.contacto.email || '—')}</div>
        <div><span>Entrega:</span> ${esc(comoLlega(p))}</div>
        ${domicilio ? `<div><span>Dirección:</span> ${esc(domicilio)}</div>` : ''}
        <div><span>Pago:</span> ${esc(p.pago?.metodo ?? '—')}${p.pago?.estado ? ' · ' + esc(p.pago.estado) : ''}</div>
        ${p.cupon ? `<div><span>Cupón:</span> ${esc(p.cupon.codigo)} (−${precio(p.descuento)})</div>` : ''}
        <div><span>Canal:</span> ${p.canal === 'whatsapp' ? 'WhatsApp' : 'Web'}</div>
      </div>
    </div>
    <div class="n-cambiar-estado">
      ${botones}
      ${p.esPrueba ? '' : p.estado === 'cancelado'
        ? '<span class="g-nota">Pedido cancelado; el stock volvió al catálogo.</span>'
        : `<button class="es-cancelar" data-cancelar="${p.id}">Cancelar pedido</button>`}
    </div>
  </div>`;
}

function fila(p) {
  const abierto = abiertos.has(p.id);
  return `<article class="n-pedido g-tarjeta">
    <div class="n-pedido-fila ${abierto ? 'es-abierta' : ''}" data-abrir="${p.id}">
      <div class="n-pedido-alto">
        <span class="n-pedido-numero">#${esc(p.numero)}</span>
        <div class="n-pedido-cliente">
          <b>${p.esPrueba ? '[PRUEBA MODO] ' : ''}${esc(p.contacto.nombre)}</b>
          <small>${dia(p.fecha)} ${hora(p.fecha)}</small>
        </div>
        <span class="n-pedido-productos">${esc(resumenProductos(p))}</span>
        <span class="n-pedido-total">${precio(p.total)}</span>
        <span class="n-pedido-entrega">${esc(comoLlega(p))}</span>
        ${pildora(p.estado)}
        <button class="n-mas" aria-label="Ver detalle"><i class="bi bi-chevron-${abierto ? 'up' : 'down'}"></i></button>
      </div>
    </div>
    ${abierto ? detalle(p) : ''}
  </article>`;
}

// --- Render --------------------------------------------------------------

function visibles() {
  if (!busqueda) return pedidos;
  const t = busqueda.toLowerCase();
  return pedidos.filter((p) => [String(p.numero), p.contacto.nombre, p.contacto.telefono, p.contacto.email]
    .filter(Boolean).join(' ').toLowerCase().includes(t));
}

function render() {
  const lista = visibles();
  const hoy = new Date().toDateString();
  const deHoy = pedidos.filter((p) => p.fecha?.toDateString() === hoy && p.estado !== 'cancelado' && !p.esPrueba);
  const facturadoHoy = deHoy.reduce((a, p) => a + p.total, 0);

  $('#encabezado').innerHTML = `
    <div>
      <h1 class="n-titulo">Pedidos</h1>
      <p class="n-contexto">${deHoy.length} ${deHoy.length === 1 ? 'nuevo' : 'nuevos'} hoy · ${precio(facturadoHoy)} facturados</p>
    </div>
    <div class="n-acciones">
      <div class="n-buscador">
        <i class="bi bi-search"></i>
        <input id="buscar" type="search" placeholder="Buscar por número o cliente"
          value="${esc(busqueda)}" autocomplete="off">
      </div>
    </div>`;

  $('#kpis').innerHTML = kpis();

  $('#lista').innerHTML = lista.length
    ? `<div class="n-pedidos-cabecera d-solo">
         <span>Nº</span><span>Cliente</span><span>Productos</span><span>Total</span>
         <span>Entrega</span><span>Estado</span><span></span>
       </div>
       ${lista.map(fila).join('')}`
    : '<div class="n-vacio">' + (busqueda ? 'Ningún pedido coincide con la búsqueda.' : 'Todavía no hay pedidos.') + '</div>';

  conectar();
}

function conectar() {
  const buscar = $('#buscar');
  if (buscar) {
    buscar.oninput = () => {
      busqueda = buscar.value.trim();
      render();
      const nuevo = $('#buscar');
      nuevo.focus();
      nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
    };
  }

  document.querySelectorAll('[data-abrir]').forEach((f) => {
    f.onclick = () => {
      const id = f.dataset.abrir;
      if (abiertos.has(id)) abiertos.delete(id); else abiertos.add(id);
      render();
    };
  });

  document.querySelectorAll('[data-estado]').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const [id, estado] = b.dataset.estado.split('|');
      const antes = pedidos.find((p) => p.id === id)?.estado;
      if (antes === estado) return;
      try {
        // Las reglas solo dejan cambiar `estado`: cualquier otro campo se rechaza.
        await updateDoc(doc(db, 'pedidos', id), { estado, actualizadoEn: serverTimestamp() });
        avisar('Pedido marcado como "' + textoEstado(estado) + '"', {
          icono: 'check-circle',
          etiqueta: 'Deshacer',
          accion: () => updateDoc(doc(db, 'pedidos', id), { estado: antes, actualizadoEn: serverTimestamp() })
        });
      } catch (err) {
        avisar('No se pudo cambiar el estado: ' + err.message, { icono: 'exclamation-triangle', segundos: 6 });
      }
    };
  });

  document.querySelectorAll('[data-cancelar]').forEach((b) => {
    b.onclick = async (e) => {
      e.stopPropagation();
      const id = b.dataset.cancelar;
      const p = pedidos.find((x) => x.id === id);
      if (!confirm('¿Cancelar el pedido #' + p.numero + '?\n\nEl stock vuelve al catálogo. El cupón, si usó uno, no se libera.')) return;

      b.disabled = true;
      b.textContent = 'Cancelando…';
      try {
        // Por la Function, que devuelve el stock dentro de una transacción.
        await llamar('cancelarPedido', { pedidoId: id, motivo: 'cancelado desde el panel' });
        avisar('Pedido #' + p.numero + ' cancelado y stock devuelto', { icono: 'arrow-counterclockwise', segundos: 5 });
      } catch (err) {
        avisar('No se pudo cancelar: ' + (err.mensaje ?? err.message), { icono: 'exclamation-triangle', segundos: 6 });
        b.disabled = false;
        b.textContent = 'Cancelar pedido';
      }
    };
  });
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  const sesion = await exigirAdmin();
  if (!sesion) return;

  montarPanel('pedidos');

  onSnapshot(collection(db, 'pedidos'),
    (snap) => {
      pedidos = snap.docs
        .map((d) => normalizar(d.id, d.data()))
        // Se ordena acá: con orderBy, los pedidos viejos sin `creadoEn`
        // quedarían fuera de la consulta.
        .sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));

      actualizarPendientes(pedidos.filter((p) => p.estado === 'sin_preparar').length);
      render();
    },
    (e) => {
      console.error('Se perdió la escucha de pedidos:', e);
      $('#lista').innerHTML = '<div class="n-vacio">Se perdió la conexión. Recargá la página.</div>';
    });
}

iniciar();
