// Cloud Functions de Godo Suplementos.
//
// Regla central: el navegador manda QUE quiere comprar, nunca CUANTO cuesta.
// Precios, stock, envio y total se recalculan siempre acá contra Firestore.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { generarCodigo, normalizarCodigo, motivoRechazo, calcularDescuento, PORCENTAJES_VALIDOS } from './cupones.js';

initializeApp();
const db = getFirestore();

// Co-locadas con Firestore (southamerica-west1). maxInstances acota el gasto
// si algo se dispara.
setGlobalOptions({ region: 'southamerica-west1', maxInstances: 10 });

const PRODUCTOS = 'productos_v2';
const MAX_ITEMS = 50;
const MAX_CANTIDAD = 99;

const CONFIG_POR_DEFECTO = {
  // El costo depende de la zona. Se resuelve siempre acá: el navegador manda
  // la zona elegida, nunca el precio del envio.
  zonasEnvio: {},
  umbralEnvioGratis: null, // null = no hay envio gratis por monto
  metodosPago: ['transferencia', 'efectivo']
};

const ESTADOS_ENTREGA = { RETIRO: 'retiro', ENVIO: 'envio' };

// --- Validacion ----------------------------------------------------------

const esTexto = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
const esEmail = (v) => esTexto(v, 5, 120) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const esTelefono = (v) => typeof v === 'string' && v.replace(/\D/g, '').length >= 6 && v.replace(/\D/g, '').length <= 20;
const esEntero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

function malaPeticion(mensaje, detalle) {
  return new HttpsError('invalid-argument', mensaje, detalle);
}

function validarEntrada(data) {
  if (!data || typeof data !== 'object') throw malaPeticion('Pedido vacío.');

  const { items, contacto, entrega, pago, canal } = data;

  if (!Array.isArray(items) || !items.length) throw malaPeticion('El carrito está vacío.');
  if (items.length > MAX_ITEMS) throw malaPeticion('Demasiados productos en el pedido.');

  const normalizados = items.map((it, i) => {
    if (!esTexto(it?.productoId, 1, 200) || !esTexto(it?.varianteId, 1, 200)) {
      throw malaPeticion(`El ítem ${i + 1} no identifica un producto válido.`);
    }
    if (!esEntero(it?.cantidad, 1, MAX_CANTIDAD)) {
      throw malaPeticion(`La cantidad del ítem ${i + 1} no es válida.`);
    }
    return { productoId: it.productoId.trim(), varianteId: it.varianteId.trim(), cantidad: it.cantidad };
  });

  // Un mismo par producto+variante no puede venir dos veces: se sumaria mal.
  const claves = normalizados.map((i) => i.productoId + '|' + i.varianteId);
  if (new Set(claves).size !== claves.length) throw malaPeticion('El carrito tiene líneas repetidas.');

  if (!esTexto(contacto?.nombre, 2, 80)) throw malaPeticion('Falta tu nombre.');
  if (!esEmail(contacto?.email)) throw malaPeticion('El mail no parece válido.');
  if (!esTelefono(contacto?.telefono)) throw malaPeticion('El teléfono no parece válido.');

  const tipoEntrega = entrega?.tipo;
  if (tipoEntrega !== ESTADOS_ENTREGA.RETIRO && tipoEntrega !== ESTADOS_ENTREGA.ENVIO) {
    throw malaPeticion('Elegí si retirás en el local o querés envío.');
  }

  let direccion = null;
  let zona = null;
  if (tipoEntrega === ESTADOS_ENTREGA.ENVIO) {
    if (!esTexto(entrega?.zona, 1, 60)) throw malaPeticion('Elegí la zona de envío.');
    zona = entrega.zona.trim().toLowerCase();

    const d = entrega?.direccion;
    if (!esTexto(d?.calle, 2, 120) || !esTexto(d?.numero, 1, 20) ||
        !esTexto(d?.localidad, 2, 80) || !esTexto(d?.provincia, 2, 80)) {
      throw malaPeticion('Faltan datos de la dirección de envío.');
    }
    direccion = {
      calle: d.calle.trim(), numero: d.numero.trim(),
      piso: esTexto(d?.piso, 1, 20) ? d.piso.trim() : '',
      departamento: esTexto(d?.departamento, 1, 20) ? d.departamento.trim() : '',
      localidad: d.localidad.trim(), provincia: d.provincia.trim(),
      codigoPostal: esTexto(d?.codigoPostal, 3, 12) ? d.codigoPostal.trim() : ''
    };
  }

  if (!esTexto(pago?.metodo, 2, 30)) throw malaPeticion('Elegí un medio de pago.');

  const cupon = data.cupon ? normalizarCodigo(data.cupon) : null;
  if (cupon && (cupon.length < 6 || cupon.length > 40)) throw malaPeticion('Ese código no es válido.');

  return {
    items: normalizados,
    cupon,
    contacto: {
      nombre: contacto.nombre.trim(),
      email: contacto.email.trim().toLowerCase(),
      telefono: contacto.telefono.trim()
    },
    entrega: { tipo: tipoEntrega, zona, direccion },
    metodoPago: pago.metodo.trim().toLowerCase(),
    canal: canal === 'whatsapp' ? 'whatsapp' : 'web'
  };
}

