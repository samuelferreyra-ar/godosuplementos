// Alta de producto: modal de tres pasos.
//
// Reemplaza el formulario de 13 campos sin etiquetas del panel viejo. Solo
// cuatro campos son obligatorios, y las fotos **se suben** a Storage: ya no se
// pega una URL de otro sitio, que era la causa de las imágenes rotas.
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref as refStorage, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { app } from './firebase-config.js';
import { precio, esc, nombreCategoria } from './tienda.js';

const storage = getStorage(app);
const BUCKET = 'godo-suplementos.firebasestorage.app';

/**
 * URL pública de un archivo del bucket.
 * No se usa getDownloadURL() a propósito: esa devuelve una URL con token, y
 * un token revocado desde la consola deja la foto rota sin ninguna pista.
 * Estas las habilitan las reglas de Storage, igual que las de la migración.
 */
const urlPublica = (ruta) =>
  'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(ruta) + '?alt=media';

const CATEGORIAS = ['proteinas', 'creatinas', 'combos', 'pre-entrenos', 'ganadores',
  'aminoacidos', 'magnesio', 'colageno', 'omega', 'vitaminas', 'quemadores', 'otros'];

const MAX_BYTES = 5 * 1024 * 1024;   // el mismo tope que las reglas de Storage
const MAX_FOTOS = 4;

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (s) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ESTILOS = `
  .a-fondo { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end;
    justify-content: center; background: rgba(10,35,66,.45); }
  .a-modal { width: 100%; max-width: 560px; max-height: 92vh; display: flex; flex-direction: column;
    background: var(--godo-paper); border-radius: 24px 24px 0 0; overflow: hidden; }
  .a-nav { background: var(--godo-navy); padding: 16px 20px; }
  .a-nav-alto { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .a-nav h2 { flex: 1; font-family: var(--titulo); font-size: 24px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .04em; color: var(--godo-paper); margin: 0; }
  .a-nav-cerrar { background: none; border: 0; color: var(--sobre-navy); font-size: 20px; cursor: pointer; }
  .a-pasos { display: flex; gap: 8px; }
  .a-paso { flex: 0 0 auto; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;
    background: var(--sobre-navy-fondo); color: var(--sobre-navy-2); border: 0; cursor: pointer; font-family: inherit; }
  .a-paso.es-actual { background: var(--godo-amber); color: var(--godo-navy); }
  .a-paso.es-hecho { color: var(--godo-amber); }

  .a-form { padding: 18px 20px; overflow-y: auto; flex: 1; display: grid; gap: 14px; }
  .a-f label { display: block; margin-bottom: 5px; font-size: 12px; font-weight: 600; color: var(--godo-text); }
  .a-f label i { color: var(--godo-danger); font-style: normal; }
  .a-f input, .a-f select, .a-f textarea {
    width: 100%; padding: 11px 12px; font: inherit; font-size: 14px; color: var(--godo-navy);
    background: var(--godo-white); border: 1px solid var(--godo-border-strong); border-radius: 12px;
  }
  .a-f textarea { min-height: 56px; resize: vertical; }
  .a-f input:focus, .a-f select:focus, .a-f textarea:focus { outline: none; border-color: var(--godo-navy); }
  .a-f input[aria-invalid="true"], .a-f select[aria-invalid="true"] { border-color: var(--godo-danger); background: var(--godo-danger-bg); }
  .a-f .a-error { display: block; margin-top: 4px; font-size: 11.5px; color: var(--godo-danger); }
  .a-dos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .a-umbral { display: flex; align-items: center; gap: 12px; padding: 12px 14px;
    background: var(--godo-paper-alt); border: 1px solid var(--godo-border); border-radius: 14px; }
  .a-umbral div { flex: 1; }
  .a-umbral b { display: block; font-size: 13.5px; font-weight: 600; }
  .a-umbral small { font-size: 12px; color: var(--godo-muted); }

  .a-variante { padding: 12px; border: 1px solid var(--godo-border); border-radius: 14px;
    background: var(--godo-white); display: grid; gap: 10px; }
  .a-variante-alto { display: flex; align-items: center; justify-content: space-between; }
  .a-variante-alto b { font-size: 13px; font-weight: 700; }
  .a-quitar { background: none; border: 0; color: var(--godo-muted-2); cursor: pointer; font-size: 14px; }
  .a-quitar:hover { color: var(--godo-danger); }

  .a-fotos { display: flex; flex-wrap: wrap; gap: 10px; }
  .a-foto, .a-subir { width: 82px; height: 82px; border-radius: 14px; overflow: hidden; position: relative; }
  .a-foto { background: var(--godo-paper); border: 1px solid var(--godo-border); }
  .a-foto img { width: 100%; height: 100%; object-fit: contain; }
  .a-foto button { position: absolute; top: 3px; right: 3px; width: 20px; height: 20px; border: 0;
    border-radius: 999px; background: rgba(10,35,66,.8); color: var(--godo-paper); font-size: 11px; cursor: pointer; }
  .a-subir { border: 1.5px dashed var(--godo-border-strong); background: var(--godo-white);
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    cursor: pointer; color: var(--godo-muted); font-family: inherit; font-size: 11px; }
  .a-subir i { font-size: 18px; color: var(--godo-navy); }

  .a-pie { display: flex; gap: 10px; padding: 14px 20px; background: var(--godo-white);
    border-top: 1px solid var(--godo-border); }
  .a-pie .g-btn { width: auto; flex: 1; min-height: 44px; }
  .a-aviso { padding: 0 20px 12px; font-size: 12.5px; }
  .a-aviso.es-error { color: var(--godo-danger); }
  .a-aviso.es-ok { color: var(--godo-ok); }

  @media (min-width: 1024px) {
    .a-fondo { align-items: center; }
    .a-modal { border-radius: 20px; max-height: 88vh; }
  }
`;

