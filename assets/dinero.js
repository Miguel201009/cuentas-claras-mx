// Cálculos de la sección Dinero y ahorro de Cuentas Claras MX: CETES contra banco, meses sin intereses y préstamos.
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
    // En 2025 fue 0.50%. Para 2027 Hacienda propuso 0.68% (iniciativa de LIF 2027, 8 sep 2026): aún no es ley.
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

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: { monto: 1e9, tasaAhorro: 100, tasaCredito: 1000, inflacion: 100, meses: 480, dias: 3650, comision: 50 }
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

  const api = { DATOS, num, porcentaje, rendimiento, perdidaInflacion, limiteExento, compararAhorro, mesesSinIntereses, tirMensual, prestamo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Dinero = api;
})(this);
