// Entrada de stock.
//
// La regla central de esta pantalla: **vacío no es cero**. Solo se suma donde
// el dueño escribió un número. Entra mercadería de un sabor y de otro no, y
// eso tiene que poder cargarse sin tocar lo que no cambió.
import { moverStock, nivelDe } from './admin-datos.js';
import { precio, esc } from './tienda.js';

let cerrar = null;

const ESTILOS = `
  .e-fondo {
    position: fixed; inset: 0; z-index: 60; display: flex;
    align-items: flex-end; justify-content: center;
    background: rgba(10, 35, 66, .45);
  }
  .e-modal {
    width: 100%; max-width: 620px; max-height: 92vh; display: flex; flex-direction: column;
    background: var(--godo-paper); border-radius: 24px 24px 0 0; overflow: hidden;
  }
  .e-cabecera { background: var(--godo-navy); padding: 18px 20px; display: flex; align-items: flex-start; gap: 12px; }
  .e-cabecera h2 {
    font-family: var(--titulo); font-size: 26px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .04em; color: var(--godo-paper); margin: 0 0 4px;
  }
  .e-cabecera p { margin: 0; font-size: 12.5px; color: var(--sobre-navy-2); }
  .e-cerrar { background: none; border: 0; color: var(--sobre-navy); font-size: 20px; cursor: pointer; padding: 0 4px; }

  .e-cuerpo { padding: 16px 20px; overflow-y: auto; flex: 1; }

  .e-selector {
    display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
    padding: 12px; border: 1px solid var(--godo-border-strong); border-radius: 14px;
    background: var(--godo-white); font-family: inherit; color: var(--godo-navy); cursor: pointer;
  }
  .e-selector .g-foto { flex: 0 0 40px; width: 40px; height: 40px; border-radius: 10px; }
  .e-selector b { display: block; font-size: 14px; font-weight: 600; }
  .e-selector small { font-size: 12px; color: var(--godo-muted); }
  .e-selector i { margin-left: auto; color: var(--godo-disabled); }

  .e-buscar { width: 100%; padding: 11px 12px; margin-bottom: 10px; font: inherit; font-size: 13.5px;
    border: 1px solid var(--godo-border-strong); border-radius: 12px; background: var(--godo-white); }
  .e-opciones { display: grid; gap: 6px; max-height: 320px; overflow-y: auto; }

  .e-tabla { margin-top: 16px; background: var(--godo-white); border: 1px solid var(--godo-border); border-radius: 16px; overflow: hidden; }
  .e-tabla-cabecera, .e-tabla-fila {
    display: grid; grid-template-columns: 1fr 84px 84px 84px; gap: 10px; align-items: center; padding: 11px 14px;
  }
  .e-tabla-cabecera {
    background: var(--godo-paper); font-size: 10.5px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .07em; color: var(--godo-muted-2);
  }
  .e-tabla-fila { border-top: 1px solid var(--godo-border-soft); }
  .e-variante b { display: block; font-size: 13.5px; font-weight: 600; }
  .e-variante small { font-size: 11.5px; color: var(--godo-muted); }
  .e-tenia { font-size: 13.5px; color: var(--godo-muted); text-align: center; }
  .e-queda { font-size: 13.5px; font-weight: 700; text-align: right; }
  .e-queda.es-cambia { color: var(--godo-ok); }

  /* El borde dice de un vistazo dónde se cargó algo y dónde no. */
  .e-entro {
    width: 100%; padding: 9px; text-align: center; font: inherit; font-size: 14px; font-weight: 700;
    color: var(--godo-navy); background: var(--godo-white);
    border: 1px solid var(--godo-border-strong); border-radius: 12px;
    -moz-appearance: textfield;
  }
  .e-entro::-webkit-outer-spin-button, .e-entro::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .e-entro.es-cargado { border-color: var(--godo-navy); border-width: 1.5px; background: var(--godo-paper-alt); }
  .e-entro:focus { outline: none; border-color: var(--godo-navy); }

  .e-aclaracion {
    display: flex; gap: 9px; margin-top: 14px; padding: 12px 14px;
    border-radius: 14px; background: var(--godo-paper-alt);
    border: 1px solid var(--godo-border); font-size: 12.5px; color: var(--godo-text);
  }
  .e-aclaracion i { color: var(--godo-navy); font-size: 15px; }

  .e-pie {
    display: flex; align-items: center; gap: 12px; padding: 14px 20px;
    background: var(--godo-white); border-top: 1px solid var(--godo-border);
  }
  .e-total { flex: 1; font-size: 13.5px; color: var(--godo-muted); }
  .e-total b { color: var(--godo-navy); }
  .e-pie .g-btn { width: auto; min-height: 44px; padding: 0 20px; }
  .e-error { padding: 0 20px 12px; color: var(--godo-danger); font-size: 12.5px; }

  @media (min-width: 1024px) {
    .e-fondo { align-items: center; }
    .e-modal { border-radius: 20px; max-height: 86vh; }
  }
`;

