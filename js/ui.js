export function mostrarToast(mensaje, tipo = "success") {
  // Usa tu toast de index.html (puedes mejorar esto luego)
  const toast = document.getElementById("toast-agregado");
  toast.querySelector(".toast-body").textContent = mensaje;
  toast.className = `toast align-items-center text-white bg-${tipo} border-0 position-fixed end-0 bottom-0 m-4`;
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 2000);
}

export function mostrarError(mensaje) {
  alert(mensaje); // Mejorar con modal bonito
}

export function mostrarSpinner() {
  // Implementar según tu preferencia
}
export function ocultarSpinner() {
  // Implementar según tu preferencia
}