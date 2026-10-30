// Cálculos de la sección Vivienda de Cuentas Claras MX: rentar o comprar, predial, aportaciones al Infonavit,
// revisión de puntos Infonavit, crédito FOVISSSTE y crédito hipotecario de un banco.
// Funciones puras, sin datos personales: todo se calcula en el navegador de la persona.
// En el navegador carga antes ../../assets/calc.js (UMA, salario mínimo y mxn()). En Node se lee con require.
(function (raiz) {
  const enNode = typeof module !== "undefined" && module.exports;
  const Calc = enNode ? require("./calc.js") : raiz.Calc;

  // Valores oficiales y supuestos. Revisar cada año.
  const DATOS = {
    anio: 2026,

    infonavit: {
      // El patrón aporta 5% del salario del trabajador a su Subcuenta de Vivienda, con tope de 25 UMA.
      // Ley del Infonavit, art. 29, fr. II (texto vigente de la Cámara de Diputados).
      aportacion: 0.05,
      topeUma: 25,
      // Tasas del crédito tradicional: NO se guardan aquí. La "Tabla de tasas de interés diferenciadas por nivel
      // salarial" del Infonavit solo se leyó por buscador y sus cortes (2.6 y 6.6 UMA) no cuadran con el salario
      // mínimo 2026 (315.04 / 117.31 = 2.69 UMA), así que no sabemos qué salario mide. La guía enlaza al portal.
      // Modelo de evaluación T1000: 1,080 puntos y 3 bimestres de cotización continua. Así aparecía en la página de
      // precalificación del Infonavit consultada por buscador en octubre de 2026 (y en el Plan Estratégico y
      // Financiero 2023-2027). Puede no aplicar al Modelo Único de Originación (desde agosto de 2025).
      // Solo se usa como texto en la guía; la meta que aplica sale en la precalificación de cada persona.
      puntosT1000: 1080,
      // Bimestres de cotización continua que pedía el modelo T1000 (bajaron de 6 a 3 en 2021: La Razón, 7 oct 2021,
      // con datos del Infonavit; y la página de precalificación del Infonavit leída por buscador en oct 2026).
      bimestresT1000: 3,
      // Modelo T100 (Modelo Único de Originación): escala de 100 puntos, anunciado por Octavio Romero Oropeza en la
      // mañanera de agosto de 2025, para quien gana de 1 a 2 salarios mínimos y no tiene casa ni crédito de vivienda
      // (Expansión 21 ago 2025, IDC 18 ago 2025, UnoTV 19 ago 2025 y 4 jun 2026). No se publicó la fórmula de puntos.
      // El límite de "2 salarios mínimos" lo tomamos al mes como salario mínimo diario x 30 (UnoTV citó $16,800 en
      // 2025 = 2 x 278.80 x 30 redondeado). Es nuestra lectura: la página lo dice como estimado.
      puntosT100: 100,
      salariosMinimosT100: 2
    },

    fovissste: {
      // Crédito Mi FOVISSSTE (antes "tradicional"): monto máximo + saldo de la Subcuenta de Vivienda, plazo hasta
      // 30 años, 18 meses de aportaciones. En pesos: hasta $1,405,090.00 a tasa fija de 8% a 11%. En UMA: hasta
      // 520 UMA ($1,854,434.40) a tasa de 2% a 6%, y el saldo se actualiza cada año con la UMA.
      // Fuentes: fovissste.gob.mx/credito/credito-tradicional-fovissste/ (leída el 30 oct 2026) y UnoTV (30 sep 2026).
      maximoPesos: 1405090,
      maximoUma: 520,
      tasaPesos: [8, 11],
      tasaUma: [2, 6],
      plazoMax: 30,
      mesesAportacion: 18,
      // El pago se descuenta por nómina: 30% del sueldo básico. Así lo dice el FOVISSSTE en el Crédito Unidos y en
      // su nota del crédito en pesos de Vivienda para el Bienestar (13 oct 2026). Se usa para estimar la capacidad.
      descuento: 30
    },

    predial: {
      // Nuevo León: 2 al millar al año sobre el valor catastral, para casa habitación (los predios baldíos suman una
      // tasa adicional de 1 o 2 al millar). Ley de Hacienda para los Municipios del Estado de Nuevo León, art. 21 Bis-8,
      // según el documento "Tasas y Tarifas Impuesto Predial 2026" del Municipio de Monterrey (leído por buscador en
      // octubre de 2026). Falta cotejarlo con el texto oficial del Congreso de Nuevo León (no abrió desde nuestra red).
      tasaNuevoLeon: 2,
      // Monterrey 2026: 15% de descuento por pagar el año completo a más tardar el 5 de febrero (10% hasta el 5 de marzo).
      // Ley de Hacienda para los Municipios del Estado de Nuevo León y acuerdo municipal publicado el 23 ene 2026.
      descuentoMonterrey: 15
    },

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: {
      monto: 1e9, renta: 1e7, anios: 40, plazo: 30, tasa: 40, rendimiento: 30,
      aumentoRenta: 30, plusvalia: 30, minusvalia: -20, porcentaje: 100, gastos: 30, mantenimiento: 10,
      tasaMillar: 50
    }
  };

  // Número válido, finito y positivo; vacío, texto, negativo o infinito cuenta como 0.
  function num(x) {
    if (x === "" || x === null || x === undefined) return 0;
    const n = +x;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Número dentro de [min, max]. Vacío o texto cuenta como 0; lo que se sale del rango se recorta.
  // Devuelve { valor, recortado } para poder avisar en la página.
  function rango(x, min, max) {
    const crudo = x === "" || x === null || x === undefined ? 0 : +x;
    const n = Number.isNaN(crudo) ? 0 : crudo;
    if (n > max) return { valor: max, recortado: true };
    if (n < min) return { valor: min, recortado: true };
    return { valor: n, recortado: false };
  }

  // Pago fijo mensual de un crédito: monto, tasa anual en % y número de meses.
  // pago = monto x i / (1 - (1 + i)^-n), con i = tasa / 12. Con tasa 0 es monto / n.
  function pagoMensual(monto, tasaAnual, meses) {
    const m = num(monto), n = Math.floor(num(meses));
    if (!m || !n) return 0;
    const i = num(tasaAnual) / 100 / 12;
    if (i === 0) return m / n;
    return m * i / (1 - Math.pow(1 + i, -n));
  }

  // ¿Rentar o comprar? Compara cuánto patrimonio tendrías después de N años en cada caso,
  // gastando lo mismo cada mes:
  // - Si compras: pagas enganche y gastos de compra al inicio; cada mes pagas la hipoteca, el mantenimiento y el predial.
  //   Al final tienes la casa (con su plusvalía) menos lo que aún debes.
  // - Si rentas: inviertes el enganche y los gastos que no pagaste; cada mes pagas la renta.
  // Cada mes, quien gasta menos invierte la diferencia con el rendimiento indicado (tasa anual / 12, cada mes).
  // El mantenimiento y el predial suben al mismo ritmo que el valor de la casa; la renta sube una vez al año.
  // No incluye impuestos de las inversiones ni costos de vender la casa.
  function rentarOComprar(e) {
    const M = DATOS.maximos;
    const leidos = {
      anios: rango(Math.floor(num(e.anios)), 0, M.anios),
      renta: rango(num(e.renta), 0, M.renta),
      aumentoRenta: rango(num(e.aumentoRenta), 0, M.aumentoRenta),
      precio: rango(num(e.precio), 0, M.monto),
      enganche: rango(num(e.enganche), 0, M.porcentaje),
      gastos: rango(num(e.gastosCompra), 0, M.gastos),
      tasa: rango(num(e.tasa), 0, M.tasa),
      plazo: rango(Math.floor(num(e.plazo)), 0, M.plazo),
      plusvalia: rango(e.plusvalia, M.minusvalia, M.plusvalia),
      mantenimiento: rango(num(e.mantenimiento), 0, M.mantenimiento),
      predial: rango(num(e.predial), 0, M.renta),
      rendimiento: rango(num(e.rendimiento), 0, M.rendimiento)
    };
    const recortado = Object.values(leidos).some(x => x.recortado);
    const v = {};
    Object.keys(leidos).forEach(k => { v[k] = leidos[k].valor; });

    const N = v.anios;
    const sinPrecio = v.precio === 0;
    const sinAnios = N === 0;
    const enganche = v.precio * v.enganche / 100;
    const gastosCompra = v.precio * v.gastos / 100;
    const credito = v.precio - enganche;
    const sinPlazo = credito > 0 && v.plazo === 0;
    const mesesCredito = v.plazo * 12;
    const pago = sinPlazo ? 0 : pagoMensual(credito, v.tasa, mesesCredito);
    const i = v.tasa / 100 / 12;
    const j = v.rendimiento / 100 / 12;
    const g = v.aumentoRenta / 100;
    const a = v.plusvalia / 100;

    let saldo = sinPlazo ? 0 : credito;
    let cuentaRenta = enganche + gastosCompra; // lo que el que renta no gastó al inicio y pone a rendir
    let cuentaCompra = 0;
    let totalRenta = 0, totalHipoteca = 0, totalIntereses = 0, totalMantenimiento = 0, totalPredial = 0;
    const porAnio = [];
    let primerMes = null;

    if (!sinPrecio && !sinAnios && !sinPlazo) {
      for (let m = 0; m < 12 * N; m++) {
        const y = Math.floor(m / 12);
        const factorValor = Math.pow(1 + a, y);
        const rentaMes = v.renta * Math.pow(1 + g, y);
        const mantMes = v.precio * factorValor * v.mantenimiento / 100 / 12;
        const predialMes = v.predial * factorValor / 12;
        let hipotecaMes = 0;
        if (m < mesesCredito && saldo > 0) {
          const interes = saldo * i;
          let capital = pago - interes;
          if (capital > saldo || m === mesesCredito - 1) capital = saldo; // el último pago liquida lo que quede
          hipotecaMes = capital + interes;
          saldo -= capital;
          if (Math.abs(saldo) < 1e-6) saldo = 0;
          totalIntereses += interes;
        }
        const costoCompra = hipotecaMes + mantMes + predialMes;
        const diferencia = costoCompra - rentaMes;
        cuentaRenta = cuentaRenta * (1 + j) + Math.max(diferencia, 0);
        cuentaCompra = cuentaCompra * (1 + j) + Math.max(-diferencia, 0);
        totalRenta += rentaMes;
        totalHipoteca += hipotecaMes;
        totalMantenimiento += mantMes;
        totalPredial += predialMes;
        if (m === 0) primerMes = { renta: rentaMes, compra: costoCompra, hipoteca: hipotecaMes, mantenimiento: mantMes, predial: predialMes };
        if (m % 12 === 11) {
          const valorCasa = v.precio * Math.pow(1 + a, y + 1);
          porAnio.push({ anio: y + 1, valorCasa, saldo, compra: valorCasa - saldo + cuentaCompra, renta: cuentaRenta });
        }
      }
    }
    const ultimo = porAnio[porAnio.length - 1] || { valorCasa: v.precio, saldo, compra: 0, renta: 0 };
    const patrimonioCompra = porAnio.length ? ultimo.compra : 0;
    const patrimonioRenta = porAnio.length ? ultimo.renta : 0;
    const diferencia = patrimonioCompra - patrimonioRenta;
    // Año desde el que comprar deja igual o más que rentar y ya no vuelve a quedar abajo dentro del plazo.
    let ultimoAbajo = -1;
    porAnio.forEach((f, k) => { if (f.compra < f.renta) ultimoAbajo = k; });
    const cruce = ultimoAbajo < porAnio.length - 1 ? porAnio[ultimoAbajo + 1] : null;
    let conviene = "empate";
    if (Math.abs(diferencia) >= 1) conviene = diferencia > 0 ? "comprar" : "rentar";
    if (sinPrecio || sinAnios || sinPlazo) conviene = "faltan";
    // Intereses de todo el crédito (todo el plazo, no solo los años de la comparación): pagos fijos - lo prestado.
    const interesesCredito = credito > 0 && !sinPlazo ? Math.max(pago * mesesCredito - credito, 0) : 0;

    return {
      entradas: v, recortado, sinPrecio, sinAnios, sinPlazo,
      enganche, gastosCompra, inicial: enganche + gastosCompra, credito, pago,
      primerMes: primerMes || { renta: v.renta, compra: 0, hipoteca: 0, mantenimiento: 0, predial: 0 },
      valorCasa: ultimo.valorCasa, saldoFinal: ultimo.saldo, cuentaCompra, cuentaRenta,
      patrimonioCompra, patrimonioRenta, diferencia, conviene,
      anioCruce: cruce ? cruce.anio : null, porAnio,
      totalRenta, totalHipoteca, totalIntereses, interesesCredito, totalMantenimiento, totalPredial
    };
  }

  // Predial del año y descuento por pagarlo por adelantado.
  // modo "valor": valor catastral x tasa al millar / 1000 (solo para lugares con tasa fija, como Nuevo León).
  // modo "monto": la persona escribe lo que le cobran al año (lo que dice su boleta o estado de cuenta).
  function predial({ modo = "valor", valorCatastral, tasaMillar, montoAnual, descuento }) {
    const M = DATOS.maximos;
    const vc = rango(num(valorCatastral), 0, M.monto);
    const t = rango(num(tasaMillar), 0, M.tasaMillar);
    const ma = rango(num(montoAnual), 0, M.renta);
    const d = rango(num(descuento), 0, M.porcentaje);
    const anual = modo === "monto" ? ma.valor : vc.valor * t.valor / 1000;
    const ahorro = anual * d.valor / 100;
    const recortado = (modo === "monto" ? ma.recortado : vc.recortado || t.recortado) || d.recortado;
    return {
      modo, anual, descuento: d.valor, ahorro, pagas: anual - ahorro, bimestre: anual / 6,
      sinDatos: anual === 0, recortado
    };
  }

  // Lo que tu patrón deposita en tu Subcuenta de Vivienda (sin rendimientos ni aumentos de sueldo).
  // Salario base de cotización estimado: sueldo mensual / 30 x factor de integración mínimo de ley (calc.js),
  // con piso de un salario mínimo de la zona y tope de 25 UMA. Aportación: 5% de ese salario por cada día del año.
  // El piso es el límite inferior del salario base de cotización (Ley del Seguro Social, art. 28): el salario mínimo
  // general ($315.04) o el de la Zona Libre de la Frontera Norte ($440.87), de Calc.DATOS (CONASAMI, DOF 9 dic 2025).
  function aportacionInfonavit({ sueldoMensual, anios = 1, zona = "general" }) {
    const D = Calc.DATOS, I = DATOS.infonavit;
    const frontera = zona === "frontera";
    const s = rango(num(sueldoMensual), 0, DATOS.maximos.monto);
    const n = rango(num(anios), 0, DATOS.maximos.anios);
    const sueldo = s.valor;
    const recortado = s.recortado || n.recortado;
    if (!sueldo) {
      return { sueldo: 0, sinSueldo: true, recortado, anios: n.valor, sd: 0, sbc: 0, conPiso: false, topado: false,
        anual: 0, bimestral: 0, mensual: 0, acumulado: 0, vecesUma: 0, zona: frontera ? "frontera" : "general",
        piso: frontera ? D.salarioMinimo.frontera : D.salarioMinimo.general };
    }
    const sd = sueldo / 30;
    const integrado = sd * D.factorIntegracion;
    const piso = frontera ? D.salarioMinimo.frontera : D.salarioMinimo.general;
    const tope = I.topeUma * D.uma;
    const sbc = Math.min(Math.max(integrado, piso), tope);
    const anual = sbc * 365 * I.aportacion;
    return {
      sueldo, sinSueldo: false, recortado, anios: n.valor, sd, sbc, conPiso: integrado < piso, topado: integrado > tope,
      anual, bimestral: anual / 6, mensual: anual / 12, acumulado: anual * n.valor, vecesUma: sbc / D.uma,
      zona: frontera ? "frontera" : "general", piso
    };
  }

  // ---------- Crédito hipotecario de un banco ----------

  // Pago mensual fijo de una hipoteca bancaria a tasa fija. valor de la casa en pesos; enganche, gastos de escrituración
  // y comisión por apertura en % (los gastos, del valor de la casa; la comisión, del crédito); tasa anual en %; plazo en años.
  // seguroMensual: lo que el banco suma cada mes por seguros de vida y daños (en pesos; viene en la oferta del banco).
  // Los intereses de un crédito para comprar casa habitación no pagan IVA (art. 15, fr. X LIVA); la comisión
  // por apertura sí (16%, art. 1 LIVA). Pago = crédito x i / (1 - (1 + i)^-n), i = tasa / 12; con tasa 0, crédito / n.
  // El saldo de cada año se calcula en forma cerrada: saldo tras k pagos = crédito x (1 - (1 + i)^(k - n)) / (1 - (1 + i)^-n).
  function hipotecaBancaria({ valor, enganche, tasaAnual, plazo, gastos = 0, comision = 0, seguroMensual = 0 }) {
    const M = DATOS.maximos;
    const v = rango(num(valor), 0, M.monto);
    const e = rango(num(enganche), 0, M.porcentaje);
    const t = rango(num(tasaAnual), 0, M.tasa);
    const pl = rango(num(plazo), 0, M.plazo);
    const g = rango(num(gastos), 0, M.gastos);
    const c = rango(num(comision), 0, 10);
    const s = rango(num(seguroMensual), 0, M.renta);
    const recortado = [v, e, t, pl, g, c, s].some(x => x.recortado);
    const n = Math.round(pl.valor * 12);
    const engancheMonto = v.valor * e.valor / 100;
    const credito = v.valor - engancheMonto;
    const i = t.valor / 100 / 12;
    const gastosMonto = v.valor * g.valor / 100;
    const comisionMonto = credito * c.valor / 100;
    const ivaComision = comisionMonto * 0.16;
    const alInicio = engancheMonto + gastosMonto + comisionMonto + ivaComision;
    const base = { valor: v.valor, credito, engancheMonto, gastosMonto, comisionMonto, ivaComision, alInicio, recortado,
      meses: n, tasa: t.valor, seguroMensual: s.valor, sinDatos: credito <= 0 || n < 1,
      pago: 0, pagoConSeguros: 0, totalIntereses: 0, totalPagado: 0, totalSeguros: 0, tabla: [], porcentajeCredito: 0 };
    if (credito <= 0 || n < 1) return base;
    const f = i > 0 ? 1 - Math.pow(1 + i, -n) : 1;
    const pago = i > 0 ? credito * i / f : credito / n;
    const saldoTras = k => k >= n ? 0 : (i > 0 ? credito * (1 - Math.pow(1 + i, k - n)) / f : credito * (1 - k / n));
    const totalPagado = pago * n;
    const tabla = [];
    for (let a = 1; a * 12 - 12 < n; a++) {
      const desde = (a - 1) * 12, hasta_ = Math.min(a * 12, n);
      const capital = saldoTras(desde) - saldoTras(hasta_);
      const pagado = pago * (hasta_ - desde);
      tabla.push({ anio: a, capital, interes: pagado - capital, saldo: saldoTras(hasta_) });
    }
    return Object.assign(base, {
      pago, pagoConSeguros: pago + s.valor, totalPagado, totalIntereses: totalPagado - credito,
      totalSeguros: s.valor * n, tabla, porcentajeCredito: v.valor > 0 ? credito / v.valor : 0,
      // Interés del primer mes: cuánto de tu primer pago se va en intereses.
      interesPrimerMes: credito * i
    });
  }

  // ---------- Puntos Infonavit ----------

  // Revisión orientativa para la guía de puntos. El Infonavit no publica la fórmula de puntos, así que NO calcula
  // puntos: dice en cuántos salarios mínimos queda tu sueldo (para saber si encajas en el perfil del modelo T100,
  // de 1 a 2 salarios mínimos), cuántos bimestres continuos llevas contra los 3 del modelo T1000 y cuánto lleva
  // tu Subcuenta de Vivienda (aportacionInfonavit, sin rendimientos).
  // salario mínimo mensual = salario mínimo diario de la zona x 30.
  function revisionPuntosInfonavit({ sueldoMensual, meses, anios, zona = "general" }) {
    const I = DATOS.infonavit;
    const m = rango(Math.floor(num(meses)), 0, 600);
    const ap = aportacionInfonavit({ sueldoMensual, anios, zona });
    const smMensual = ap.piso * 30;
    const veces = ap.sueldo / smMensual;
    const limiteT100 = smMensual * I.salariosMinimosT100;
    const bimestres = Math.floor(m.valor / 2);
    return {
      sueldo: ap.sueldo, sinSueldo: ap.sinSueldo, zona: ap.zona, smMensual, veces, limiteT100,
      perfilT100: !ap.sinSueldo && ap.sueldo <= limiteT100 + 1e-9,
      meses: m.valor, bimestres, bimestresT1000: I.bimestresT1000,
      cumpleBimestres: bimestres >= I.bimestresT1000, faltanBimestres: Math.max(0, I.bimestresT1000 - bimestres),
      subcuentaAnual: ap.anual, subcuentaAcumulada: ap.acumulado, anios: ap.anios,
      recortado: m.recortado || ap.recortado
    };
  }

  // ---------- Crédito FOVISSSTE ----------

  // Capacidad estimada de un crédito Mi FOVISSSTE en pesos: el pago es el 30% del sueldo básico mensual y, con la
  // tasa y el plazo, sale cuánto crédito cubre ese pago (valor presente): crédito = pago x (1 - (1 + i)^-n) / i.
  // Se recorta al monto máximo en pesos ($1,405,090) y se suma el saldo de la Subcuenta de Vivienda.
  // Estimado: el FOVISSSTE también mira tu edad y el avalúo, y sus seguros pueden cambiar el pago.
  function capacidadFovissste({ sueldoBasico, tasaAnual, plazo, saldoSubcuenta = 0 }) {
    const F = DATOS.fovissste, M = DATOS.maximos;
    const s = rango(num(sueldoBasico), 0, M.renta);
    const t = rango(num(tasaAnual), 0, M.tasa);
    const p = rango(Math.floor(num(plazo)), 0, F.plazoMax);
    const sal = rango(num(saldoSubcuenta), 0, M.monto);
    const recortado = [s, t, p, sal].some(x => x.recortado);
    const pago = s.valor * F.descuento / 100;
    const n = p.valor * 12;
    const i = t.valor / 100 / 12;
    let porPago = 0;
    if (pago > 0 && n > 0) porPago = i > 0 ? pago * (1 - Math.pow(1 + i, -n)) / i : pago * n;
    const credito = Math.min(porPago, F.maximoPesos);
    const topado = porPago > F.maximoPesos;
    // Si el crédito quedó en el tope, el pago para ese crédito es menor que el 30%.
    const pagoReal = topado ? pagoMensual(credito, t.valor, n) : pago;
    const totalPagado = pagoReal * n;
    return {
      sueldo: s.valor, tasa: t.valor, plazo: p.valor, saldo: sal.valor, recortado, sinDatos: !(pago > 0 && n > 0),
      pago, pagoReal, porPago, credito, topado, total: credito + sal.valor,
      totalPagado, intereses: Math.max(0, totalPagado - credito),
      maximoPesos: F.maximoPesos, maximoUmaPesos: F.maximoUma * Calc.DATOS.umaMensual
    };
  }

  const api = { DATOS, num, rango, pagoMensual, hipotecaBancaria, rentarOComprar, predial, aportacionInfonavit,
    revisionPuntosInfonavit, capacidadFovissste };
  if (enNode) module.exports = api;
  else raiz.Vivienda = api;
})(this);