async function leerConfig() {
  const snap = await db.doc('config/tienda').get();
  return { ...CONFIG_POR_DEFECTO, ...(snap.exists ? snap.data() : {}) };
}

function calcularEnvio(tipo, zona, subtotal, config) {
  if (tipo === ESTADOS_ENTREGA.RETIRO) {
    return { costo: 0, gratis: false, zona: null, nombreZona: null };
  }

  const zonas = config.zonasEnvio ?? {};
  const definicion = zonas[zona];
  if (!definicion) {
    throw malaPeticion('Esa zona de envío no existe.', {
      zonasDisponibles: Object.entries(zonas).map(([id, z]) => ({ id, nombre: z.nombre, costo: z.costo }))
    });
  }

  const nombreZona = definicion.nombre ?? zona;
  const umbral = config.umbralEnvioGratis;
  if (typeof umbral === 'number' && umbral > 0 && subtotal >= umbral) {
    return { costo: 0, gratis: true, zona, nombreZona };
  }
  return { costo: Number(definicion.costo) || 0, gratis: false, zona, nombreZona };
}

// --- crearPedido ---------------------------------------------------------
// Sin auth obligatoria: el diseño permite comprar sin cuenta. Si hay sesion,
// el pedido queda asociado al usuario.

export const crearPedido = onCall(async (request) => {
  const entrada = validarEntrada(request.data);
  const config = await leerConfig();

  const metodosHabilitados = Array.isArray(config.metodosPago) ? config.metodosPago : CONFIG_POR_DEFECTO.metodosPago;
  if (!metodosHabilitados.includes(entrada.metodoPago)) {
    throw malaPeticion('Ese medio de pago no está disponible por ahora.', { habilitados: metodosHabilitados });
  }

  // Pagar en efectivo al retirar exige, justamente, retirar.
  if (entrada.metodoPago === 'efectivo' && entrada.entrega.tipo !== ESTADOS_ENTREGA.RETIRO) {
    throw malaPeticion('El pago en efectivo es solo para retiro en el local.');
  }

  const clienteId = request.auth?.uid ?? null;
  const idsProductos = [...new Set(entrada.items.map((i) => i.productoId))];

  const resultado = await db.runTransaction(async (t) => {
    // ----- LECTURAS (todas antes de cualquier escritura) -----
    const refs = idsProductos.map((id) => db.collection(PRODUCTOS).doc(id));
    const snaps = await t.getAll(...refs);
    const contadorRef = db.doc('contadores/pedidos');
    const contadorSnap = await t.get(contadorRef);

    // El cupón se lee dentro de la transacción: si dos pedidos intentan
    // canjear el mismo código de un solo uso, uno de los dos reintenta y falla.
    const cuponRef = entrada.cupon ? db.doc('cupones/' + entrada.cupon) : null;
    const cuponSnap = cuponRef ? await t.get(cuponRef) : null;
    if (cuponRef) {
      const rechazo = motivoRechazo(cuponSnap);
      if (rechazo) throw new HttpsError('failed-precondition', rechazo, { campo: 'cupon' });
    }

    const porId = new Map();
    snaps.forEach((s) => { if (s.exists) porId.set(s.id, s.data()); });

    const faltantes = [];
    const lineas = [];

    for (const item of entrada.items) {
      const producto = porId.get(item.productoId);
      if (!producto) {
        faltantes.push({ ...item, motivo: 'El producto ya no está disponible.' });
        continue;
      }
      const variante = producto.variantes?.[item.varianteId];
      if (!variante) {
        faltantes.push({ ...item, motivo: 'Esa presentación ya no existe.' });
        continue;
      }
      if (variante.pausada) {
        faltantes.push({ ...item, nombre: producto.nombre, motivo: 'Sin stock por el momento.' });
        continue;
      }
      if ((variante.stock ?? 0) < item.cantidad) {
        faltantes.push({
          ...item, nombre: producto.nombre, disponible: variante.stock ?? 0,
          motivo: `Quedan ${variante.stock ?? 0} unidades.`
        });
        continue;
      }

      // El precio SIEMPRE sale de Firestore, nunca del cliente.
      const precio = Number(variante.precio) || 0;
      lineas.push({
        productoId: item.productoId,
        varianteId: item.varianteId,
        nombre: producto.nombre,
        marca: producto.marca ?? '',
        sabor: variante.sabor ?? '',
        tamano: variante.tamano ?? '',
        precio,
        cantidad: item.cantidad,
        subtotal: precio * item.cantidad
      });
    }

    if (faltantes.length) {
      throw new HttpsError('failed-precondition', 'Algunos productos ya no están disponibles.', { faltantes });
    }

    const subtotal = lineas.reduce((a, l) => a + l.subtotal, 0);

    const porcentaje = cuponSnap ? Number(cuponSnap.data().porcentaje) : 0;
    const descuento = cuponSnap ? calcularDescuento(subtotal, porcentaje) : 0;
    const subtotalConDescuento = subtotal - descuento;

    // El umbral de envío gratis se mide sobre lo que el cliente termina
    // pagando por los productos, no sobre el precio de lista.
    const envio = calcularEnvio(entrada.entrega.tipo, entrada.entrega.zona, subtotalConDescuento, config);
    const total = subtotalConDescuento + envio.costo;

    const numero = (Number(contadorSnap.data()?.ultimo) || 0) + 1;
    const pedidoRef = db.collection('pedidos').doc();
    const ahora = Timestamp.now();

    // ----- ESCRITURAS -----

    // Un update por producto, agrupando sus lineas: dos variantes del mismo
    // producto en un pedido son dos campos del mismo documento.
    const porProducto = new Map();
    for (const l of lineas) {
      if (!porProducto.has(l.productoId)) porProducto.set(l.productoId, []);
      porProducto.get(l.productoId).push(l);
    }

    for (const [productoId, suyas] of porProducto) {
      const producto = porId.get(productoId);
      const cambios = {};
      let vendidas = 0;

      for (const l of suyas) {
        const restante = (producto.variantes[l.varianteId].stock ?? 0) - l.cantidad;
        cambios['variantes.' + l.varianteId + '.stock'] = FieldValue.increment(-l.cantidad);
        // Una variante en cero se despublica sola, sin perder precio ni fotos.
        if (restante === 0) cambios['variantes.' + l.varianteId + '.pausada'] = true;
        vendidas += l.cantidad;
      }

      // Desnormalizado: Firestore no filtra por dentro de un mapa.
      const variantesTrasVenta = { ...producto.variantes };
      for (const l of suyas) {
        const v = variantesTrasVenta[l.varianteId];
        const restante = (v.stock ?? 0) - l.cantidad;
        variantesTrasVenta[l.varianteId] = { ...v, stock: restante, pausada: restante === 0 ? true : v.pausada };
      }
      cambios.stockTotal = FieldValue.increment(-vendidas);
      cambios.variantesActivas = Object.values(variantesTrasVenta).filter((v) => !v.pausada).length;
      cambios.actualizadoEn = ahora;

      t.update(db.collection(PRODUCTOS).doc(productoId), cambios);

      for (const l of suyas) {
        t.set(db.collection('movimientosStock').doc(), {
          productoId: l.productoId, varianteId: l.varianteId,
          delta: -l.cantidad, motivo: 'venta',
          pedidoId: pedidoRef.id, usuarioId: clienteId, fecha: ahora
        });
      }
    }

    const pedido = {
      numero,
      clienteId,
      contacto: entrada.contacto,
      items: lineas,
      subtotal,
      envio: {
        tipo: entrada.entrega.tipo,
        zona: envio.zona,
        nombreZona: envio.nombreZona,
        costo: envio.costo,
        gratis: envio.gratis,
        direccion: entrada.entrega.direccion
      },
      pago: { metodo: entrada.metodoPago, estado: 'pendiente' },
      cupon: cuponSnap ? { codigo: entrada.cupon, porcentaje, descuento } : null,
      descuento,
      total,
      canal: entrada.canal,
      estado: 'sin_preparar',
      creadoEn: ahora,
      actualizadoEn: ahora
    };

    t.set(pedidoRef, pedido);
    t.set(contadorRef, { ultimo: numero, actualizadoEn: ahora }, { merge: true });

    if (cuponRef) {
      t.update(cuponRef, {
        usos: FieldValue.increment(1),
        usadoEn: ahora,
        pedidoId: pedidoRef.id,
        clienteId
      });
    }

    return {
      pedidoId: pedidoRef.id, numero, subtotal,
      cupon: cuponSnap ? { codigo: entrada.cupon, porcentaje, descuento } : null,
      descuento,
      envio: { costo: envio.costo, gratis: envio.gratis, zona: envio.zona, nombreZona: envio.nombreZona },
      total, items: lineas
    };
  });

  return resultado;
});

