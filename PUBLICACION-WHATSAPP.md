# Rediseño con carrito por WhatsApp

Publicación preparada el 16 de septiembre de 2026.

Firebase Hosting sirve `web/`, copia del rediseño v39 de `Godo V2`.
La raíz conserva la versión anterior para referencia; no es el directorio publicado.
El workflow de `main` publica Hosting solamente. No desplegar Functions ni reglas
como parte de esta actualización.

`web/js/canal-venta.js` fija `SOLO_WHATSAPP = true`. El carrito abre un borrador
con productos, variantes, cantidades, entrega, costo de entrega y total estimado.
El cliente envía el mensaje; abrirlo no crea pedidos, consume cupones ni modifica
stock. Disponibilidad, pago y entrega se acuerdan con el dueño por WhatsApp.
Los accesos a `checkout.html` y `comprar.html` redirigen al carrito.

MODO preproducción permanece implementado en el backend y probado; no hay cobros
MODO de producción habilitados. Activarlo requiere credenciales propias, revisión
del circuito productivo y una publicación específica; no basta con cambiar el flag.
Las funciones de MODO más recientes viven en `Godo V2/functions`, y todavía deben
sincronizarse mediante revisión antes de un futuro despliegue general del backend.

Respaldo de Hosting anterior: canal `respaldo-pre-whatsapp`, versión original
`aaee92679f750283`. Vista de revisión: canal `whatsapp-revision`.

Reversión inmediata (mientras exista el canal de respaldo):

```powershell
firebase hosting:clone godo-suplementos:respaldo-pre-whatsapp godo-suplementos:live --project godo-suplementos
```

Si se revierte Hosting, revertir también el commit de publicación antes de nuevos
pushes a main para que el despliegue automático no vuelva a publicar el rediseño.

Validación: sintaxis de todos los módulos JS, referencias locales de HTML,
catálogo y carrito contra Firebase, envío con total incluido en el borrador,
ausencia de pagos online, redirecciones y página de pagos.