/**
 * @param {object} opciones
 * @param {Array} opciones.productos catálogo completo del panel
 * @param {object} opciones.usuario  quién carga, para el historial
 * @param {string} [opciones.productoId] producto ya elegido
 * @param {Function} [opciones.alGuardar]
 */
export function abrirEntradaStock({ productos, usuario, productoId = null, alGuardar = null }) {
  if (!document.querySelector('#estilos-entrada')) {
    document.head.insertAdjacentHTML('beforeend', '<style id="estilos-entrada">' + ESTILOS + '</style>');
  }

  let elegido = productos.find((p) => p.id === productoId) ?? null;
  let eligiendo = !elegido;
  let filtro = '';
  // varianteId -> cuánto entró. Solo existen las claves que se escribieron.
  const entradas = new Map();

  const fondo = document.createElement('div');
  fondo.className = 'e-fondo';
  document.body.appendChild(fondo);
  document.body.style.overflow = 'hidden';

  cerrar = () => {
    fondo.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', alTeclado);
  };
  const alTeclado = (e) => { if (e.key === 'Escape') cerrar(); };
  document.addEventListener('keydown', alTeclado);
  fondo.onclick = (e) => { if (e.target === fondo) cerrar(); };

  // --- Render ------------------------------------------------------------

  function listaProductos() {
    const t = filtro.toLowerCase();
    const candidatos = productos
      .filter((p) => !p.archivado)
      .filter((p) => !t || [p.nombre, p.marca].filter(Boolean).join(' ').toLowerCase().includes(t))
      .slice(0, 40);

    return `<input class="e-buscar" id="e-filtro" placeholder="Buscar producto" value="${esc(filtro)}" autocomplete="off">
      <div class="e-opciones">
        ${candidatos.map((p) => `<button class="e-selector" data-elegir="${esc(p.id)}">
          <span class="g-foto">${p.imagenes?.[0] ? `<img src="${esc(p.imagenes[0])}" alt="" onerror="this.remove()">` : ''}</span>
          <span><b>${esc(p.nombre)}</b><small>${esc(p.marca)} · ${p.listaVariantes.length} variantes</small></span>
        </button>`).join('') || '<p class="g-nota">Sin resultados.</p>'}
      </div>`;
  }

  function tabla() {
    const filas = elegido.listaVariantes.map((v) => {
      const tenia = Number(v.stock) || 0;
      const entro = entradas.get(v.varianteId);
      const queda = tenia + (entro ?? 0);
      const etiqueta = [v.sabor, v.tamano].filter(Boolean).join(' · ') || 'Único';

      return `<div class="e-tabla-fila">
        <div class="e-variante">
          <b>${esc(v.sabor || 'Único')}</b>
          <small>${esc(v.tamano || '')} · ${precio(v.precio)}</small>
        </div>
        <span class="e-tenia">${tenia}</span>
        <input class="e-entro ${entro != null ? 'es-cargado' : ''}" type="number" inputmode="numeric"
          min="0" placeholder="—" value="${entro ?? ''}" data-entro="${esc(v.varianteId)}"
          aria-label="Entró de ${esc(etiqueta)}">
        <span class="e-queda ${entro ? 'es-cambia' : ''}">${queda}</span>
      </div>`;
    }).join('');

    return `<div class="e-tabla">
      <div class="e-tabla-cabecera">
        <span>Variante</span><span style="text-align:center">Tenía</span>
        <span style="text-align:center">Entró</span><span style="text-align:right">Queda</span>
      </div>
      ${filas}
    </div>
    <div class="e-aclaracion">
      <i class="bi bi-info-circle"></i>
      <span>La variante que dejes vacía queda igual. Si estaba en cero sigue pausada, y se vuelve a publicar sola cuando le cargues una entrada.</span>
    </div>`;
  }

  function pie() {
    const cargadas = [...entradas.entries()].filter(([, n]) => n > 0);
    const unidades = cargadas.reduce((a, [, n]) => a + n, 0);
    return `<div class="e-total">
        ${unidades
          ? `Entran <b>${unidades} unidad${unidades === 1 ? '' : 'es'}</b> en ${cargadas.length} variante${cargadas.length === 1 ? '' : 's'}`
          : 'Todavía no cargaste ninguna cantidad'}
      </div>
      <button class="g-btn g-btn-borde" id="e-cancelar">Cancelar</button>
      <button class="g-btn g-btn-primario" id="e-guardar" ${unidades ? '' : 'disabled'}>Guardar entrada</button>`;
  }

  function render() {
    fondo.innerHTML = `<div class="e-modal" role="dialog" aria-modal="true" aria-label="Entrada de stock">
      <div class="e-cabecera">
        <div style="flex:1">
          <h2>Entrada de stock</h2>
          <p>Escribí solo lo que entró. Lo que dejes vacío queda igual.</p>
        </div>
        <button class="e-cerrar" id="e-cerrar" aria-label="Cerrar">✕</button>
      </div>

      <div class="e-cuerpo">
        ${eligiendo || !elegido ? listaProductos() : `
          <button class="e-selector" id="e-cambiar">
            <span class="g-foto">${elegido.imagenes?.[0] ? `<img src="${esc(elegido.imagenes[0])}" alt="" onerror="this.remove()">` : ''}</span>
            <span><b>${esc(elegido.nombre)}</b><small>${esc(elegido.marca)} · ${elegido.listaVariantes.length} variantes</small></span>
            <i class="bi bi-chevron-down"></i>
          </button>
          ${tabla()}`}
      </div>

      <div class="e-error" id="e-error" hidden></div>
      ${eligiendo || !elegido ? '' : `<div class="e-pie">${pie()}</div>`}
    </div>`;

    conectar();
  }

  function conectar() {
    fondo.querySelector('#e-cerrar').onclick = cerrar;
    const cancelar = fondo.querySelector('#e-cancelar');
    if (cancelar) cancelar.onclick = cerrar;

    const filtroInput = fondo.querySelector('#e-filtro');
    if (filtroInput) {
      filtroInput.oninput = () => {
        filtro = filtroInput.value;
        render();
        const nuevo = fondo.querySelector('#e-filtro');
        nuevo.focus();
        nuevo.setSelectionRange(nuevo.value.length, nuevo.value.length);
      };
    }

    fondo.querySelectorAll('[data-elegir]').forEach((b) => {
      b.onclick = () => {
        elegido = productos.find((p) => p.id === b.dataset.elegir);
        eligiendo = false;
        entradas.clear();
        render();
      };
    });

    const cambiar = fondo.querySelector('#e-cambiar');
    if (cambiar) cambiar.onclick = () => { eligiendo = true; filtro = ''; render(); };

    fondo.querySelectorAll('[data-entro]').forEach((input) => {
      input.oninput = () => {
        const id = input.dataset.entro;
        const texto = input.value.trim();
        // Vacío borra la clave: es lo que hace que "vacío ≠ cero" sea real.
        if (texto === '') entradas.delete(id);
        else entradas.set(id, Math.max(0, Math.round(Number(texto) || 0)));

        // Se repinta solo la fila y el pie, para no perder el foco.
        const fila = input.closest('.e-tabla-fila');
        const v = elegido.listaVariantes.find((x) => x.varianteId === id);
        const queda = (Number(v.stock) || 0) + (entradas.get(id) ?? 0);
        const celda = fila.querySelector('.e-queda');
        celda.textContent = queda;
        celda.classList.toggle('es-cambia', Boolean(entradas.get(id)));
        input.classList.toggle('es-cargado', entradas.has(id));
        fondo.querySelector('.e-pie').innerHTML = pie();
        conectarPie();
      };
    });

    conectarPie();
  }

  function conectarPie() {
    const guardar = fondo.querySelector('#e-guardar');
    const cancelar = fondo.querySelector('#e-cancelar');
    if (cancelar) cancelar.onclick = cerrar;
    if (!guardar) return;

    guardar.onclick = async () => {
      const deltas = Object.fromEntries([...entradas.entries()].filter(([, n]) => n > 0));
      if (!Object.keys(deltas).length) return;

      guardar.disabled = true;
      guardar.textContent = 'Guardando…';
      try {
        await moverStock(elegido.id, deltas, 'entrada', usuario?.uid ?? null);
        cerrar();
        alGuardar?.();
      } catch (e) {
        const error = fondo.querySelector('#e-error');
        error.textContent = 'No se pudo guardar: ' + e.message;
        error.hidden = false;
        guardar.disabled = false;
        guardar.textContent = 'Guardar entrada';
      }
    };
  }

  render();
  return cerrar;
}
