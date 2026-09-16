// Ingresar, crear cuenta y recuperar contraseña.
//
// Las tres pantallas comparten este archivo; cada HTML declara cuál es en
// <body data-pantalla="...">. Ninguna es obligatoria para comprar: la cuenta
// solo agrega historial de pedidos y direcciones guardadas.
import { entrar, registrar, recuperarClave, mensajeDeError, onUsuario } from './sesion.js';
import { esc } from './tienda.js';

const $ = (s) => document.querySelector(s);
const PANTALLA = document.body.dataset.pantalla;

// A dónde volver después de entrar. Sirve para el caso "me pidieron cuenta
// desde el checkout": vuelve a donde estaba, no a la home.
const VOLVER_A = new URLSearchParams(location.search).get('volver');
const destino = () => {
  if (VOLVER_A && /^[a-z0-9-]+\.html$/i.test(VOLVER_A)) return VOLVER_A;
  // Retorno desde la app MODO cuando el navegador necesita iniciar sesión.
  // Reconstruir una ruta propia: nunca redirigir al dominio enviado en la URL.
  try {
    const u = new URL(VOLVER_A, location.origin);
    const id = u.searchParams.get('pedido');
    if (u.origin === location.origin && u.pathname === '/confirmacion.html' &&
        u.searchParams.get('modo') === '1' && /^modo_[a-f0-9]{64}$/.test(id ?? '')) {
      return 'confirmacion.html?modo=1&pedido=' + id;
    }
  } catch { /* destino inválido */ }
  return 'mi-cuenta.html';
};

const esEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

function aviso(texto, tono = 'error') {
  const caja = $('#aviso');
  caja.className = 'a-aviso a-aviso-' + tono;
  caja.innerHTML = esc(texto);
  caja.hidden = false;
}

function limpiarAviso() {
  const caja = $('#aviso');
  caja.hidden = true;
  document.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
  document.querySelectorAll('.a-error').forEach((e) => e.remove());
}

function marcarError(id, texto) {
  const campo = $('#' + id);
  if (!campo) return;
  campo.setAttribute('aria-invalid', 'true');
  campo.insertAdjacentHTML('afterend', '<span class="a-error">' + esc(texto) + '</span>');
}

/** Deja el botón en "trabajando" y devuelve cómo restaurarlo. */
function ocupar(boton, texto) {
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = texto;
  return () => { boton.disabled = false; boton.textContent = original; };
}

// El ojo de la contraseña.
document.querySelectorAll('.a-ojo').forEach((ojo) => {
  ojo.onclick = () => {
    const input = ojo.previousElementSibling;
    const oculta = input.type === 'password';
    input.type = oculta ? 'text' : 'password';
    ojo.innerHTML = '<i class="bi bi-eye' + (oculta ? '-slash' : '') + '"></i>';
    ojo.setAttribute('aria-label', oculta ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };
});

// --- Ingresar ------------------------------------------------------------

if (PANTALLA === 'login') {
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    limpiarAviso();

    const email = $('#email').value.trim();
    const clave = $('#clave').value;
    if (!esEmail(email)) return marcarError('email', 'Revisá el mail.');
    if (!clave) return marcarError('clave', 'Escribí tu contraseña.');

    const restaurar = ocupar($('#enviar'), 'Entrando…');
    try {
      await entrar(email, clave);
      location.href = destino();
    } catch (err) {
      aviso(mensajeDeError(err));
      restaurar();
    }
  };
}

// --- Crear cuenta --------------------------------------------------------

if (PANTALLA === 'registro') {
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    limpiarAviso();

    const nombre = $('#nombre').value.trim();
    const email = $('#email').value.trim();
    const telefono = $('#telefono').value.trim();
    const clave = $('#clave').value;

    if (nombre.length < 2) return marcarError('nombre', 'Poné tu nombre.');
    if (!esEmail(email)) return marcarError('email', 'Revisá el mail.');
    if (telefono.replace(/\D/g, '').length < 6) return marcarError('telefono', 'Revisá el teléfono.');
    if (clave.length < 6) return marcarError('clave', 'Al menos 6 caracteres.');

    const restaurar = ocupar($('#enviar'), 'Creando…');
    try {
      await registrar({ nombre, email, telefono, clave });
      location.href = destino();
    } catch (err) {
      aviso(mensajeDeError(err));
      restaurar();
    }
  };
}

// --- Recuperar contraseña ------------------------------------------------

if (PANTALLA === 'recuperar') {
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    limpiarAviso();

    const email = $('#email').value.trim();
    if (!esEmail(email)) return marcarError('email', 'Revisá el mail.');

    const restaurar = ocupar($('#enviar'), 'Enviando…');
    try {
      await recuperarClave(email);
    } catch (err) {
      // Un mail inexistente devuelve error, y decirlo permitiría averiguar
      // qué direcciones tienen cuenta. Se responde siempre lo mismo.
      if (!String(err?.code ?? '').includes('user-not-found')) {
        aviso(mensajeDeError(err));
        return restaurar();
      }
    }
    aviso('Si hay una cuenta con ese mail, te llega un enlace para cambiar la contraseña. Revisá también el correo no deseado.', 'ok');
    $('#form').reset();
    restaurar();
  };
}

// Con sesión abierta, estas pantallas no tienen sentido.
onUsuario((usuario) => {
  if (usuario) location.replace(destino());
});