/**
 * @param {object} opciones
 * @param {Array} opciones.productos catálogo, para las marcas ya usadas
 * @param {Function} [opciones.alGuardar]
 */
export function abrirAltaProducto({ productos = [], alGuardar = null } = {}) {
  if (!document.querySelector('#estilos-alta')) {
    document.head.insertAdjacentHTML('beforeend', '<style id="estilos-alta">' + ESTILOS + '</style>');
  }

  const marcas = [...new Set(productos.map((p) => p.marca).filter(Boolean))].sort();

  let paso = 1;
  let guardando = false;
  let aviso = null;
  const errores = {};

  const datos = {
    nombre: '', marca: '', categoria: '', subcategoria: '', descripcion: '', umbralStock: 5,
    variantes: [{ sabor: '', tamano: '', precio: '', stock: '' }],
    fotos: []   // { archivo, vistaPrevia }
  };

  const fondo = document.createElement('div');
  fondo.className = 'a-fondo';
  document.body.appendChild(fondo);
  document.body.style.overflow = 'hidden';

  const cerrar = () => {
    datos.fotos.forEach((f) => URL.revokeObjectURL(f.vistaPrevia));
    fondo.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', alTeclado);
  };
  const alTeclado = (e) => { if (e.key === 'Escape' && !guardando) cerrar(); };
  document.addEventListener('keydown', alTeclado);
  fondo.onclick = (e) => { if (e.target === fondo && !guardando) cerrar(); };

  // --- Validación --------------------------------------------------------

  function validarPaso1() {
    for (const k of Object.keys(errores)) delete errores[k];
    if (datos.nombre.trim().length < 3) errores.nombre = 'Poné el nombre del producto.';
    if (!datos.marca.trim()) errores.marca = 'Elegí o escribí la marca.';
    if (!datos.categoria) errores.categoria = 'Elegí una categoría.';
    return Object.keys(errores).length === 0;
  }

  function validarPaso2() {
    for (const k of Object.keys(errores)) delete errores[k];
    const validas = datos.variantes.filter((v) => Number(v.precio) > 0);
    if (!validas.length) errores.variantes = 'Cargá al menos una variante con precio.';
    return !errores.variantes;
  }

  // --- Pasos -------------------------------------------------------------

  const campo = (id, etiqueta, valor, { requerido = false, tipo = 'text', extra = '' } = {}) => `
    <div class="a-f">
      <label for="${id}">${etiqueta}${requerido ? ' <i>*</i>' : ''}</label>
      <input id="${id}" type="${tipo}" value="${esc(valor)}" ${extra}
        ${errores[id] ? 'aria-invalid="true"' : ''}>
      ${errores[id] ? `<span class="a-error">${esc(errores[id])}</span>` : ''}
    </div>`;

  function paso1() {
    return `
      ${campo('nombre', 'Nombre del producto', datos.nombre, { requerido: true })}
      <div class="a-dos">
        <div class="a-f">
          <label for="marca">Marca <i>*</i></label>
          <input id="marca" list="marcas-conocidas" value="${esc(datos.marca)}"
            ${errores.marca ? 'aria-invalid="true"' : ''} placeholder="star, onefit…">
          <datalist id="marcas-conocidas">${marcas.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
          ${errores.marca ? `<span class="a-error">${esc(errores.marca)}</span>` : ''}
        </div>
        <div class="a-f">
          <label for="categoria">Categoría <i>*</i></label>
          <select id="categoria" ${errores.categoria ? 'aria-invalid="true"' : ''}>
            <option value="">Elegir…</option>
            ${CATEGORIAS.map((c) => `<option value="${c}" ${datos.categoria === c ? 'selected' : ''}>${esc(nombreCategoria(c))}</option>`).join('')}
          </select>
          ${errores.categoria ? `<span class="a-error">${esc(errores.categoria)}</span>` : ''}
        </div>
      </div>
      ${campo('subcategoria', 'Subcategoría', datos.subcategoria, { extra: 'placeholder="whey, monohidrato…"' })}
      <div class="a-f">
        <label for="descripcion">Descripción</label>
        <textarea id="descripcion" placeholder="Qué es, para qué sirve y cómo se toma. Lo lee el cliente en la ficha.">${esc(datos.descripcion)}</textarea>
      </div>
      <div class="a-umbral">
        <div>
          <b>Avisar cuando queden pocas</b>
          <small>Por variante. Debajo de este número aparece "quedan pocas".</small>
        </div>
        <div class="n-control">
          <button type="button" data-umbral="-1" ${datos.umbralStock <= 1 ? 'disabled' : ''}>−</button>
          <input id="umbral" type="number" min="1" value="${datos.umbralStock}">
          <button type="button" data-umbral="1">+</button>
        </div>
      </div>`;
  }

  function paso2() {
    const filas = datos.variantes.map((v, i) => `
      <div class="a-variante">
        <div class="a-variante-alto">
          <b>Variante ${i + 1}</b>
          ${datos.variantes.length > 1 ? `<button type="button" class="a-quitar" data-quitar-variante="${i}" aria-label="Quitar"><i class="bi bi-trash3"></i></button>` : ''}
        </div>
        <div class="a-dos">
          <div class="a-f"><label>Sabor</label><input data-v="${i}|sabor" value="${esc(v.sabor)}" placeholder="Vainilla"></div>
          <div class="a-f"><label>Tamaño</label><input data-v="${i}|tamano" value="${esc(v.tamano)}" placeholder="2 lb"></div>
        </div>
        <div class="a-dos">
          <div class="a-f"><label>Precio <i>*</i></label><input data-v="${i}|precio" type="number" min="0" value="${esc(v.precio)}" placeholder="45900"></div>
          <div class="a-f"><label>Stock inicial</label><input data-v="${i}|stock" type="number" min="0" value="${esc(v.stock)}" placeholder="0"></div>
        </div>
      </div>`).join('');

    return `
      <p class="g-nota" style="margin:0">Una fila por combinación de sabor y tamaño. Si el producto no tiene sabores, dejá ese campo vacío.</p>
      ${filas}
      ${errores.variantes ? `<span class="a-error">${esc(errores.variantes)}</span>` : ''}
      <button type="button" class="g-btn g-btn-borde" id="mas-variante">+ Agregar variante</button>`;
  }

  function paso3() {
    const fotos = datos.fotos.map((f, i) => `
      <div class="a-foto">
        <img src="${f.vistaPrevia}" alt="">
        <button type="button" data-quitar-foto="${i}" aria-label="Quitar foto">✕</button>
      </div>`).join('');

    return `
      <p class="g-nota" style="margin:0">Arrastrá la imagen o elegila del teléfono. Ya no se pega una URL: la foto se guarda en el sitio, así no depende de otra página.</p>
      <div class="a-fotos">
        ${fotos}
        ${datos.fotos.length < MAX_FOTOS ? `
          <button type="button" class="a-subir" id="subir">
            <i class="bi bi-cloud-arrow-up"></i>Subir
          </button>` : ''}
      </div>
      <input type="file" id="archivo" accept="image/*" multiple hidden>
      <p class="g-nota" style="margin:0">Hasta ${MAX_FOTOS} fotos, 5 MB cada una. La primera es la que se ve en los listados.</p>`;
  }

  // --- Render ------------------------------------------------------------

  function render() {
    const titulos = { 1: 'Producto', 2: 'Variantes', 3: 'Fotos' };
    const contenido = paso === 1 ? paso1() : paso === 2 ? paso2() : paso3();

    fondo.innerHTML = `<div class="a-modal" role="dialog" aria-modal="true" aria-label="Nuevo producto">
      <div class="a-nav">
        <div class="a-nav-alto">
          <h2>Nuevo producto</h2>
          <button class="a-nav-cerrar" id="a-cerrar" aria-label="Cerrar">✕</button>
        </div>
        <div class="a-pasos">
          ${[1, 2, 3].map((n) => `<button class="a-paso ${n === paso ? 'es-actual' : n < paso ? 'es-hecho' : ''}"
            data-ir="${n}">${n} ${titulos[n]}</button>`).join('')}
        </div>
      </div>

      <div class="a-form">${contenido}</div>

      ${aviso ? `<div class="a-aviso ${aviso.tono === 'error' ? 'es-error' : 'es-ok'}">${esc(aviso.texto)}</div>` : ''}

      <div class="a-pie">
        ${paso > 1 ? '<button class="g-btn g-btn-borde" id="atras">Volver</button>' : ''}
        ${paso < 3
          ? '<button class="g-btn g-btn-acento" id="siguiente">Seguir a ' + (paso === 1 ? 'variantes' : 'fotos') + '</button>'
          : `<button class="g-btn g-btn-primario" id="guardar" ${guardando ? 'disabled' : ''}>${guardando ? 'Guardando…' : 'Crear producto'}</button>`}
      </div>
    </div>`;

    conectar();
  }

  function conectar() {
    fondo.querySelector('#a-cerrar').onclick = () => { if (!guardando) cerrar(); };

    fondo.querySelectorAll('[data-ir]').forEach((b) => {
      b.onclick = () => {
        const destino = Number(b.dataset.ir);
        // Solo se puede avanzar si lo anterior está completo.
        if (destino > paso) {
          if (paso === 1 && !validarPaso1()) return render();
          if (paso === 2 && !validarPaso2()) return render();
        }
        paso = destino;
        aviso = null;
        render();
      };
    });

    const atras = fondo.querySelector('#atras');
    if (atras) atras.onclick = () => { paso -= 1; aviso = null; render(); };

    const siguiente = fondo.querySelector('#siguiente');
    if (siguiente) siguiente.onclick = () => {
      if (paso === 1 && !validarPaso1()) return render();
      if (paso === 2 && !validarPaso2()) return render();
      paso += 1;
      render();
    };

    // Paso 1
    ['nombre', 'marca', 'subcategoria', 'descripcion'].forEach((id) => {
      const el = fondo.querySelector('#' + id);
      if (el) el.oninput = () => { datos[id] = el.value; };
    });
    const categoria = fondo.querySelector('#categoria');
    if (categoria) categoria.onchange = () => { datos.categoria = categoria.value; };
    fondo.querySelectorAll('[data-umbral]').forEach((b) => {
      b.onclick = () => {
        datos.umbralStock = Math.max(1, datos.umbralStock + Number(b.dataset.umbral));
        render();
      };
    });
    const umbral = fondo.querySelector('#umbral');
    if (umbral) umbral.oninput = () => { datos.umbralStock = Math.max(1, Number(umbral.value) || 1); };

    // Paso 2
    fondo.querySelectorAll('[data-v]').forEach((el) => {
      const [i, campoNombre] = el.dataset.v.split('|');
      el.oninput = () => { datos.variantes[Number(i)][campoNombre] = el.value; };
    });
    const mas = fondo.querySelector('#mas-variante');
    if (mas) mas.onclick = () => { datos.variantes.push({ sabor: '', tamano: '', precio: '', stock: '' }); render(); };
    fondo.querySelectorAll('[data-quitar-variante]').forEach((b) => {
      b.onclick = () => { datos.variantes.splice(Number(b.dataset.quitarVariante), 1); render(); };
    });

    // Paso 3
    const subir = fondo.querySelector('#subir');
    const archivo = fondo.querySelector('#archivo');
    if (subir) subir.onclick = () => archivo.click();
    if (archivo) archivo.onchange = () => {
      for (const f of archivo.files) {
        if (datos.fotos.length >= MAX_FOTOS) break;
        if (!f.type.startsWith('image/')) { aviso = { texto: '"' + f.name + '" no es una imagen.', tono: 'error' }; continue; }
        if (f.size > MAX_BYTES) { aviso = { texto: '"' + f.name + '" pesa más de 5 MB.', tono: 'error' }; continue; }
        datos.fotos.push({ archivo: f, vistaPrevia: URL.createObjectURL(f) });
      }
      render();
    };
    fondo.querySelectorAll('[data-quitar-foto]').forEach((b) => {
      b.onclick = () => {
        const i = Number(b.dataset.quitarFoto);
        URL.revokeObjectURL(datos.fotos[i].vistaPrevia);
        datos.fotos.splice(i, 1);
        render();
      };
    });

    const guardar = fondo.querySelector('#guardar');
    if (guardar) guardar.onclick = crear;
  }

  // --- Guardado ----------------------------------------------------------

  async function crear() {
    if (!validarPaso1()) { paso = 1; return render(); }
    if (!validarPaso2()) { paso = 2; return render(); }

    guardando = true;
    aviso = { texto: 'Creando el producto…', tono: 'ok' };
    render();

    const productoId = slug(datos.marca) + '--' + slug(datos.nombre);

    try {
      const existente = await getDoc(doc(db, 'productos_v2', productoId));
      if (existente.exists()) {
        throw new Error('Ya existe un producto con ese nombre y marca. Cambiale el nombre o editá el que está.');
      }

      // Las fotos van primero: si falla la subida, no queda un producto a medias.
      const urls = [];
      for (const [i, f] of datos.fotos.entries()) {
        const ext = (f.archivo.name.match(/\.[a-z0-9]+$/i) ?? ['.jpg'])[0].toLowerCase();
        const ruta = 'productos/' + productoId + '/' + i + ext;
        const destino = refStorage(storage, ruta);
        aviso = { texto: 'Subiendo foto ' + (i + 1) + ' de ' + datos.fotos.length + '…', tono: 'ok' };
        render();
        await uploadBytes(destino, f.archivo, {
          contentType: f.archivo.type,
          cacheControl: 'public, max-age=31536000, immutable'
        });
        urls.push(urlPublica(ruta));
      }

      const variantes = {};
      for (const v of datos.variantes) {
        const precioNum = Number(v.precio);
        if (!(precioNum > 0)) continue;
        const stockNum = Math.max(0, Number(v.stock) || 0);
        const id = (slug(v.sabor) || 'unico') + '--' + (slug(v.tamano) || 'unico');
        variantes[id] = {
          sabor: v.sabor.trim(), tamano: v.tamano.trim(),
          peso: null, unidad: null, envase: null,
          precio: Math.round(precioNum),
          stock: stockNum,
          pausada: stockNum === 0,
          sku: productoId + '--' + id
        };
      }

      const vs = Object.values(variantes);
      await setDoc(doc(db, 'productos_v2', productoId), {
        nombre: datos.nombre.trim(),
        marca: datos.marca.trim().toLowerCase(),
        categoria: datos.categoria,
        subcategoria: datos.subcategoria.trim().toLowerCase(),
        descripcion: datos.descripcion.trim(),
        imagenes: urls,
        umbralStock: datos.umbralStock,
        archivado: false,
        destacado: false,
        variantes,
        stockTotal: vs.reduce((a, v) => a + v.stock, 0),
        variantesActivas: vs.filter((v) => !v.pausada).length,
        precioMin: Math.min(...vs.map((v) => v.precio)),
        precioMax: Math.max(...vs.map((v) => v.precio)),
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp()
      });

      cerrar();
      alGuardar?.(productoId, datos.nombre.trim());
    } catch (e) {
      guardando = false;
      aviso = { texto: e.message, tono: 'error' };
      render();
    }
  }

  render();
  return cerrar;
}
