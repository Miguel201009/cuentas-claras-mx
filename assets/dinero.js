// Cálculos de la sección Dinero y ahorro de Cuentas Claras MX: CETES contra banco, meses sin intereses, préstamos,
// interés compuesto, crédito automotriz, pago mínimo de la tarjeta de crédito y remesas.
// Funciones puras, sin datos personales: todo se calcula en el navegador de la persona.
// En el navegador carga antes ../../assets/calc.js (ahí está mxn() para el formato de pesos y la UMA en Calc.DATOS).
(function (raiz) {
  const Calc = (typeof module !== "undefined" && module.exports) ? require("./calc.js") : raiz.Calc;

  // Valores oficiales y supuestos. Revisar cada enero (la tasa de retención cambia cada año).
  const DATOS = {
    anio: 2026,

    // Retención de ISR sobre intereses: 0.90% anual sobre el CAPITAL, no sobre la ganancia.
    // Ley de Ingresos de la Federación 2026 (DOF 7 nov 2025), vigente del 1 ene al 31 dic 2026.
    // PENDIENTE: confirmar el número de artículo en el PDF oficial de la LIF 2026 (DOF y diputados.gob.mx no abren desde
    // esta red). Fuentes secundarias (mley.mx y resúmenes de búsqueda, oct 2026) lo citan como art. 24; un despacho lo
    // cita como art. 17; en las LIF 2024 y 2025 estaba en el art. 21. Por eso la página no cita el número.
    // La tasa de 0.90% sí coincide en todas las fuentes (DFK, CEFP, AMCP, IDC, EY).
    // En 2025 fue 0.50%. Para 2027 Hacienda propuso 0.68% (iniciativa de LIF 2027, 8 sep 2026).
    // El Senado aprobó la LIF 2027 el 27 oct 2026 (Bloomberg Línea; El Contribuyente, 29 oct, dice que queda en 0.68%);
    // al 2 nov 2026 no está publicada en el DOF. Cambiar la tasa cuando se publique (rige desde el 1 ene 2027).
    // Arts. 54 y 135 LISR: la retienen bancos, casas de bolsa y cetesdirecto; es un pago a cuenta del ISR anual.
    // Se aplica en proporción a los días que dura la inversión, con año de 365 días.
    retencionIsr: 0.009,
    diasRetencion: 365,

    // Intereses exentos de ISR, art. 93, fr. XX LISR: a) los que pagan los bancos en cuentas de cheques, de nómina,
    // de pensiones o depósitos de ahorro, y b) los que pagan las Sofipos y las cooperativas de ahorro y préstamo,
    // si el saldo promedio diario no pasa de 5 salarios mínimos elevados al año. Por la desindexación (DOF 27 ene 2016)
    // se usa la UMA: 5 x UMA x 365 = $214,090.75 con la UMA de $117.31 (vigente del 1 feb 2026 al 31 ene 2027).
    // Sobre intereses exentos no se retiene. Un pagaré o depósito a plazo en un banco no es "depósito de ahorro".
    // Texto confirmado con fuentes secundarias (material de IDC, mley.mx); diputados.gob.mx no abrió desde esta red.
    // Art. 96 del Reglamento de la LISR: para el saldo promedio se suman todas las cuentas o inversiones de la persona
    // en la misma institución o sociedad.
    exentoUmas: 5,

    // Los CETES calculan su rendimiento con año de 360 días: precio = 10 / (1 + tasa x días / 360).
    // Para el banco se usa la misma base; si un banco usa 365 días, la diferencia es pequeña.
    diasTasa: 360,
    // CETES: títulos de deuda del Gobierno Federal con valor de $10, que se compran con descuento.
    // Plazos más comunes en cetesdirecto (Nafin) y monto mínimo de $100 (Reglas de operación de cetesdirecto).
    plazosCetes: [28, 91, 182, 364],
    minimoCetes: 100,

    // Seguro de depósitos del IPAB: hasta 400,000 UDIS por persona y por banco.
    // Art. 11 de la Ley de Protección al Ahorro Bancario.
    ipabUdis: 400000,
    // UDI de referencia para pasar a pesos: Banxico, serie SIE CP150 (valor del 23 oct 2026). Cambia cada día.
    // PENDIENTE de verificar en Banxico (no abre desde esta red). Avisos de la BMV de 2026 traen valores de 8.80 a 8.84
    // (abr a ago), así que la página solo dice "alrededor de $8.8" y "cerca de 3.5 millones".
    udi: { valor: 8.860298, fecha: "2026-10-23" },

    // IVA general de 16%: art. 1 de la Ley del IVA. Los préstamos personales, de nómina y las tarjetas lo cobran
    // sobre los intereses; los intereses de créditos hipotecarios para casa habitación no (art. 15 fr. X LIVA).
    // Ojo: el art. 18-A LIVA dice que en créditos de instituciones financieras y tarjetas la base es el "valor real"
    // de los intereses: a la tasa de cada periodo se le resta la inflación del periodo (medida con la UDI); si la tasa
    // no pasa de la inflación, no se causa IVA en ese periodo (texto del art. 18-A confirmado con leyes-mx.com y Justia;
    // diputados.gob.mx no abrió). Aquí se usa 16% del interés completo como estimación alta, y la página lo dice.
    // La comisión por apertura es un servicio: se le suma 16% de IVA, aunque los intereses no lo paguen.
    iva: 0.16,

    // Meta de inflación del Banco de México: 3% anual, con un margen de un punto arriba o abajo.
    metaInflacion: 0.03,

    // El Buen Fin 2026: del viernes 13 al martes 17 de noviembre (5 días). Bloomberg Línea, N+ (29 sep 2026), Expansión
    // (7 oct 2026) y Fox Sports. El lunes 16 es descanso obligatorio (art. 74 fr. VI LFT, tercer lunes de noviembre).
    // Registro de comercios hasta el 12 nov 2026 en elbuenfin.org. Sorteo del SAT: compras con tarjeta desde $250
    // (Bloomberg Línea y N+); las bases de 2026 las publica el SAT. Revisado el 21 oct 2026.
    buenFin: { anio: 2026, inicio: "2026-11-13", fin: "2026-11-17", dias: 5, sorteoMinimo: 250 },

    // Tarjeta de crédito: pago mínimo. Banxico, Circular 13/2011 (1 jun 2011), numeral 2.1: el mayor entre 1.5% del
    // saldo revolvente al corte (sin los intereses ni el IVA del periodo) más los intereses del periodo con su IVA, y
    // 1.25% del límite de crédito; si sale más que el saldo, se cobra el saldo. Esos porcentajes rigen desde el
    // 4 ene 2013 (transitorio segundo). Texto de la circular leído en la copia de la ABM (abm.org.mx); coincide El
    // Financiero (7 may 2023). banxico.org.mx no abrió desde esta red. Cada banco puede pedir un mínimo mayor.
    // Tasas de ejemplo, NO promedio oficial: N+ (5 nov 2026) cita un CAT promedio de 52.44% para clientes que no pagan
    // el total (jun 2025) y tasas "alrededor de 38%"; Banamex LineUp anuncia tasa promedio ponderada de 61.81% y CAT
    // promedio de 87.6% sin IVA (cálculo 27 may 2026); el comparativo de Banxico de tarjetas clásicas (jun 2026) va de
    // 31.2% a 217.1% de CAT. Por eso la página usa 45% anual sin IVA como ejemplo y pide la tasa del estado de cuenta.
    tarjeta: { pctSaldo: 0.015, pctLinea: 0.0125, tasaEjemplo: 45, tasaMaxima: 300, maxMeses: 1200 },

    // Remesas. Impuesto federal de EE. UU. de 1% a envíos pagados en efectivo, giro postal, cheque de caja o similar,
    // desde el 1 ene 2026 (ley H.R. 1, Public Law 119-21, "One Big Beautiful Bill", 4 jul 2025). Exentos: los que se
    // pagan desde una cuenta de banco o con tarjeta de débito o crédito emitida en EE. UU. Lo cobra la remesadora a
    // quien envía. Fuentes: BBVA Research ("Impuesto a las remesas 2026", ene 2026) y La Nación (9 dic 2025, con la
    // guía del IRS, Notice 2025-55). Para comparar remesadoras: Profeco, "Quién es Quién en el Envío de Dinero"
    // (qqed.profeco.gob.mx), al que también manda la página de Banxico del programa Directo a México, que deja de
    // operar el 20 nov 2026 (Banxico y Expansión, 8 oct 2026). Tipos de cambio y comisiones de la página: ejemplos.
    remesas: { impuestoEeuu: 0.01, tipoMaximo: 1000 },

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: { monto: 1e9, tasaAhorro: 100, tasaCredito: 1000, inflacion: 100, meses: 480, dias: 3650, comision: 50, anios: 60 },

    // Capitalización del interés compuesto: veces al año que los intereses se suman al saldo.
    capitalizaciones: { diaria: 365, mensual: 12, trimestral: 4, anual: 1 }
  };

  // Número válido, finito y positivo; vacío, texto, negativo o infinito cuenta como 0.
  function num(x) {
    const n = +x;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Igual que num(), sin pasar de un máximo.
  function hasta(x, max) {
    return Math.min(num(x), max);
  }

  // ¿Alguna entrada pasa de su máximo? Recibe pares [valor, máximo].
  function pasaMaximo(pares) {
    return pares.some(([v, max]) => num(v) > max);
  }

  // Formato de porcentaje: 0.3449 -> "34.49%".
  function porcentaje(x, decimales = 2) {
    const n = Number.isFinite(x) ? x : 0;
    return (n * 100).toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }) + "%";
  }

  // ---------- Ahorro: CETES o banco ----------

  // Rendimiento de una inversión a plazo con tasa anual simple (tasa en %, por ejemplo 6 para 6%).
  // Intereses = monto x tasa x días / 360. Retención de ISR = monto x 0.90% x días / 365.
  // La retención se limita a los intereses ganados para no mostrar una ganancia negativa (ver pendientes).
  function rendimiento({ monto, tasaAnual, dias, retencion = DATOS.retencionIsr }) {
    const max = DATOS.maximos;
    const m = hasta(monto, max.monto);
    const tasa = hasta(tasaAnual, max.tasaAhorro) / 100;
    const d = Math.round(hasta(dias, max.dias));
    const bruto = m * tasa * d / DATOS.diasTasa;
    const retencionCapital = m * retencion * d / DATOS.diasRetencion;
    const isr = Math.min(retencionCapital, bruto);
    const neto = bruto - isr;
    return {
      monto: m, tasa, dias: d, bruto, retencionCapital, isr, retencionTopada: retencionCapital > bruto,
      neto, final: m + neto,
      tasaNeta: m > 0 && d > 0 ? neto / m * DATOS.diasTasa / d : 0 // tasa anual que te queda después de la retención
    };
  }

  // Lo que la inflación le quita a tu dinero en ese plazo (inflación anual en %).
  function perdidaInflacion(monto, inflacion, dias) {
    const pi = hasta(inflacion, DATOS.maximos.inflacion) / 100;
    const d = Math.round(hasta(dias, DATOS.maximos.dias));
    return hasta(monto, DATOS.maximos.monto) * (Math.pow(1 + pi, d / 365) - 1);
  }

  // Saldo promedio hasta el que los intereses de una cuenta de ahorro, nómina o cheques (o de una Sofipo o
  // cooperativa autorizada) están exentos: 5 UMA elevadas al año (art. 93 fr. XX LISR). 2026: $214,090.75.
  function limiteExento() {
    return Math.round(DATOS.exentoUmas * Calc.DATOS.uma * 365 * 100) / 100;
  }

  // Compara el mismo monto y plazo en CETES y en un banco.
  // bancoExento = true: el dinero del banco está en una cuenta de ahorro, nómina o cheques (o en una Sofipo o
  // cooperativa autorizada). Si el monto no pasa del límite exento, al banco no se le resta retención.
  // Si pasa del límite, se calcula con la retención completa (puede que solo retengan sobre una parte; se avisa).
  function compararAhorro({ monto, dias, tasaCetes, tasaBanco, inflacion, bancoExento = false }) {
    const max = DATOS.maximos;
    const recortado = pasaMaximo([[monto, max.monto], [tasaCetes, max.tasaAhorro], [tasaBanco, max.tasaAhorro],
      [inflacion, max.inflacion], [dias, max.dias]]);
    const cetes = rendimiento({ monto, tasaAnual: tasaCetes, dias });
    const limite = limiteExento();
    const marcoExento = bancoExento === true;
    const exento = marcoExento && cetes.monto <= limite;
    const banco = rendimiento({ monto, tasaAnual: tasaBanco, dias, retencion: exento ? 0 : DATOS.retencionIsr });
    const perdida = perdidaInflacion(monto, inflacion, dias);
    const diferencia = cetes.neto - banco.neto;
    let mejor = "igual";
    if (diferencia > 0.005) mejor = "cetes";
    else if (diferencia < -0.005) mejor = "banco";
    return {
      cetes, banco, recortado, perdidaInflacion: perdida,
      realCetes: cetes.neto - perdida, realBanco: banco.neto - perdida,
      diferencia, mejor, bajoMinimoCetes: cetes.monto > 0 && cetes.monto < DATOS.minimoCetes,
      bancoExento: exento, pasaLimiteExento: marcoExento && cetes.monto > limite, limiteExento: limite
    };
  }

  // ---------- Meses sin intereses ----------

  // ¿Conviene pagar de contado o a meses sin intereses?
  // Idea: si compras a meses, puedes dejar invertido el dinero del precio de contado y sacar de ahí cada mensualidad.
  // Valor de hoy de las mensualidades = pago x (1 - (1 + i)^-n) / i, con i = rendimiento anual / 12.
  // Si ese valor es menor que el precio de contado, conviene a meses; la diferencia es lo que ahorras en pesos de hoy.
  // La inflación (anual, en %) dice cuánto valen hoy tus pagos aunque no inviertas: i = (1 + inflación)^(1/12) - 1.
  function mesesSinIntereses({ precioContado, precioMeses, meses, rendimiento: rend, inflacion }) {
    const max = DATOS.maximos;
    const recortado = pasaMaximo([[precioContado, max.monto], [precioMeses, max.monto], [meses, max.meses],
      [rend, max.tasaAhorro], [inflacion, max.inflacion]]);
    const contado = hasta(precioContado, max.monto);
    const aMeses = hasta(precioMeses, max.monto);
    const n = Math.round(hasta(meses, max.meses));
    const r = hasta(rend, max.tasaAhorro) / 100;
    const pi = hasta(inflacion, max.inflacion) / 100;
    const sinMeses = n < 1;
    // Sin alguno de los dos precios no hay nada que comparar: no se da veredicto (conviene = "faltan").
    const faltanPrecios = contado === 0 || aMeses === 0;
    const sinDatos = sinMeses || faltanPrecios;
    const pago = sinMeses ? 0 : aMeses / n;
    const i = r / 12;
    const vp = sinMeses ? 0 : (i > 0 ? pago * (1 - Math.pow(1 + i, -n)) / i : aMeses);
    const im = Math.pow(1 + pi, 1 / 12) - 1;
    const vpInflacion = sinMeses ? 0 : (im > 0 ? pago * (1 - Math.pow(1 + im, -n)) / im : aMeses);
    const ventajaHoy = sinDatos ? 0 : contado - vp; // positivo: conviene a meses
    // Si apartas el precio de contado, lo inviertes y de ahí pagas cada mes, esto te sobra (o te falta) al final.
    const alFinal = ventajaHoy * Math.pow(1 + i, n);
    const intereses = sinDatos ? 0 : alFinal - (contado - aMeses); // lo que ganó tu dinero mientras pagabas
    let conviene = "igual";
    if (sinDatos) conviene = "faltan";
    else if (ventajaHoy > 0.005) conviene = "meses";
    else if (ventajaHoy < -0.005) conviene = "contado";
    return {
      contado, aMeses, meses: n, sinMeses, faltanPrecios, recortado, rendimiento: r, inflacion: pi,
      pago, vp, ventajaHoy, alFinal, intereses, vpInflacion,
      ahorroInflacion: sinDatos ? 0 : contado - vpInflacion,
      sobreprecio: faltanPrecios ? 0 : aMeses - contado, conviene
    };
  }

  // ---------- Préstamo con pagos fijos (amortización francesa) ----------

  // Tasa interna de retorno mensual: la tasa r con la que el valor de hoy de los pagos es igual a lo que recibes.
  // Se resuelve por bisección (siempre converge porque el valor de hoy baja cuando r sube).
  function tirMensual(flujos, recibido) {
    if (!(recibido > 0) || !flujos.length) return 0;
    const vp = r => {
      let suma = 0, factor = 1;
      for (const f of flujos) { factor /= 1 + r; suma += f * factor; }
      return suma;
    };
    if (vp(0) <= recibido) return 0;
    let bajo = 0, alto = 1;
    while (vp(alto) > recibido && alto < 1e6) alto *= 2;
    for (let k = 0; k < 200; k++) {
      const medio = (bajo + alto) / 2;
      if (vp(medio) > recibido) bajo = medio; else alto = medio;
    }
    return (bajo + alto) / 2;
  }

  // Préstamo con pago mensual fijo. tasaAnual en % y sin IVA; comision en % del monto (comisión por apertura, sin IVA).
  // Cada mes: interés = saldo x tasa / 12; IVA = interés x 16%; lo demás del pago baja tu deuda (capital).
  // Para que el pago sea fijo con IVA, se calcula con la tasa mensual más su IVA: j = tasa / 12 x 1.16.
  // Pago = monto x j / (1 - (1 + j)^-n). Si la tasa es 0, pago = monto / n.
  // El saldo y el capital de cada mes se calculan en forma cerrada, no restando mes con mes: con tasas altas y plazos
  // largos la resta arrastraba errores de redondeo que crecían x (1 + j) cada mes (pagos inflados o negativos).
  //   saldo después de k pagos = monto x (1 - (1 + j)^(k - n)) / (1 - (1 + j)^-n)   (con tasa 0: monto x (1 - k / n))
  //   capital del mes k = pago x (1 + j)^(k - 1 - n)                                  (con tasa 0: monto / n)
  // Se usan expm1 y log1p para no perder precisión con tasas muy chicas.
  // La comisión por apertura y su IVA se descuentan de lo que recibes.
  // CAT estimado: (1 + TIR mensual)^12 - 1, sin IVA, con los pagos de capital e interés contra el monto menos la
  // comisión (sin su IVA). Metodología de la Circular 21/2009 de Banxico; no incluye seguros ni otros cargos.
  function prestamo({ monto, tasaAnual, meses, conIva = true, comision = 0 }) {
    const max = DATOS.maximos;
    const recortado = pasaMaximo([[monto, max.monto], [tasaAnual, max.tasaCredito], [meses, max.meses], [comision, max.comision]]);
    const m = hasta(monto, max.monto);
    const tasa = hasta(tasaAnual, max.tasaCredito) / 100;
    const n = Math.round(hasta(meses, max.meses));
    const c = hasta(comision, max.comision) / 100;
    const ivaTasa = conIva ? DATOS.iva : 0;
    const i = tasa / 12;
    const j = i * (1 + ivaTasa);
    const comisionMonto = m * c;
    const ivaComision = comisionMonto * DATOS.iva;
    const recibes = m - comisionMonto - ivaComision;
    const vacio = { monto: m, tasa, meses: n, ivaTasa, recortado, sinMonto: m === 0, sinMeses: n < 1,
      tasaMensual: i, tasaConIva: tasa * (1 + ivaTasa), pago: 0, tabla: [], totalIntereses: 0, totalIva: 0,
      totalPagado: 0, comisionMonto, ivaComision, recibes, cat: 0, costoTotal: 0 };
    if (m === 0 || n < 1) return vacio;

    const L = Math.log1p(j); // ln(1 + j)
    const factor = j > 0 ? -Math.expm1(-n * L) : 1; // 1 - (1 + j)^-n
    const pago = j > 0 ? m * j / factor : m / n;
    const saldoTras = k => k >= n ? 0 : (j > 0 ? m * -Math.expm1((k - n) * L) / factor : m * (1 - k / n));
    const tabla = [];
    let totalIntereses = 0, totalIva = 0, totalPagado = 0;
    for (let k = 1; k <= n; k++) {
      const antes = saldoTras(k - 1);
      const saldo = saldoTras(k);
      const interes = antes * i;
      const ivaMes = interes * ivaTasa;
      // El último pago liquida lo que quede; los demás usan la forma cerrada (nunca negativa).
      const capital = k === n ? antes : (j > 0 ? pago * Math.exp((k - 1 - n) * L) : m / n);
      const pagoMes = capital + interes + ivaMes;
      totalIntereses += interes;
      totalIva += ivaMes;
      totalPagado += pagoMes;
      tabla.push({ mes: k, pago: pagoMes, capital, interes, iva: ivaMes, saldo });
    }
    const tir = tirMensual(tabla.map(f => f.capital + f.interes), m - comisionMonto);
    const cat = Math.pow(1 + tir, 12) - 1;
    return {
      monto: m, tasa, meses: n, ivaTasa, recortado, sinMonto: false, sinMeses: false,
      tasaMensual: i, tasaConIva: tasa * (1 + ivaTasa), pago, tabla, totalIntereses, totalIva, totalPagado,
      comisionMonto, ivaComision, recibes, tirMensual: tir, cat: Number.isFinite(cat) ? cat : Number.MAX_VALUE,
      // lo que pagas por encima de lo que te prestaron: intereses, su IVA, la comisión y su IVA
      costoTotal: totalIntereses + totalIva + comisionMonto + ivaComision
    };
  }

  // ---------- El Buen Fin: ¿de verdad es oferta? ----------

  // Compara el precio de oferta contra el precio "antes" que anuncia la tienda y, si lo tienes, contra el precio más
  // bajo que viste en las semanas previas (lo que recomienda Profeco: comparar antes). extra: % de descuento adicional
  // (por ejemplo, con cierta tarjeta) que se aplica sobre el precio de oferta.
  // veredicto: "faltan" (sin precios), "noEsOferta" (pagas lo mismo o más que el precio de referencia),
  // "inflado" (el precio "antes" es mayor que el que viste: el descuento real es menor que el anunciado) o "real".
  function descuentoReal({ precioAntes, precioOferta, precioPrevio = 0, extra = 0 }) {
    const max = DATOS.maximos;
    const recortado = pasaMaximo([[precioAntes, max.monto], [precioOferta, max.monto], [precioPrevio, max.monto], [extra, 100]]);
    const antes = hasta(precioAntes, max.monto);
    const oferta = hasta(precioOferta, max.monto);
    const previo = hasta(precioPrevio, max.monto);
    const pExtra = hasta(extra, 100) / 100;
    const final = oferta * (1 - pExtra);
    const faltan = antes === 0 || oferta === 0;
    const conPrevio = previo > 0;
    const referencia = conPrevio ? previo : antes;
    const anunciado = faltan ? 0 : 1 - oferta / antes;
    const total = faltan ? 0 : 1 - final / antes;
    const real = faltan ? 0 : 1 - final / referencia;
    let veredicto = "real";
    if (faltan) veredicto = "faltan";
    else if (final >= referencia - 0.005) veredicto = "noEsOferta";
    else if (conPrevio && previo < antes - 0.005) veredicto = "inflado";
    return {
      antes, oferta, previo, extra: pExtra, final, faltan, conPrevio, referencia, recortado,
      anunciado, total, real, ahorroAnunciado: faltan ? 0 : antes - final, ahorroReal: faltan ? 0 : referencia - final,
      veredicto
    };
  }

  // ---------- Interés compuesto: cuánto crece tu ahorro ----------

  // Saldo de un ahorro con monto inicial y aportación fija al final de cada mes.
  // tasaAnual en % (tasa nominal anual), capitalizacion: veces al año que se suman los intereses (365, 12, 4 o 1).
  // Para juntar aportaciones mensuales con cualquier capitalización se usa la tasa mensual equivalente:
  //   i = (1 + tasa / m)^(m / 12) - 1   (con m = 12 es tasa / 12)
  // Saldo después de n meses = inicial x (1 + i)^n + aportación x ((1 + i)^n - 1) / i   (con i = 0: inicial + aportación x n)
  // Tasa efectiva anual = (1 + tasa / m)^m - 1. Con inflación (anual, en %) el saldo en pesos de hoy es saldo / (1 + inflación)^años.
  // No resta impuestos: la retención de ISR depende de dónde ahorres (ver rendimiento()).
  function interesCompuesto({ inicial, aportacion = 0, tasaAnual, anios, capitalizacion = 12, inflacion = 0 }) {
    const max = DATOS.maximos;
    const recortado = pasaMaximo([[inicial, max.monto], [aportacion, max.monto], [tasaAnual, max.tasaAhorro],
      [anios, max.anios], [inflacion, max.inflacion]]);
    const p0 = hasta(inicial, max.monto);
    const a = hasta(aportacion, max.monto);
    const tasa = hasta(tasaAnual, max.tasaAhorro) / 100;
    const n = Math.round(hasta(anios, max.anios) * 12);
    const pi = hasta(inflacion, max.inflacion) / 100;
    const m = [365, 12, 4, 1].includes(+capitalizacion) ? +capitalizacion : 12;
    const i = Math.pow(1 + tasa / m, m / 12) - 1;
    const efectiva = Math.pow(1 + tasa / m, m) - 1;
    const saldoEn = k => {
      const f = Math.pow(1 + i, k);
      return p0 * f + (i > 0 ? a * (f - 1) / i : a * k);
    };
    const tabla = [];
    for (let k = 12; k <= n; k += 12) {
      const saldo = saldoEn(k);
      const aportado = p0 + a * k;
      tabla.push({ anio: k / 12, aportado, intereses: saldo - aportado, saldo });
    }
    if (n % 12 && n > 0) {
      const saldo = saldoEn(n), aportado = p0 + a * n;
      tabla.push({ anio: n / 12, aportado, intereses: saldo - aportado, saldo });
    }
    const final = saldoEn(n);
    const aportado = p0 + a * n;
    const anios_ = n / 12;
    const realFinal = final / Math.pow(1 + pi, anios_);
    return {
      inicial: p0, aportacion: a, tasa, meses: n, anios: anios_, capitalizacion: m, tasaMensual: i, efectiva,
      inflacion: pi, recortado, sinDatos: n === 0 || (p0 === 0 && a === 0),
      final, aportado, intereses: final - aportado, realFinal, tabla,
      // años para duplicar el monto inicial sin aportaciones (con tasa 0 nunca se duplica)
      aniosDuplicar: efectiva > 0 ? Math.log(2) / Math.log(1 + efectiva) : 0
    };
  }

  // ---------- Crédito automotriz ----------

  // Pago mensual de un crédito para auto: el banco o la financiera presta el precio menos el enganche.
  // enganche en % del precio. La tasa (anual, en %, sin IVA) y el plazo van a prestamo(): pagos fijos con IVA de 16%
  // sobre los intereses (un crédito automotriz es crédito al consumo; no es de los exentos del art. 15 LIVA).
  // La comisión por apertura (en % del crédito) se paga al inicio con su IVA de 16%; para el CAT estimado cuenta
  // como si se descontara del crédito. No incluye el seguro del auto ni otros seguros.
  function creditoAutomotriz({ precio, enganche, tasaAnual, meses, comision = 0, conIva = true }) {
    const max = DATOS.maximos;
    const p = hasta(precio, max.monto);
    const e = hasta(enganche, 100) / 100;
    const engancheMonto = p * e;
    const credito = p - engancheMonto;
    const r = prestamo({ monto: credito, tasaAnual, meses, conIva, comision });
    const recortado = r.recortado || pasaMaximo([[precio, max.monto], [enganche, 100]]);
    // Lo que pagas al inicio: enganche, comisión y su IVA.
    const alInicio = engancheMonto + r.comisionMonto + r.ivaComision;
    return Object.assign({}, r, {
      precio: p, enganchePct: e, engancheMonto, credito, recortado, sinPrecio: p === 0, sinCredito: p > 0 && credito === 0,
      alInicio,
      // Lo que te cuesta el auto en total: enganche, todos los pagos, la comisión y su IVA.
      costoAuto: alInicio + r.totalPagado,
      sobrePrecio: r.costoTotal
    });
  }

  // ---------- Tarjeta de crédito: pagar solo el mínimo ----------

  // Mes a mes, sin compras nuevas ni comisiones: interés = saldo x tasa / 12; IVA = interés x 16% (estimación alta, ver
  // DATOS.iva); el pago se resta de saldo + interés + IVA. pagoDe(saldo, cargos) dice cuánto pagas ese mes.
  // Si el pago no alcanza a cubrir el interés y su IVA, la deuda nunca baja: nunca = true.
  function simularTarjeta(saldo, i, ivaTasa, pagoDe, maxMeses) {
    let s = saldo, meses = 0, intereses = 0, iva = 0, pagado = 0, nunca = false, primerPago = 0;
    const porAnio = [];
    while (s > 0.005 && meses < maxMeses) {
      const interes = s * i, ivaMes = interes * ivaTasa, adeudo = s + interes + ivaMes;
      const pago = Math.min(pagoDe(s, interes + ivaMes), adeudo);
      if (pago <= interes + ivaMes + 1e-9 && pago < adeudo - 0.005) { nunca = true; break; }
      if (!meses) primerPago = pago;
      meses++;
      intereses += interes; iva += ivaMes; pagado += pago;
      s = adeudo - pago;
      if (s <= 0.005) s = 0;
      if (meses % 12 === 0 || s === 0) porAnio.push({ mes: meses, saldo: s, pagado, intereses: intereses + iva });
    }
    return {
      meses, anios: meses / 12, primerPago, intereses, iva, costo: intereses + iva, totalPagado: pagado,
      nunca, sinTerminar: !nunca && s > 0.005, saldoFinal: s, porAnio
    };
  }

  // Pago mínimo de una tarjeta de crédito (Banxico, Circular 13/2011, numeral 2.1; vigente desde el 4 ene 2013):
  // el mayor entre a) 1.5% del saldo revolvente al corte (sin intereses ni IVA del periodo) más los intereses del
  // periodo con su IVA, y b) 1.25% del límite de crédito. Si sale más que lo que debes, pagas lo que debes.
  // Compara pagar solo el mínimo contra un pago fijo cada mes. tasaAnual en % sin IVA (tasa ordinaria, no el CAT).
  // linea: límite de crédito; si es menor que el saldo (o vacío) se usa el saldo, y se avisa.
  function pagoMinimoTarjeta({ saldo, tasaAnual, linea = 0, pagoFijo = 0, conIva = true }) {
    const max = DATOS.maximos, t = DATOS.tarjeta;
    const recortado = pasaMaximo([[saldo, max.monto], [linea, max.monto], [pagoFijo, max.monto], [tasaAnual, t.tasaMaxima]]);
    const s = hasta(saldo, max.monto);
    const tasa = hasta(tasaAnual, t.tasaMaxima) / 100;
    const lineaCapturada = hasta(linea, max.monto);
    const l = Math.max(lineaCapturada, s);
    const fijo = hasta(pagoFijo, max.monto);
    const i = tasa / 12, ivaTasa = conIva ? DATOS.iva : 0;
    const minimoDe = (saldoMes, cargos) => Math.max(t.pctSaldo * saldoMes + cargos, t.pctLinea * l);
    const minimo = simularTarjeta(s, i, ivaTasa, minimoDe, t.maxMeses);
    const conFijo = fijo > 0 ? simularTarjeta(s, i, ivaTasa, () => fijo, t.maxMeses) : null;
    // Pago fijo con el que terminas en el mismo plazo que con el mínimo no tiene sentido; mejor: lo que ahorras.
    const ahorro = conFijo && !conFijo.nunca && !minimo.nunca ? minimo.costo - conFijo.costo : 0;
    return {
      saldo: s, tasa, tasaConIva: tasa * (1 + ivaTasa), linea: l, lineaAjustada: s > 0 && lineaCapturada < s, pagoFijo: fijo,
      recortado, sinSaldo: s === 0, minimo, fijo: conFijo, ahorro,
      mesesMenos: conFijo && !conFijo.nunca ? minimo.meses - conFijo.meses : 0,
      // Pago fijo mínimo para que la deuda baje desde el primer mes: más que el interés con IVA del primer mes.
      fijoMinimoUtil: s * i * (1 + ivaTasa),
      primerMinimo: s > 0 ? Math.min(minimoDe(s, s * i * (1 + ivaTasa)), s * (1 + i * (1 + ivaTasa))) : 0
    };
  }

  // ---------- Remesas: cuánto llega si te mandan dólares ----------

  // Lo que recibe tu familia en pesos y lo que cuesta el envío.
  // dolares: lo que se manda; comision: lo que cobra la remesadora, en dólares; tipoReferencia: pesos por dólar de
  // referencia (por ejemplo el FIX de Banxico del día); tipoOfrecido: los pesos por dólar que paga la remesadora.
  // Margen del tipo de cambio = 1 - ofrecido / referencia (lo que la remesadora gana en el cambio).
  // efectivo = true: el envío se paga en efectivo, giro postal o cheque de caja en EE. UU. y lleva el impuesto federal
  // de 1% (desde el 1 ene 2026; exentas las que se pagan desde una cuenta de banco o con tarjeta de débito o crédito
  // emitida en EE. UU.). Lo paga quien envía, además de la comisión.
  function remesa({ dolares, comision = 0, tipoReferencia, tipoOfrecido, efectivo = false }) {
    const max = DATOS.maximos, cfg = DATOS.remesas;
    const recortado = pasaMaximo([[dolares, max.monto], [comision, max.monto], [tipoReferencia, cfg.tipoMaximo], [tipoOfrecido, cfg.tipoMaximo]]);
    const usd = hasta(dolares, max.monto);
    const com = hasta(comision, max.monto);
    const ref = hasta(tipoReferencia, cfg.tipoMaximo);
    const ofr = hasta(tipoOfrecido, cfg.tipoMaximo);
    const impuesto = efectivo === true ? usd * cfg.impuestoEeuu : 0;
    const recibe = usd * ofr;
    const valorReferencia = usd * ref;
    const margen = valorReferencia - recibe; // pesos que se quedan en el tipo de cambio (negativo si pagan más que la referencia)
    const comisionPesos = com * ref, impuestoPesos = impuesto * ref;
    const costo = comisionPesos + margen + impuestoPesos;
    const pagaUsd = usd + com + impuesto;
    return {
      dolares: usd, comision: com, tipoReferencia: ref, tipoOfrecido: ofr, efectivo: efectivo === true, recortado,
      sinDatos: usd === 0 || ofr === 0, sinReferencia: ref === 0,
      recibe, valorReferencia, margen, margenPct: ref > 0 ? 1 - ofr / ref : 0,
      comisionPesos, impuesto, impuestoPesos, pagaUsd, costo,
      costoPct: valorReferencia > 0 ? costo / valorReferencia : 0, // costo total como % de lo enviado (como el Banco Mundial)
      pesosPorDolarPagado: pagaUsd > 0 ? recibe / pagaUsd : 0, // pesos que llegan por cada dólar que sale de la bolsa
      ofreceMasQueReferencia: ref > 0 && ofr > ref
    };
  }

  // Compara dos remesadoras con el mismo envío. Gana la de menor costo total en pesos (comisión + margen del tipo de
  // cambio + impuesto, todo al tipo de referencia): con los mismos dólares enviados, es la que deja más a tu familia
  // por lo que paga quien envía. diferencia: pesos de diferencia en el costo.
  function compararRemesas(base, a, b) {
    const ra = remesa(Object.assign({}, base, a)), rb = remesa(Object.assign({}, base, b));
    const dif = ra.costo - rb.costo;
    let mejor = "igual";
    if (ra.sinDatos || rb.sinDatos || ra.sinReferencia) mejor = "faltan";
    else if (dif < -0.005) mejor = "a";
    else if (dif > 0.005) mejor = "b";
    return { a: ra, b: rb, mejor, diferencia: Math.abs(dif) };
  }

  const api = { DATOS, pagoMinimoTarjeta, simularTarjeta, remesa, compararRemesas, interesCompuesto, creditoAutomotriz, num, porcentaje, descuentoReal, rendimiento, perdidaInflacion, limiteExento, compararAhorro, mesesSinIntereses, tirMensual, prestamo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Dinero = api;
})(this);
