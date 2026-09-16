// Direcciones guardadas del cliente.
//
// Viven en un array dentro de usuarios/{uid}, que es lo que ya usaba el sitio
// anterior. Las reglas dejan que cada uno escriba solo su propio documento.
import { esperarSesion } from './sesion.js';
import { db } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { esc } from './tienda.js';
import { montarNav } from './nav.js';
import { montarChrome, montarPie } from './chrome.js';

const $ = (s) => document.querySelector(s);

let uid = null;
let direcciones = [];
let editando = null;   // índice en edición, o null

const CAMPOS = [
  { id: 'calle', etiqueta: 'Calle', requerido: true },
  { id: 'numero', etiqueta: 'Número', requerido: true },
  { id: 'piso', etiqueta: 'Piso' },
  { id: 'departamento', etiqueta: 'Depto' },
  { id: 'localidad', etiqueta: 'Localidad', requerido: true },
  { id: 'provincia', etiqueta: 'Provincia', requerido: true },
  { id: 'codigoPostal', etiqueta: 'Código postal' }
];

const enUnaLinea = (d) => [
  [d.calle, d.numero].filter(Boolean).join(' '),
  d.piso ? 'piso ' + d.piso : '',
  d.departamento ? 'depto ' + d.departamento : ''
].filter(Boolean).join(', ');

async function guardar() {
  await updateDoc(doc(db, 'usuarios', uid), { direcciones });
}

// --- Render --------------------------------------------------------------

function formulario() {
  const d = editando != null ? direcciones[editando] : {};
  return `<form class="g-tarjeta u-form-dir" id="form-dir">
    <h2 class="g-titulo-seccion" style="font-size:20px;margin:0">${editando != null ? 'Editar dirección' : 'Nueva dirección'}</h2>
    ${CAMPOS.map((c) => `<div class="a-campo">
      <label for="${c.id}">${c.etiqueta}${c.requerido ? '' : ' <span style="color:var(--godo-disabled);font-weight:400">· opcional</span>'}</label>
      <input id="${c.id}" type="text" value="${esc(d[c.id] ?? '')}">
    </div>`).join('')}
    <div style="display:grid;gap:9px">
      <button class="g-btn g-btn-primario" type="submit">Guardar</button>
      <button class="g-btn g-btn-borde" type="button" id="cancelar">Cancelar</button>
    </div>
  </form>`;
}

function render(mostrandoForm = false) {
  const lista = direcciones.length
    ? `<div class="u-menu" style="gap:9px">${direcciones.map((d, i) => `
        <article class="g-tarjeta u-dir">
          <div class="u-dir-cuerpo">
            <b>${esc(enUnaLinea(d))}</b>
            <small>${esc([d.localidad, d.provincia, d.codigoPostal].filter(Boolean).join(', '))}</small>
            ${i === 0 ? '<span class="g-pildora g-pildora-ok" style="margin-top:6px">Principal</span>' : ''}
          </div>
          <div class="u-dir-acciones">
            ${i > 0 ? `<button data-principal="${i}" title="Marcar como principal" aria-label="Marcar como principal"><i class="bi bi-star"></i></button>` : ''}
            <button data-editar="${i}" title="Editar" aria-label="Editar"><i class="bi bi-pencil"></i></button>
            <button data-borrar="${i}" title="Borrar" aria-label="Borrar"><i class="bi bi-trash3"></i></button>
          </div>
        </article>`).join('')}</div>`
    : `<div class="u-vacio">
         <i class="bi bi-geo-alt"></i>
         <p class="g-nota">Todavía no guardaste ninguna dirección.</p>
       </div>`;

  $('#contenido').innerHTML = `
    <h1 class="u-titulo-panel d-solo" style="margin-top:24px">Mis direcciones</h1>
    <p class="g-nota" style="margin:16px 0">La primera es la que proponemos por defecto en el checkout.</p>
    ${lista}
    ${mostrandoForm ? formulario() : '<button class="g-btn g-btn-primario" id="nueva" style="margin-top:16px">Agregar dirección</button>'}`;

  conectar(mostrandoForm);
}

function conectar(mostrandoForm) {
  document.querySelectorAll('[data-borrar]').forEach((b) => {
    b.onclick = async () => {
      const i = Number(b.dataset.borrar);
      if (!confirm('¿Borrar esta dirección?')) return;
      direcciones.splice(i, 1);
      await guardar();
      render();
    };
  });
  document.querySelectorAll('[data-principal]').forEach((b) => {
    b.onclick = async () => {
      const i = Number(b.dataset.principal);
      const [d] = direcciones.splice(i, 1);
      direcciones.unshift(d);
      await guardar();
      render();
    };
  });
  document.querySelectorAll('[data-editar]').forEach((b) => {
    b.onclick = () => { editando = Number(b.dataset.editar); render(true); };
  });

  if ($('#nueva')) $('#nueva').onclick = () => { editando = null; render(true); };
  if (!mostrandoForm) return;

  $('#cancelar').onclick = () => { editando = null; render(); };
  $('#form-dir').onsubmit = async (e) => {
    e.preventDefault();
    const d = {};
    for (const c of CAMPOS) d[c.id] = $('#' + c.id).value.trim();

    const falta = CAMPOS.find((c) => c.requerido && !d[c.id]);
    if (falta) { $('#' + falta.id).focus(); $('#' + falta.id).setAttribute('aria-invalid', 'true'); return; }

    if (editando != null) direcciones[editando] = d; else direcciones.push(d);
    await guardar();
    editando = null;
    render();
  };
}

// --- Arranque ------------------------------------------------------------

async function iniciar() {
  montarNav('cuenta');
  montarChrome({});
  montarPie();

  const sesion = await esperarSesion();
  if (!sesion.usuario) {
    location.replace('login.html?volver=mis-direcciones.html');
    return;
  }
  uid = sesion.usuario.uid;
  direcciones = Array.isArray(sesion.datos?.direcciones) ? [...sesion.datos.direcciones] : [];

  $('#cabecera').innerHTML = `<div class="u-identidad">
    <div><h1>Mis direcciones</h1><p>Para no volver a cargarlas en cada compra</p></div>
  </div>`;

  render();
}

iniciar();
