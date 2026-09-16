// Panel · Cupones.
//
// Los códigos los genera el dueño y los entrega a mano: el sitio nunca los
// ofrece solo. Cada uno es de un solo uso, así que esta pantalla es sobre
// todo para generar lotes y ver cuáles ya se canjearon.
import { exigirAdmin, montarPanel, avisar } from './panel.js';
import { db } from './firebase-config.js';
import { collection, onSnapshot, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { llamar } from './funciones.js';
import { esc } from './tienda.js';

const $ = (s) => document.querySelector(s);

let cupones = [];
let solapa = 'disponibles';
let generando = false;
let recienGenerados = [];
let errorLectura = null;

const SOLAPAS = [
  { id: 'disponibles', texto: 'Disponibles' },
  { id: 'usados', texto: 'Usados' },
  { id: 'baja', texto: 'Dados de baja' }
];

const fecha = (v) => {
  if (!v) return null;
  const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const formato = (d) => (d ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function estadoDe(c) {
  if (c.activo === false) return { id: 'baja', texto: 'Dado de baja', tono: 'sin' };
  if ((c.usos ?? 0) >= (c.maxUsos ?? 1)) return { id: 'usado', texto: 'Usado', tono: 'ok' };
  const vence = fecha(c.venceEn);
  if (vence && vence < new Date()) return { id: 'vencido', texto: 'Vencido', tono: 'sin' };
  return { id: 'disponible', texto: 'Disponible', tono: 'aviso' };
}

const cumple = (c, id) => {
  const e = estadoDe(c).id;
  if (id === 'disponibles') return e === 'disponible';
  if (id === 'usados') return e === 'usado';
  return e === 'baja' || e === 'vencido';
};

// --- Render --------------------------------------------------------------

function formulario() {
  return `<section class="g-tarjeta" style="padding:16px;margin-bottom:16px">
    <h2 class="g-titulo-seccion" style="font-size:20px;margin:0 0 4px">Generar códigos</h2>
    <p class="g-nota" style="margin:0 0 14px">Cada código sirve una sola vez. Generá los que vayas a entregar.</p>
    <div class="c-generar">
      <div class="a-f">
        <label for="porcentaje">Descuento</label>
        <select id="porcentaje">
          <option value="5">5%</option>
          <option value="7">7%</option>
        </select>
      </div>
      <div class="a-f">
        <label for="cantidad">Cantidad</label>
        <input id="cantidad" type="number" min="1" max="50" value="5">
      </div>
      <div class="a-f">
        <label for="dias">Vence en (días)</label>
        <input id="dias" type="number" min="0" value="0" placeholder="0 = sin vencimiento">
      </div>
      <div class="a-f" style="flex:1">
        <label for="nota">Nota interna <span style="color:var(--godo-disabled);font-weight:400">· opcional</span></label>
        <input id="nota" placeholder="Para clientes de septiembre">
      </div>
      <button class="g-btn g-btn-primario" id="generar" ${generando ? 'disabled' : ''}>
        ${generando ? 'Generando…' : 'Generar'}
      </button>
    </div>
  </section>`;
}

function recienGeneradosBloque() {
  if (!recienGenerados.length) return '';
  return `<section class="g-tarjeta c-recien" >
    <div class="c-recien-alto">
      <div>
        <b>${recienGenerados.length} código${recienGenerados.length === 1 ? '' : 's'} listo${recienGenerados.length === 1 ? '' : 's'}</b>
        <small>Copialos ahora: después los vas a ver en la lista, pero acá los tenés juntos.</small>
      </div>
      <button class="g-btn g-btn-borde" id="copiar-todos">Copiar todos</button>
    </div>
    <div class="c-codigos">
      ${recienGenerados.map((c) => `<code class="c-codigo" data-copiar="${esc(c)}" title="Copiar">${esc(c)}</code>`).join('')}
    </div>
  </section>`;
}

function fila(c) {
  const estado = estadoDe(c);
  const usado = fecha(c.usadoEn);
  const vence = fecha(c.venceEn);

  return `<article class="g-tarjeta c-cupon">
    <code class="c-codigo" data-copiar="${esc(c.id)}" title="Copiar">${esc(c.id)}</code>
    <span class="c-porcentaje">${c.porcentaje}%</span>
    <span class="c-nota-cupon">${esc(c.nota || '—')}</span>
    <span class="c-fecha">${usado ? 'Usado el ' + formato(usado) : vence ? 'Vence ' + formato(vence) : 'Sin vencimiento'}</span>
    <span class="g-pildora g-pildora-${estado.tono}">${esc(estado.texto)}</span>
    ${estado.id === 'disponible'
      ? `<button class="n-mas" data-baja="${esc(c.id)}" title="Dar de baja" aria-label="Dar de baja"><i class="bi bi-x-circle"></i></button>`
      : '<span></span>'}
  </article>`;
}

function render() {
  const lista = cupones.filter((c) => cumple(c, solapa));
  const disponibles = cupones.filter((c) => estadoDe(c).id === 'disponible').length;
  const usados = cupones.filter((c) => estadoDe(c).id === 'usado').length;

  $('#encabezado').innerHTML = `
    <div>
      <h1 class="n-titulo">Cupones</h1>
      <p class="n-contexto">${disponibles} sin usar · ${usados} canjeado${usados === 1 ? '' : 's'}</p>
    </div>`;

  $('#solapas').innerHTML = SOLAPAS.map((s) => `
    <button class="n-solapa ${s.id === solapa ? 'es-activa' : ''}" data-solapa="${s.id}">
      ${s.texto}<em>${cupones.filter((c) => cumple(c, s.id)).length}</em>
    </button>`).join('');

  $('#lista').innerHTML = formulario() + recienGeneradosBloque() + (errorLectura
    ? '<div class="n-vacio">' + esc(errorLectura) + '</div>'
    : lista.length
    ? `<div class="c-lista-cupones">
         <div class="c-cupones-cabecera d-solo">
           <span>Código</span><span>Desc.</span><span>Nota</span><span>Fecha</span><span>Estado</span><span></span>
         </div>
         ${lista.map(fila).join('')}
       </div>`
    : '<div class="n-vacio">No hay cupones en esta solapa.</div>');

  conectar();
}

async function copiar(texto, elemento) {
  try {
    await navigator.clipboard.writeText(texto);
    if (elemento) {
      const original = elemento.textContent;
      elemento.textContent = '¡copiado!';
      elemento.classList.add('es-copiado');
      setTimeout(() => { elemento.textContent = original; elemento.classList.remove('es-copiado'); }, 1200);
    }
  } catch {
    // Sin permiso de portapapeles: al menos que pueda seleccionarlo a mano.
    avisar('No pudimos copiar. Seleccioná el código y copialo a mano.', { icono: 'clipboard', segundos: 5 });
  }
}

function conectar() {
  document.querySelectorAll('[data-solapa]').forEach((b) => {
    b.onclick = () => { solapa = b.dataset.solapa; render(); };
  });

  document.querySelectorAll('[data-copiar]').forEach((el) => {
    el.onclick = () => copiar(el.dataset.copiar, el);
  });

  const copiarTodos = $('#copiar-todos');
  if (copiarTodos) copiarTodos.onclick = () => copiar(recienGenerados.join('\n'));

  document.querySelectorAll('[data-baja]').forEach((b) => {
    b.onclick = async () => {
      const codigo = b.dataset.baja;
      if (!confirm('¿Dar de baja el código ' + codigo + '?\n\nDeja de servir, pero queda en la lista como registro.')) return;
      try {
        // Las reglas solo dejan tocar `activo`: no se puede alterar el uso.
        await updateDoc(doc(db, 'cupones', codigo), { activo: false });
        avisar('Código ' + codigo + ' dado de baja', { icono: 'x-circle', segundos: 4 });
      } catch (e) {
        avisar('No se pudo dar de baja: ' + e.message, { icono: 'exclamation-triangle', segundos: 6 });
      }
    };
  });

  const generar = $('#generar');
  if (!generar) return;
  generar.onclick = async () => {
    const porcentaje = Number($('#porcentaje').value);
    const cantidad = Number($('#cantidad').value);
    const diasValidez = Number($('#dias').value) || 0;
    const nota = $('#nota').value.trim();

    generando = true;
    render();
    try {
      const r = await llamar('generarCupones', { porcentaje, cantidad, nota, diasValidez });
      recienGenerados = r.codigos ?? [];
      solapa = 'disponibles';
      avisar(recienGenerados.length + ' código(s) generado(s)', { icono: 'check-circle', segundos: 4 });
    } catch (e) {
      avisar('No se pudieron generar: ' + (e.mensaje ?? e.message), { icono: 'exclamation-triangle', segundos: 6 });
    } finally {
      generando = false;
      render();
    }
  };
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  const sesion = await exigirAdmin();
  if (!sesion) return;
  montarPanel('cupones');

  onSnapshot(collection(db, 'cupones'),
    (snap) => {
      cupones = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (fecha(b.creadoEn)?.getTime() ?? 0) - (fecha(a.creadoEn)?.getTime() ?? 0));
      render();
    },
    (e) => {
      console.error('No se pudieron leer los cupones:', e);
      errorLectura = 'No se pudo leer la lista de cupones. Falta desplegar las reglas nuevas.';
      render();
    });
}

iniciar();
