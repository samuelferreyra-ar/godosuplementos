import { llamar } from './funciones.js';
import { esperarSesion } from './sesion.js';
import { precio, esc } from './tienda.js';
import { abrirModo, olvidarModo } from './modo.js';

export async function iniciarConfirmacionModo(pedidoId) {
  const root = document.querySelector('#contenido');
  const loginUrl = 'login.html?volver=' + encodeURIComponent('confirmacion.html?modo=1&pedido=' + pedidoId);
  await esperarSesion();
  let actual, consultas = 0, operando = false, temporizador;
  const errorPrevio = sessionStorage.getItem('godo.modo.error');
  sessionStorage.removeItem('godo.modo.error');
  function render(mensaje = '') {
    const p = actual.pedido;
    const textos = { pagado: 'Pago de prueba aprobado', rechazado: 'Pago rechazado',
      vencido: 'El QR venció', cancelado: 'Prueba finalizada',
      pendiente: 'Pedido guardado', iniciado: 'Pago pendiente', verificando: 'Verificando el pago' };
    root.innerHTML = `<div class="g-tarjeta" style="padding:24px;margin:24px auto;max-width:640px">
      <p class="g-nota">MODO · Ambiente de prueba · Sin cobro real</p>
      <h1>${textos[actual.estado] ?? 'Verificando el pago'}</h1>
      <p>Pedido #${esc(p.numero)} · <strong>${precio(p.total)}</strong></p>
      <p>${p.revertida ? 'Se devolvió el stock y se restauró el cupón de esta prueba.' :
        actual.estado === 'pagado' ? 'El servidor confirmó el pago de prueba. No preparar ni entregar este pedido.' :
        'El pedido sigue guardado. Reintentar el pago no vuelve a descontar stock.'}</p>
      <ul>${(p.items ?? []).map(i => `<li>${esc(i.nombre)} · ${i.cantidad} × ${precio(i.precio)}</li>`).join('')}</ul>
      <p role="status">${esc(mensaje || actual.motivo || '')}</p>
      ${actual.puedeReintentar ? '<button class="g-btn g-btn-acento" id="modo-reintentar">Abrir / reintentar MODO</button>' : ''}
      ${!p.revertida ? '<button class="g-btn g-btn-borde" id="modo-consultar" style="margin-top:12px">Consultar estado</button><button class="g-btn g-btn-borde" id="modo-finalizar" style="margin-top:12px">Finalizar prueba y devolver stock</button>' : ''}
      <a class="g-btn g-btn-borde" href="index.html" style="margin-top:12px">Volver a la tienda</a>
    </div>`;
    root.querySelector('#modo-consultar')?.addEventListener('click', () => actualizar());
    root.querySelector('#modo-reintentar')?.addEventListener('click', async () => {
      if (operando) return;
      operando = true; root.querySelectorAll('button').forEach(b => b.disabled = true);
      try { await abrirModo(pedidoId); }
      catch (e) { render(e.mensaje ?? e.message); }
      finally { operando = false; }
    });
    root.querySelector('#modo-finalizar')?.addEventListener('click', async () => {
      if (operando) return;
      operando = true; root.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        await llamar('finalizarPruebaModo', { pedidoId });
        olvidarModo(pedidoId); await actualizar();
      } catch (e) { render(e.mensaje ?? e.message); }
      finally { operando = false; }
    });
  }
  async function actualizar() {
    clearTimeout(temporizador);
    try {
      actual = await llamar('consultarPagoModo', { pedidoId });
      if (actual.pedido.revertida) olvidarModo(pedidoId);
      render(consultas === 0 ? errorPrevio : '');
      consultas++;
      if (!['pagado', 'cancelado', 'rechazado', 'vencido'].includes(actual.estado) && consultas < 20) {
        temporizador = setTimeout(() => { if (!operando) actualizar(); }, 15000);
      }
    } catch (e) {
      if (actual) render('No pudimos consultar el estado. Tu pago no se marca como rechazado por una falla de conexión.');
      else root.innerHTML = `<div class="g-tarjeta" style="padding:24px;margin:24px"><h1>Consultar pedido MODO</h1><p>${esc(e.mensaje ?? e.message)}</p><p>Iniciá sesión con el administrador que creó la prueba para volver automáticamente al pedido.</p><a class="g-btn g-btn-borde" href="${esc(loginUrl)}">Iniciar sesión</a><button class="g-btn g-btn-borde" id="modo-recargar">Volver a consultar</button></div>`;
      root.querySelector('#modo-recargar')?.addEventListener('click', actualizar);
    }
  }
  window.addEventListener('pagehide', () => clearTimeout(temporizador), { once: true });
  await actualizar();
}
