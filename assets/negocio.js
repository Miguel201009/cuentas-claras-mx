// Cálculos de la sección Negocio propio de Cuentas Claras MX: precio de venta con margen, IVA y comisión
// de terminal, punto de equilibrio, cuotas del IMSS que paga el patrón y el total de tu primera factura. Funciones puras, sin datos personales:
// todo se calcula en el navegador.
// En el navegador carga antes ../../assets/calc.js (de ahí salen el salario mínimo, el redondeo y mxn()). La página de
// cuotas IMSS del patrón carga además ../../assets/retiro.js (retiro y cesantía) y ../../assets/vivienda.js (Infonavit);
// la de facturar por primera vez, ../../assets/impuestos.js (retenciones de ISR e IVA).
(function (raiz) {
  const Calc = typeof module !== "undefined" && module.exports ? require("./calc.js") : raiz.Calc;
  const r2 = Calc.redondear;

  const DATOS = {
    anio: 2026,

    // Tasas de IVA que puede usar un negocio. Revisado en octubre de 2026.
    // general: 16%, art. 1 de la Ley del IVA (sin cambios desde 2010).
    // frontera: 8% efectivo. Decreto de estímulos fiscales región fronteriza norte (DOF 31 dic 2018) y región
    //   fronteriza sur (DOF 30 dic 2020): crédito de 50% de la tasa del IVA, solo para quien está inscrito en el
    //   padrón del SAT y vende o da el servicio en esa región. Prorrogados hasta el 31 dic 2026 por el decreto
    //   publicado en el DOF del 31 dic 2025 (edición vespertina). Confirmado en fuentes secundarias serias que
    //   citan esa nota del DOF; el portal del DOF no abrió desde nuestra red: pendiente cotejar el texto oficial.
    //   Revisar en enero de 2027 si hay nueva prórroga.
    // cero: 0%, art. 2-A de la Ley del IVA (por ejemplo, alimentos sin preparar y medicinas de patente). Los
    //   alimentos preparados pagan 16% aunque sean para llevar o a domicilio (art. 2-A, fr. I, último párrafo).
    // exento: no se cobra IVA (art. 9, 15 y 20 de la Ley del IVA), pero tampoco se recupera el IVA que pagas.
    iva: { general: 0.16, frontera: 0.08, cero: 0, exento: 0 },

    // Las terminales y ligas de pago cobran su comisión más IVA a la tasa general (art. 1 LIVA).
    // Si tu negocio está exento, ese IVA no lo recuperas y se vuelve costo.
    ivaComision: 0.16,

    // Cuotas del IMSS que paga el patrón (Ley del Seguro Social), en % del salario base de cotización (SBC) salvo la
    // cuota fija, que es % de la UMA diaria por cada trabajador. Revisado el 6 nov 2026 con IDC ("Factores de las cuotas
    // y aportaciones 2026", 9 feb 2026) y Praxium (10 sep 2026), que coinciden; El Contribuyente da las mismas tasas.
    // Las cuotas del trabajador salen de Calc.DATOS.imss; retiro (2%) y cesantía y vejez del patrón (3.150% a 7.513% en
    // 2026), de retiro.js; Infonavit (5%), de vivienda.js. No se repiten aquí.
    imssPatron: {
      cuotaFijaUma: 20.40, // enfermedades y maternidad, prestaciones en especie, art. 106 fr. I LSS
      excedente: 1.10, // enfermedades y maternidad, sobre lo que pasa de 3 UMA, art. 106 fr. II
      dinero: 0.70, // enfermedades y maternidad, prestaciones en dinero, art. 107
      pensionados: 1.05, // gastos médicos de pensionados, art. 25
      invalidez: 1.75, // invalidez y vida, art. 147
      guarderias: 1.00 // guarderías y prestaciones sociales, art. 211
    },
    // Riesgos de trabajo: la empresa que se inscribe por primera vez paga la prima media de su clase (art. 73 LSS; tabla
    // leída en mLey y SDV). Después la prima se ajusta cada año según los accidentes de la empresa (art. 74).
    primasRiesgo: [
      { clase: "I", prima: 0.54355, ejemplo: "comercio, oficinas y servicios" },
      { clase: "II", prima: 1.13065, ejemplo: "algunas manufacturas ligeras" },
      { clase: "III", prima: 2.59840, ejemplo: "industria y talleres" },
      { clase: "IV", prima: 4.65325, ejemplo: "transporte de carga y trabajos pesados" },
      { clase: "V", prima: 7.58875, ejemplo: "construcción y minería" }
    ],

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: { monto: 1e9, margen: 99, comision: 50, unidades: 1e8, dias: 31, prima: 15, isn: 10 }
  };

  // Número válido, finito y positivo; vacío, texto, negativo o infinito cuenta como 0.
  function num(x) {
    const n = typeof x === "number" ? x : parseFloat(x);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Igual que num(), sin pasar de un máximo. Devuelve también si se recortó.
  function acotar(x, max) {
    const n = num(x);
    return n > max ? { valor: max, acotado: true } : { valor: n, acotado: false };
  }

  function tasaIva(clave) {
    return Object.prototype.hasOwnProperty.call(DATOS.iva, clave) ? clave : "general";
  }

  // Parte del cobro total (con IVA) que se queda la terminal y que es costo para ti.
  // Si cobras IVA (16%, 8% o 0%), el IVA de la comisión lo recuperas al declarar (acreditamiento): el costo es
  // solo la comisión. Si estás exento, el IVA de la comisión también es costo.
  function comisionEfectiva(comisionPct, clave) {
    const k = comisionPct / 100;
    return clave === "exento" ? k * (1 + DATOS.ivaComision) : k;
  }

  // Margen (ganancia / precio sin IVA) a markup (ganancia / costo). Ambos en porcentaje.
  function margenAMarkup(margenPct) {
    const m = Math.min(num(margenPct), DATOS.maximos.margen);
    return r2(m / (100 - m) * 100);
  }

  // Markup (ganancia / costo) a margen (ganancia / precio sin IVA). Ambos en porcentaje.
  function markupAMargen(markupPct) {
    const u = Math.min(num(markupPct), 1e6);
    return r2(u / (100 + u) * 100);
  }

  // Revisa un precio que ya tienes (con IVA incluido): cuánto es IVA, cuánto se lleva la terminal y cuánto ganas.
  function analizarPrecio({ precioFinal, costo, iva = "general", comision = 0 }) {
    const clave = tasaIva(iva);
    const t = DATOS.iva[clave];
    const total = acotar(precioFinal, DATOS.maximos.monto).valor;
    const c = acotar(costo, DATOS.maximos.monto).valor;
    const com = acotar(comision, DATOS.maximos.comision).valor;
    const sinIva = total / (1 + t);
    const comisionMonto = comisionEfectiva(com, clave) * total;
    const ganancia = sinIva - c - comisionMonto;
    return {
      precioFinal: r2(total), sinIva: r2(sinIva), iva: r2(total - sinIva), comision: r2(comisionMonto),
      costo: r2(c), ganancia: r2(ganancia), pierdes: ganancia < -0.004,
      margen: sinIva > 0 ? r2(ganancia / sinIva * 100) : 0
    };
  }

  // Precio de venta para lograr un margen sobre el precio sin IVA, con la comisión de la terminal incluida.
  // Precio sin IVA = costo / (1 - margen - comisión efectiva x (1 + IVA)), porque la terminal cobra sobre el
  // total que paga el cliente (con IVA). Si el denominador no es positivo, no hay precio que alcance.
  function precioVenta({ costo, margen, iva = "general", comision = 0 }) {
    const clave = tasaIva(iva);
    const t = DATOS.iva[clave];
    const C = acotar(costo, DATOS.maximos.monto);
    const M = acotar(margen, DATOS.maximos.margen);
    const K = acotar(comision, DATOS.maximos.comision);
    const c = C.valor, m = M.valor / 100;
    const kEf = comisionEfectiva(K.valor, clave);
    const denominador = 1 - m - kEf * (1 + t);
    const base = {
      costo: r2(c), margen: M.valor, comisionPct: K.valor, ivaClave: clave, tasaIva: t,
      comisionEfectivaPct: Math.round(kEf * 100 * 1e4) / 1e4,
      acotado: { costo: C.acotado, margen: M.acotado, comision: K.acotado }
    };
    if (denominador <= 0.0001) {
      return Object.assign(base, {
        posible: false, sinIva: 0, iva: 0, precioFinal: 0, comision: 0, ganancia: 0, markup: 0,
        sinTerminal: 0, redondeado: 0, margenRedondeado: 0, gananciaRedondeado: 0
      });
    }
    const sinIva = c / denominador;
    const total = sinIva * (1 + t);
    const comisionMonto = kEf * total;
    const ganancia = m * sinIva;
    // Markup sobre el costo total de cada venta (producto + comisión): equivale a margen / (1 - margen).
    const costoTotal = c + comisionMonto;
    const sinTerminal = m < 1 ? c / (1 - m) * (1 + t) : 0;
    const redondeado = c > 0 ? Math.ceil(r2(total) - 1e-9) : 0;
    // Lo que ganas si cobras el precio redondeado. Se calcula aquí, sin recortar: el precio con IVA puede pasar
    // del máximo de captura (por ejemplo, costo de mil millones con 35% de margen) y analizarPrecio() lo recortaría.
    const sinIvaR = redondeado / (1 + t);
    const ganR = sinIvaR - c - kEf * redondeado;
    return Object.assign(base, {
      posible: true, sinIva: r2(sinIva), iva: r2(total - sinIva), precioFinal: r2(total),
      comision: r2(comisionMonto), ganancia: r2(ganancia),
      markup: costoTotal > 0 ? r2(ganancia / costoTotal * 100) : 0,
      sinTerminal: r2(sinTerminal), redondeado,
      margenRedondeado: sinIvaR > 0 ? r2(ganR / sinIvaR * 100) : 0, gananciaRedondeado: r2(ganR)
    });
  }

  // Punto de equilibrio: cuántas unidades (y cuántos pesos) tienes que vender al mes para no perder ni ganar.
  // Unidades = gastos fijos / (precio - costo variable). Pesos = unidades x precio. Todo sin IVA.
  // gastosFijos puede ser un número o una lista (renta, sueldos, servicios, otros).
  // ventasActuales se redondea a unidades enteras (no se vende media pieza), para que la etiqueta y el cálculo
  // usen el mismo número.
  // Margen de seguridad = (ventas - equilibrio) / ventas. Si vendes menos que el equilibrio sale negativo y sin
  // sentido para el usuario: se marca debajoDelEquilibrio (la página lo dice con palabras) y la cifra se topa en -100.
  function puntoEquilibrio({ gastosFijos, precio, costoVariable, dias = 0, gananciaDeseada = 0, ventasActuales = 0 }) {
    const lista = Array.isArray(gastosFijos) ? gastosFijos : [gastosFijos];
    const mx = DATOS.maximos;
    const partes = lista.map(g => acotar(g, mx.monto));
    const P = acotar(precio, mx.monto), V = acotar(costoVariable, mx.monto);
    const D = acotar(dias, mx.dias), G = acotar(gananciaDeseada, mx.monto), U = acotar(ventasActuales, mx.unidades);
    const gf = partes.reduce((s, x) => s + x.valor, 0);
    const p = P.valor, v = V.valor, d = Math.floor(D.valor), meta = G.valor, ventas = Math.round(U.valor);
    const acotado = partes.some(x => x.acotado) || [P, V, D, G, U].some(x => x.acotado);
    const contribucion = p - v;
    const base = {
      gastosFijos: r2(gf), precio: r2(p), costoVariable: r2(v), dias: d, gananciaDeseada: r2(meta), ventasActuales: ventas,
      contribucion: r2(contribucion), razonContribucion: p > 0 ? r2(Math.max(0, contribucion) / p * 100) : 0, acotado
    };
    if (p === 0 || contribucion <= 0) {
      return Object.assign(base, {
        alcanzable: false, sinPrecio: p === 0, unidades: 0, unidadesRedondeadas: 0, pesos: 0, porDia: 0, porDiaRedondeado: 0,
        unidadesMeta: 0, unidadesMetaRedondeadas: 0, pesosMeta: 0,
        resultadoActual: r2(ventas * contribucion - gf), margenSeguridad: 0, debajoDelEquilibrio: false
      });
    }
    const unidades = gf / contribucion;
    const unidadesMeta = (gf + meta) / contribucion;
    const arriba = x => Math.ceil(x - 1e-9);
    return Object.assign(base, {
      alcanzable: true, sinPrecio: false,
      unidades: Math.round(unidades * 100) / 100, unidadesRedondeadas: arriba(unidades), pesos: r2(unidades * p),
      porDia: d > 0 ? Math.round(unidades / d * 100) / 100 : 0, porDiaRedondeado: d > 0 ? arriba(unidades / d) : 0,
      unidadesMeta: Math.round(unidadesMeta * 100) / 100, unidadesMetaRedondeadas: arriba(unidadesMeta), pesosMeta: r2(unidadesMeta * p),
      resultadoActual: r2(ventas * contribucion - gf),
      margenSeguridad: ventas > 0 ? r2(Math.max(-100, (ventas - unidades) / ventas * 100)) : 0,
      debajoDelEquilibrio: ventas > 0 && ventas * contribucion - gf < -1e-9
    });
  }

  // Salario mínimo diario vigente (de calc.js), para recordar que el sueldo de quien contratas no puede ser menor.
  function salarioMinimo() {
    return { anio: Calc.DATOS.anio, general: Calc.DATOS.salarioMinimo.general, frontera: Calc.DATOS.salarioMinimo.frontera };
  }

  // ---------- Cuotas del IMSS que paga el patrón (negocio/cuotas-imss-patron) ----------
  // Retiro y vivienda vienen de sus archivos de tema. En Node se leen con require; en el navegador, de window.
  function temas() {
    const enNode = typeof module !== "undefined" && module.exports;
    return { Retiro: enNode ? require("./retiro.js") : raiz.Retiro, Vivienda: enNode ? require("./vivienda.js") : raiz.Vivienda };
  }

  // Costo mensual de dar de alta a un trabajador con sueldo fijo. SBC = sueldo / 30 x factor de integración mínimo de
  // ley (1.0493: 15 días de aguinaldo y 12 de vacaciones con 25% de prima), entre el salario mínimo de la zona y
  // 25 UMA (art. 28 LSS). Cada cuota se pasa a mes con los días indicados (30.4 en promedio; el IMSS cobra los días
  // de cada mes). prima: prima de riesgo de trabajo en %. isn: impuesto sobre nómina del estado en %, sobre el sueldo.
  // Si el trabajador gana solo el salario mínimo (sueldo / 30 no pasa del mínimo de su zona), el patrón paga también
  // la parte del trabajador (art. 36 LSS), con el mismo criterio que Calc.sueldoNeto().
  function costoImssPatron({ sueldoMensual, zona = "general", prima = DATOS.primasRiesgo[0].prima, isn = 0, dias = Calc.DATOS.diasMes } = {}) {
    const { Retiro, Vivienda } = temas();
    const D = Calc.DATOS, P = DATOS.imssPatron, M = DATOS.maximos;
    const s = acotar(sueldoMensual, M.monto);
    const pr = acotar(prima, M.prima);
    const im = acotar(isn, M.isn);
    const z = zona === "frontera" ? "frontera" : "general";
    const sueldo = s.valor;
    const sd = sueldo / 30;
    const minimo = Calc.salarioMinimoZona(z);
    const tope = D.imss.topeUma * D.uma;
    const integrado = sd * D.factorIntegracion;
    const sbc = sueldo ? Math.min(Math.max(integrado, minimo), tope) : 0;
    const excedente = Math.max(0, sbc - D.imss.excedenteUma * D.uma);
    const mes = (base, tasa) => sueldo ? r2(base * tasa / 100 * dias) : 0;
    const tasaCeav = sbc ? Retiro.tasaCeavPatron(sbc) : 0;
    const imss = [
      { clave: "fija", nombre: "Enfermedades y maternidad: cuota fija", tasa: P.cuotaFijaUma, monto: mes(D.uma, P.cuotaFijaUma), ley: "Art. 106 fr. I LSS" },
      { clave: "excedente", nombre: "Enfermedades y maternidad: excedente de 3 UMA", tasa: P.excedente, monto: mes(excedente, P.excedente), ley: "Art. 106 fr. II LSS" },
      { clave: "dinero", nombre: "Enfermedades y maternidad: prestaciones en dinero", tasa: P.dinero, monto: mes(sbc, P.dinero), ley: "Art. 107 LSS" },
      { clave: "pensionados", nombre: "Gastos médicos de pensionados", tasa: P.pensionados, monto: mes(sbc, P.pensionados), ley: "Art. 25 LSS" },
      { clave: "invalidez", nombre: "Invalidez y vida", tasa: P.invalidez, monto: mes(sbc, P.invalidez), ley: "Art. 147 LSS" },
      { clave: "guarderias", nombre: "Guarderías y prestaciones sociales", tasa: P.guarderias, monto: mes(sbc, P.guarderias), ley: "Art. 211 LSS" },
      { clave: "riesgo", nombre: "Riesgos de trabajo", tasa: pr.valor, monto: mes(sbc, pr.valor), ley: "Arts. 71 a 74 LSS" }
    ];
    const rcv = [
      { clave: "retiro", nombre: "Retiro", tasa: Retiro.DATOS.retiroPatron, monto: mes(sbc, Retiro.DATOS.retiroPatron), ley: "Art. 168 fr. I LSS" },
      { clave: "ceav", nombre: "Cesantía en edad avanzada y vejez", tasa: tasaCeav, monto: mes(sbc, tasaCeav), ley: "Art. 168 fr. II LSS" }
    ];
    const tasaInfonavit = Vivienda.DATOS.infonavit.aportacion * 100;
    const infonavit = mes(sbc, tasaInfonavit);
    const totalImss = r2(imss.reduce((t, x) => t + x.monto, 0));
    const totalRcv = r2(rcv.reduce((t, x) => t + x.monto, 0));
    const obrero = sueldo ? Calc.cuotasImssObrero(sbc, z, dias).mensual : 0;
    const pagaParteTrabajador = sueldo > 0 && sd <= minimo;
    const parteTrabajador = pagaParteTrabajador ? obrero : 0;
    const impuestoNomina = r2(sueldo * im.valor / 100);
    const seguridadSocial = r2(totalImss + totalRcv + infonavit + parteTrabajador);
    // Aguinaldo (15 días, art. 87 LFT) y prima vacacional (25% de 12 días el primer año, arts. 76 y 80 LFT) que conviene
    // apartar cada mes. No son cuotas del IMSS, pero sí parte del costo de un trabajador.
    const diasVac = Calc.diasVacaciones(1);
    const prestaciones = r2(sd * (15 + diasVac * 0.25) / 12);
    const cargas = r2(seguridadSocial + impuestoNomina);
    const costoTotal = r2(sueldo + cargas + prestaciones);
    return {
      sueldo, acotado: s.acotado || pr.acotado || im.acotado, zona: z, sd, minimo, sbc, conPiso: sueldo > 0 && integrado < minimo,
      topado: integrado > tope, vecesUma: sbc / D.uma, dias, prima: pr.valor, isn: im.valor,
      imss, totalImss, rcv, totalRcv, tasaCeav, tasaInfonavit, infonavit, obrero, pagaParteTrabajador, parteTrabajador,
      seguridadSocial, impuestoNomina, cargas, prestaciones, costoTotal,
      porcentajeCargas: sueldo ? r2(cargas / sueldo * 100) : 0,
      descuentoTrabajador: pagaParteTrabajador ? 0 : obrero,
      bimestralRcvInfonavit: r2((totalRcv + infonavit) * 2)
    };
  }

  // ---------- Tu primera factura (negocio/facturar-por-primera-vez) ----------
  // Cuánto dice tu factura y cuánto te depositan, según tu régimen, lo que facturas y a quién.
  // No repite tasas: el IVA sale de DATOS.iva; las retenciones, de impuestos.js (en el navegador, window.Impuestos):
  //   RESICO: la persona moral te retiene 1.25% de ISR sobre el subtotal (art. 113-J LISR; Impuestos.DATOS.resico).
  //   Servicios profesionales (honorarios) en el régimen general: 10% de ISR (art. 106 LISR; Impuestos.HONORARIOS).
  //   Ventas de productos en el régimen general: sin retención de ISR.
  //   IVA: la persona moral te retiene dos terceras partes del IVA de servicios profesionales (art. 1-A fr. II
  //   inciso a) LIVA y art. 3 fr. I de su Reglamento; Impuestos.HONORARIOS). En venta de productos no hay retención.
  // Rentas, fletes y comisiones tienen reglas propias y no se calculan aquí.
  // A una persona física o al público en general no se le hacen retenciones. Solo tasas 16%, 0% y exento: con el 8% de la
  // región fronteriza la retención de IVA tiene reglas propias y no la calculamos.
  const FACTURA = { actividades: ["servicios", "ventas"], regimenes: ["resico", "general"], iva: ["general", "cero", "exento"], maximo: 1e10 };

  function impuestos() {
    const enNode = typeof module !== "undefined" && module.exports;
    return enNode ? require("./impuestos.js") : raiz.Impuestos;
  }

  function factura({ subtotal, regimen = "resico", actividad = "servicios", iva = "general", clienteEmpresa = true } = {}) {
    const I = impuestos();
    const { valor: base, acotado } = acotar(subtotal, FACTURA.maximo);
    const sub = r2(base);
    regimen = FACTURA.regimenes.includes(regimen) ? regimen : "resico";
    actividad = FACTURA.actividades.includes(actividad) ? actividad : "servicios";
    const claveIva = FACTURA.iva.includes(iva) ? iva : "general";
    const empresa = !!clienteEmpresa;
    const tasaTraslado = DATOS.iva[claveIva];
    const ivaTrasladado = r2(sub * tasaTraslado);

    let tasaIsr = 0;
    if (empresa) {
      if (regimen === "resico") tasaIsr = I.DATOS.resico.retencionMorales;
      else if (actividad !== "ventas") tasaIsr = I.HONORARIOS.retencionIsr;
    }
    const isrRetenido = r2(sub * tasaIsr / 100);
    const retieneIva = empresa && actividad !== "ventas" && ivaTrasladado > 0;
    const ivaRetenido = retieneIva ? r2(ivaTrasladado * I.HONORARIOS.retencionIva) : 0;
    const total = r2(sub + ivaTrasladado);
    const deposito = r2(total - isrRetenido - ivaRetenido);
    return {
      subtotal: sub, acotado, regimen, actividad, iva: claveIva, clienteEmpresa: empresa,
      tasaIva: r2(tasaTraslado * 100), ivaTrasladado, tasaIsr, isrRetenido, retieneIva, ivaRetenido,
      total, deposito, conRetenciones: isrRetenido + ivaRetenido > 0
    };
  }

  const api = { DATOS, num, acotar, comisionEfectiva, margenAMarkup, markupAMargen, analizarPrecio, precioVenta, puntoEquilibrio, salarioMinimo, costoImssPatron, FACTURA, factura };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Negocio = api;
})(this);