// --- validarCupon --------------------------------------------------------
// Le dice al checkout si un código sirve, sin consumirlo. El canje real pasa
// dentro de crearPedido: entre que se valida y se compra, el código puede
// haberse usado en otro pedido.

export const validarCupon = onCall(async (request) => {
  const codigo = normalizarCodigo(request.data?.codigo);
  if (!codigo || codigo.length < 6) throw malaPeticion('Escribí el código completo.');

  const snap = await db.doc('cupones/' + codigo).get();
  const rechazo = motivoRechazo(snap);

  // Un código inexistente y uno ya usado devuelven mensajes distintos a
  // propósito: el cliente tiene que poder distinguir "lo tipeé mal" de
  // "ya lo canjeé". No hay nada que proteger, el código ya lo tiene.
  if (rechazo) return { valido: false, motivo: rechazo };

  return { valido: true, codigo, porcentaje: Number(snap.data().porcentaje) };
});

// --- generarCupones ------------------------------------------------------
// Solo admin. El sitio nunca ofrece cupones por su cuenta: los genera el dueño
// y los entrega a mano a quien quiera.

export const generarCupones = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión.');

  const usuarioSnap = await db.doc('usuarios/' + request.auth.uid).get();
  const esAdmin = request.auth.token?.admin === true || usuarioSnap.data()?.admin === true;
  if (!esAdmin) throw new HttpsError('permission-denied', 'Solo un administrador puede generar cupones.');

  const porcentaje = Number(request.data?.porcentaje);
  if (!PORCENTAJES_VALIDOS.includes(porcentaje)) {
    throw malaPeticion('El descuento tiene que ser de ' + PORCENTAJES_VALIDOS.join('% o ') + '%.');
  }

  const cantidad = Number(request.data?.cantidad ?? 1);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) {
    throw malaPeticion('Se pueden generar entre 1 y 50 códigos por vez.');
  }

  const nota = esTexto(request.data?.nota, 1, 120) ? request.data.nota.trim() : '';
  const diasValidez = Number(request.data?.diasValidez ?? 0);
  const ahora = Timestamp.now();
  const venceEn = diasValidez > 0
    ? Timestamp.fromMillis(ahora.toMillis() + diasValidez * 86400000)
    : null;

  const lote = db.batch();
  const codigos = [];
  const vistos = new Set();

  while (codigos.length < cantidad) {
    const codigo = generarCodigo();
    if (vistos.has(codigo)) continue;   // colisión dentro del mismo lote
    vistos.add(codigo);
    codigos.push(codigo);

    // create() en vez de set(): si el código ya existiera, falla en vez de
    // pisar un cupón vigente.
    lote.create(db.doc('cupones/' + codigo), {
      porcentaje,
      usos: 0,
      maxUsos: 1,
      activo: true,
      nota,
      venceEn,
      creadoEn: ahora,
      creadoPor: request.auth.uid,
      usadoEn: null,
      pedidoId: null,
      clienteId: null
    });
  }

  await lote.commit();
  return { codigos, porcentaje, venceEn: venceEn ? venceEn.toDate().toISOString() : null };
});

