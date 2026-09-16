import { llamar } from './funciones.js';
import { esperarSesion } from './sesion.js';

const CLAVE = 'godo.modo.pruebaActual';
let cargandoSDK;
export async function opcionesModo() {
  await esperarSesion();
  try { return await llamar('opcionesModoPrueba'); } catch { return { habilitado: false }; }
}
export function pruebaActualModo() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) ?? null; } catch { return null; }
}
export function nuevaClaveModo() {
  const previa = pruebaActualModo();
  if (previa?.clave) return previa.clave;
  const clave = crypto.randomUUID();
  localStorage.setItem(CLAVE, JSON.stringify({ clave }));
  return clave;
}
export function recordarModo(pedidoId) {
  localStorage.setItem(CLAVE, JSON.stringify({ ...pruebaActualModo(), pedidoId }));
}
export function olvidarModo(pedidoId) {
  if (pruebaActualModo()?.pedidoId === pedidoId) localStorage.removeItem(CLAVE);
}
export function urlConfirmacionModo(pedidoId) {
  const url = new URL('confirmacion.html', location.href);
  url.searchParams.set('modo', '1');
  url.searchParams.set('pedido', pedidoId);
  return url.href;
}
async function cargarSDK() {
  if (window.ModoSDK?.modoInitPayment) return;
  if (!cargandoSDK) cargandoSDK = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fallar(), 15000);
    function fallar() { clearTimeout(timer); script.remove(); cargandoSDK = null; reject(new Error('No se pudo cargar MODO. Reintentá en unos segundos.')); }
    script.src = 'https://ecommerce-modal.preprod.modo.com.ar/bundle.js';
    script.onload = () => { clearTimeout(timer); window.ModoSDK?.modoInitPayment ? resolve() : fallar(); };
    script.onerror = fallar;
    document.head.appendChild(script);
  });
  await cargandoSDK;
}
export async function abrirModo(pedidoId) {
  await cargarSDK();
  const retorno = urlConfirmacionModo(pedidoId);
  const crear = async () => {
    const r = await llamar('iniciarPagoModo', { pedidoId });
    if (r.yaPagado) { location.href = retorno; throw new Error('Este pedido ya fue pagado.'); }
    return r;
  };
  const pago = await crear();
  window.ModoSDK.modoInitPayment({
    version: '2', checkoutId: pago.checkoutId, qrString: pago.qrString,
    deeplink: { url: pago.deeplink, callbackURL: retorno, callbackURLSuccess: retorno },
    callbackURL: retorno,
    refreshData: async () => { await llamar('consultarPagoModo', { pedidoId }); return crear(); },
    // Ningún callback acredita una compra: la pantalla consulta al servidor.
    onSuccess: () => { location.href = retorno; },
    onCancel: () => { location.href = retorno; },
    onClose: () => { location.href = retorno; }
  });
}
