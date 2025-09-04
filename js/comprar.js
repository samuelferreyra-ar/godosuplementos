// js/comprar.js — Sólo productos en el mensaje de WhatsApp (sin login, sin datos extra)
import { getCarrito, vaciarCarrito } from './carrito.js';

const WHATSAPP_NUM = "5493834235967"; // Nº de Godo Suplementos (formato internacional, sin +)

const SEL = {
  resumen: "#checkout-resumen",
  total:   "#checkout-total",
  form:    "#checkout-form",         // si existe
  btn:     "#btn-realizar-pedido",   // si existe
  msgBox:  "#compra-msg"             // si existe
};

const $ = (s) => document.querySelector(s);

function formatoPrecio(n) {
  return (Number(n) || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  });
}

function renderResumen() {
  const carrito = getCarrito();
  const cont = $(SEL.resumen);
  const totalEl = $(SEL.total);
  if (!cont) return;

  if (!carrito.length) {
    cont.innerHTML = `<div class="alert alert-info">Tu carrito está vacío.</div>`;
    if (totalEl) totalEl.textContent = formatoPrecio(0);
    return;
  }

  cont.innerHTML = carrito.map(p => {
    const nombre = p.nombre || p.titulo || p.id || "Producto";
    const marca  = p.marca ? ` · ${p.marca}` : "";
    const peso   = p.peso ? ` · ${p.peso}` : "";
    const cant   = p.cantidad || 1;
    const precio = Number(p.precio) || 0;
    const sub    = precio * cant;

    return `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div class="me-2">
          <div class="fw-semibold">${nombre}${marca}${peso}</div>
          <div class="small text-muted">x${cant} — ${formatoPrecio(precio)} c/u</div>
        </div>
        <div class="text-end">${formatoPrecio(sub)}</div>
      </div>
    `;
  }).join("");

  const total = carrito.reduce((a, p) => a + (Number(p.precio)||0) * (p.cantidad||1), 0);
  if (totalEl) totalEl.textContent = formatoPrecio(total);
}

function armarLineasProductos() {
  const carrito = getCarrito();
  if (!carrito.length) return "—";
  return carrito.map(p => {
    const nombre = p.nombre || p.titulo || p.id || "Producto";
    const marca  = p.marca ? ` ${p.marca}` : "";
    const peso   = p.peso ? ` ${p.peso}` : "";
    const cant   = p.cantidad || 1;
    const sub    = (Number(p.precio) || 0) * cant;
    return `• ${nombre}${marca}${peso} x${cant} – ${formatoPrecio(sub)}`;
  }).join("\n");
}

function armarMensajeWhatsAppSoloProductos() {
  const carrito = getCarrito();
  const lineas  = armarLineasProductos();
  const total   = carrito.reduce((a, p) => a + (Number(p.precio)||0) * (p.cantidad||1), 0);

  // ⚠️ Sólo productos y total. Nada de datos del cliente ni de la orden.
  return [
    "🛒 *Pedido* – GODO Suplementos",
    "",
    lineas,
    "",
    `*Total:* ${formatoPrecio(total)}`
  ].join("\n");
}

function esMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function abrirWhatsApp(numero, texto) {
  const n = (numero || "").replace(/\D/g, "");
  const url = esMobile()
    ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}`
    : `https://web.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(texto)}`;
  window.location.href = url;
}

function feedback(html, cls = "info") {
  const box = $(SEL.msgBox);
  if (box) box.innerHTML = `<div class="alert alert-${cls}">${html}</div>`;
}

function handleSubmit(e) {
  e?.preventDefault();
  const carrito = getCarrito();

  if (!carrito.length) {
    feedback("Tu carrito está vacío.", "info");
    alert("Tu carrito está vacío.");
    return;
  }

  const texto = armarMensajeWhatsAppSoloProductos();
  abrirWhatsApp(WHATSAPP_NUM, texto);

  // Si querés conservar el carrito por si el cliente no envía el mensaje, comentá esta línea:
  setTimeout(() => vaciarCarrito(), 1200);

  feedback("Abriendo WhatsApp con tu pedido…", "success");
}

function init() {
  renderResumen();

  // Soporta submit por <form> o click de botón.
  const form = $(SEL.form);
  const btn  = $(SEL.btn);

  if (form) form.addEventListener("submit", handleSubmit);
  if (btn)  btn.addEventListener("click", handleSubmit);

  // Re-render al volver por historial
  window.addEventListener("pageshow", renderResumen);
}

init();