// --- cancelarPedido ------------------------------------------------------
// Devuelve el stock al catalogo. Sin esto, cada pedido cancelado seria stock
// perdido para siempre.

export const cancelarPedido = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Necesitás iniciar sesión.');

  const usuarioSnap = await db.doc('usuarios/' + request.auth.uid).get();
  const esAdmin = request.auth.token?.admin === true || usuarioSnap.data()?.admin === true;
  if (!esAdmin) throw new HttpsError('permission-denied', 'Solo un administrador puede cancelar un pedido.');

  const pedidoId = request.data?.pedidoId;
  if (!esTexto(pedidoId, 1, 200)) throw malaPeticion('Falta el pedido a cancelar.');
  const motivo = esTexto(request.data?.motivo, 1, 300) ? request.data.motivo.trim() : 'cancelado por el administrador';

  return db.runTransaction(async (t) => {
    const pedidoRef = db.doc('pedidos/' + pedidoId);
    const pedidoSnap = await t.get(pedidoRef);
    if (!pedidoSnap.exists) throw new HttpsError('not-found', 'Ese pedido no existe.');

    const pedido = pedidoSnap.data();
    if (pedido.estado === 'cancelado') throw new HttpsError('failed-precondition', 'El pedido ya estaba cancelado.');

    const ids = [...new Set(pedido.items.map((i) => i.productoId))];
    const snaps = ids.length ? await t.getAll(...ids.map((id) => db.collection(PRODUCTOS).doc(id))) : [];
    const porId = new Map();
    snaps.forEach((s) => { if (s.exists) porId.set(s.id, s.data()); });

    const ahora = Timestamp.now();

    for (const id of ids) {
      const producto = porId.get(id);
      // Si el producto fue borrado no hay adonde devolver: se registra igual
      // el movimiento para que el historial no mienta.
      if (!producto) continue;

      const suyas = pedido.items.filter((i) => i.productoId === id);
      const cambios = {};
      let devueltas = 0;
      const variantesTras = { ...producto.variantes };

      for (const l of suyas) {
        if (!variantesTras[l.varianteId]) continue;
        const v = variantesTras[l.varianteId];
        const stockPrevio = v.stock ?? 0;
        const restante = stockPrevio + l.cantidad;
        cambios['variantes.' + l.varianteId + '.stock'] = FieldValue.increment(l.cantidad);
        // Se republica solo si estaba pausada POR haber llegado a cero. Una
        // variante que el dueño pauso a mano teniendo stock sigue pausada.
        const pausadaPorCero = v.pausada && stockPrevio === 0;
        const pausadaFinal = pausadaPorCero ? false : (v.pausada ?? false);
        if (pausadaPorCero) cambios['variantes.' + l.varianteId + '.pausada'] = false;
        variantesTras[l.varianteId] = { ...v, stock: restante, pausada: pausadaFinal };
        devueltas += l.cantidad;
      }

      if (devueltas) {
        cambios.stockTotal = FieldValue.increment(devueltas);
        cambios.variantesActivas = Object.values(variantesTras).filter((v) => !v.pausada).length;
        cambios.actualizadoEn = ahora;
        t.update(db.collection(PRODUCTOS).doc(id), cambios);
      }

      for (const l of suyas) {
        t.set(db.collection('movimientosStock').doc(), {
          productoId: l.productoId, varianteId: l.varianteId,
          delta: l.cantidad, motivo: 'cancelacion',
          pedidoId, usuarioId: request.auth.uid, fecha: ahora
        });
      }
    }

    // El cupón NO se libera al cancelar, a propósito: "un solo uso" no tiene
    // excepciones, y así cada código aparece en exactamente un pedido y el
    // historial nunca es ambiguo. Si hay que compensar al cliente, el dueño
    // le genera un código nuevo.
    t.update(pedidoRef, {
      estado: 'cancelado',
      motivoCancelacion: motivo,
      canceladoEn: ahora,
      actualizadoEn: ahora
    });

    return { pedidoId, numero: pedido.numero, estado: 'cancelado' };
  });
});
