// Cálculos de impuestos de Cuentas Claras MX: RESICO de personas físicas y declaración anual.
// Funciones puras, sin datos personales: todo se calcula en el navegador de la persona.
// En el navegador carga antes ../../assets/calc.js (de ahí salen la UMA y el redondeo).
(function (raiz) {
  const Calc = typeof module !== "undefined" && module.exports ? require("./calc.js") : raiz.Calc;
  const r2 = Calc.redondear;

  // Lo más que aceptamos en un campo. Evita Infinity y resultados sin sentido con números gigantes.
  const MAXIMO = 1e12;

  const DATOS = {
    anio: 2026,

    // RESICO de personas físicas (Ley del ISR, Título IV, Capítulo II, Sección IV).
    resico: {
      // Art. 113-E LISR: tasa sobre el TOTAL de ingresos cobrados en el mes, sin IVA y sin deducciones.
      // [límite superior del mes, tasa %]. Texto sin cambios desde 2022 y vigente en octubre de 2026.
      // Cifras confirmadas en extractos del SAT y gob.mx y en varias fuentes secundarias; pendiente cotejar
      // contra el PDF de la Ley del ISR (diputados.gob.mx bloqueado desde nuestra red).
      mensual: [[25000, 1.00], [50000, 1.10], [83333.33, 1.50], [208333.33, 2.00], [3500000, 2.50]],
      // Art. 113-F LISR: tabla anual (misma lógica, con montos del año).
      anual: [[300000, 1.00], [600000, 1.10], [1000000, 1.50], [2500000, 2.00], [3500000, 2.50]],
      // Art. 113-E LISR: tope de ingresos del año, vigente en octubre de 2026. En octubre de 2026 la prensa
      // informó de una reforma para subirlo a 5 millones desde 2027; no la pudimos confirmar con una fuente
      // oficial (DOF ni Gaceta Parlamentaria). Mientras no se publique en el DOF, el tope es 3.5 millones.
      topeAnual: 3500000,
      // Art. 113-E LISR: quien se dedica SOLO a actividades agrícolas, ganaderas, silvícolas o pesqueras no paga
      // ISR por lo que cobre en el año hasta 900,000 pesos; paga solo por lo que pase de esa cantidad.
      // Texto vigente desde 2022; pendiente cotejar contra el PDF de la Ley del ISR (red bloqueada).
      exencionCampo: 900000,
      // Art. 113-J LISR: retención de las personas morales que te pagan servicios o renta (sobre el monto sin IVA).
      retencionMorales: 1.25
    },

    // Tarifa ANUAL del art. 152 LISR para el ejercicio 2026 (declaración que se presenta en abril de 2027).
    // Anexo 8 de la RMF 2026, DOF 28 dic 2025 (factor de actualización 1.1321 sobre la tarifa 2023-2025).
    // [límite inferior, límite superior, cuota fija, % sobre el excedente]. Tomada de cuatro transcripciones
    // que coinciden entre sí; pendiente cotejar contra el PDF del SAT (red bloqueada en octubre de 2026).
    // Ojo: la cuota fija del renglón 3 (5,051.37) queda 1.3 centavos arriba de la continuidad con el renglón 2
    // (5,051.36) y la del renglón 10, 1.4 centavos abajo. La tarifa oficial 2023 tenía brechas iguales
    // (renglón 3: 4,461.94 contra 4,461.93), así que puede ser redondeo del SAT; confirmarlo con el Anexo 8.
    tarifaAnual: [
      [0.01, 10135.11, 0, 1.92],
      [10135.12, 86022.11, 194.59, 6.40],
      [86022.12, 151176.19, 5051.37, 10.88],
      [151176.20, 175735.66, 12140.13, 16.00],
      [175735.67, 210403.69, 16069.64, 17.92],
      [210403.70, 424353.97, 22282.14, 21.36],
      [424353.98, 668840.14, 67981.92, 23.52],
      [668840.15, 1276925.98, 125485.07, 30.00],
      [1276925.99, 1702567.97, 307910.81, 32.00],
      [1702567.98, 5107703.92, 444116.23, 34.00],
      [5107703.93, Infinity, 1601862.46, 35.00]
    ],

    // Art. 151 LISR, último párrafo: las deducciones personales no pueden pasar de lo que sea menor entre
    // 5 UMA anuales y el 15% de tus ingresos totales (incluidos los exentos). No entran a este tope:
    // colegiaturas (decreto DOF 26 dic 2013), donativos, aportaciones complementarias de retiro (fr. V)
    // y gastos por discapacidad o incapacidad.
    deducciones: { topeUma: 5, topePorcentaje: 15 },

    // Colegiaturas: límite anual por alumno. Decreto que compila beneficios fiscales, DOF 26 dic 2013,
    // art. 1.8; montos repetidos en la página de deducciones personales del SAT. Vigente en 2026.
    colegiaturas: [
      { clave: "preescolar", nivel: "Preescolar", limite: 14200 },
      { clave: "primaria", nivel: "Primaria", limite: 12900 },
      { clave: "secundaria", nivel: "Secundaria", limite: 19900 },
      { clave: "tecnico", nivel: "Profesional técnico", limite: 17100 },
      { clave: "bachillerato", nivel: "Bachillerato o equivalente", limite: 24500 }
    ],
    // Lo más que aceptamos de alumnos en el campo de colegiaturas (evita topes absurdos).
    maxAlumnos: 20,

    // Devolución del saldo a favor de la declaración del año 2025 (presentada en 2026), según el SAT:
    // automática hasta 150,000 pesos; con e.firma si el saldo es de más de 10,000 pesos. Se revisa cada año
    // en la Resolución Miscelánea Fiscal; para la declaración de 2026 (abril de 2027) falta la RMF 2027.
    devolucion: { efirmaMasDe: 10000, automaticaHasta: 150000 }
  };

  // UMA anual 2026 = UMA mensual x 12 = 42,794.64 (INEGI, DOF 9 ene 2026, vigente desde el 1 feb 2026).
  const umaAnual = r2(Calc.DATOS.umaMensual * 12);

  // Convierte lo que escribe la persona en un número usable: vacío, texto o negativo = 0; enorme = MAXIMO.
  function limpiar(valor) {
    const n = typeof valor === "number" ? valor : parseFloat(valor);
    if (isNaN(n) || n <= 0) return 0;
    return Math.min(n, MAXIMO);
  }

  // Busca el renglón de una tabla RESICO ([límite superior, tasa]). La tasa se aplica a TODO el ingreso.
  function tasaResico(tabla, ingresos) {
    const i = tabla.findIndex(([sup]) => ingresos <= sup);
    if (i === -1) return null;
    return {
      renglon: i + 1,
      limiteInferior: i > 0 ? r2(tabla[i - 1][0] + 0.01) : 0.01,
      limiteSuperior: tabla[i][0],
      tasa: tabla[i][1],
      siguiente: i + 1 < tabla.length ? { desde: r2(tabla[i][0] + 0.01), tasa: tabla[i + 1][1] } : null
    };
  }

  // Pago mensual de ISR en RESICO (art. 113-E): ingresos cobrados del mes x tasa, menos lo que te
  // retuvieron las personas morales (1.25%, art. 113-J). Si la retención es mayor, queda saldo a favor.
  // soloCampo: la persona se dedica solo al campo, la ganadería, la silvicultura o la pesca. Mientras lo
  // cobrado en el año (cobradoAntes + este mes) no pase de 900,000, su ISR es 0. Si pasa, solo paga por el
  // excedente; ese cálculo no lo hacemos (calculado = false) porque depende de cómo lo aplique el SAT mes a mes.
  function resicoMensual({ ingresos, cobradoAEmpresas = 0, soloCampo = false, cobradoAntes = 0 }) {
    const ing = r2(limpiar(ingresos));
    const capturadoEmpresas = r2(limpiar(cobradoAEmpresas));
    const empresas = Math.min(ing, capturadoEmpresas);
    const t = tasaResico(DATOS.resico.mensual, ing);
    const fueraDeRegimen = t === null;
    const campo = soloCampo === true;
    const antes = campo ? r2(limpiar(cobradoAntes)) : 0;
    const acumuladoAnio = campo ? r2(antes + ing) : 0;
    const exentoCampo = campo && !fueraDeRegimen && acumuladoAnio <= DATOS.resico.exencionCampo;
    const campoPasaExencion = campo && !fueraDeRegimen && ing > 0 && !exentoCampo;
    const calculado = !fueraDeRegimen && !campoPasaExencion;
    const isr = !calculado || exentoCampo || ing === 0 ? 0 : r2(ing * t.tasa / 100);
    const retencion = r2(empresas * DATOS.resico.retencionMorales / 100);
    const diferencia = calculado ? r2(isr - retencion) : 0;
    const siguiente = t && t.siguiente && !campo
      ? Object.assign({}, t.siguiente, { isr: r2(t.siguiente.desde * t.siguiente.tasa / 100) })
      : null;
    return {
      ingresos: ing, cobradoAEmpresas: empresas, empresasAjustado: capturadoEmpresas > ing,
      fueraDeRegimen, renglon: t ? t.renglon : 0, limiteInferior: t ? t.limiteInferior : 0,
      limiteSuperior: t ? t.limiteSuperior : 0, tasa: t ? t.tasa : 0, siguiente,
      soloCampo: campo, cobradoAntes: antes, acumuladoAnio, exentoCampo, campoPasaExencion, calculado,
      exentoRestante: exentoCampo ? r2(DATOS.resico.exencionCampo - acumuladoAnio) : 0,
      isr, retencion, aPagar: Math.max(0, diferencia), saldoFavor: Math.max(0, -diferencia),
      anualSiSeRepite: r2(ing * 12), pasaTopeAnual: ing * 12 > DATOS.resico.topeAnual,
      acumuladoPasaTope: campo && acumuladoAnio > DATOS.resico.topeAnual
    };
  }

  // Cálculo anual de RESICO (art. 113-F): ingresos del año x tasa de la tabla anual.
  function resicoAnual(ingresosAnuales) {
    const ing = r2(limpiar(ingresosAnuales));
    const t = tasaResico(DATOS.resico.anual, ing);
    return {
      ingresos: ing, fueraDeRegimen: t === null, renglon: t ? t.renglon : 0, tasa: t ? t.tasa : 0,
      isr: t && ing > 0 ? r2(ing * t.tasa / 100) : 0
    };
  }

  // ISR del año con la tarifa del art. 152 LISR: (base - límite inferior) x % + cuota fija.
  function isrAnual(baseGravable) {
    const base = r2(limpiar(baseGravable));
    const tabla = DATOS.tarifaAnual;
    if (base < tabla[0][0]) {
      return { base, renglon: 0, limiteInferior: 0, limiteSuperior: 0, cuotaFija: 0, porcentaje: 0, excedente: 0, marginal: 0, isr: 0 };
    }
    let i = tabla.length - 1;
    while (i > 0 && base < tabla[i][0]) i--;
    const [limiteInferior, limiteSuperior, cuotaFija, porcentaje] = tabla[i];
    const excedente = r2(base - limiteInferior);
    const marginal = excedente * porcentaje / 100;
    return { base, renglon: i + 1, limiteInferior, limiteSuperior, cuotaFija, porcentaje, excedente, marginal, isr: r2(marginal + cuotaFija) };
  }

  // Tope general de deducciones personales (art. 151 LISR).
  function topeDeducciones(ingresosTotales) {
    const total = r2(limpiar(ingresosTotales));
    const porUma = r2(DATOS.deducciones.topeUma * umaAnual);
    const porIngresos = r2(total * DATOS.deducciones.topePorcentaje / 100);
    return { total, porUma, porIngresos, tope: Math.min(porUma, porIngresos), limitaUma: porUma < porIngresos };
  }

  // Colegiaturas que sí se deducen: lo pagado, sin pasar del límite del nivel por el número de alumnos.
  // nivel = clave de DATOS.colegiaturas, o "varios" (hijos en niveles distintos: usamos el límite más alto,
  // 24,500 por alumno, y la página pide revisar el de cada uno). Clave desconocida = primaria (el más bajo).
  function colegiaturasDeducibles({ pagado = 0, nivel = "primaria", alumnos = 1 } = {}) {
    const monto = r2(limpiar(pagado));
    const lista = DATOS.colegiaturas;
    const varios = nivel === "varios";
    const fila = varios ? null : lista.find(c => c.clave === nivel) || lista.find(c => c.clave === "primaria");
    const limitePorAlumno = varios ? Math.max(...lista.map(c => c.limite)) : fila.limite;
    const n = Math.min(DATOS.maxAlumnos, Math.max(1, Math.floor(limpiar(alumnos))));
    const limite = r2(limitePorAlumno * n);
    const deducible = Math.min(monto, limite);
    return {
      pagado: monto, nivel: varios ? "varios" : fila.clave, nombreNivel: varios ? "Varios niveles" : fila.nivel,
      limitePorAlumno, alumnos: n, limite, deducible, recortado: r2(monto - deducible), varios
    };
  }

  // Lo que pide el SAT para devolver un saldo a favor (reglas de la declaración del año 2025).
  function devolucion(saldoFavor) {
    const saldo = r2(limpiar(saldoFavor));
    const d = DATOS.devolucion;
    return { saldo, necesitaEfirma: saldo > d.efirmaMasDe, automatica: saldo > 0 && saldo <= d.automaticaHasta };
  }

  // Estimación de la declaración anual de una persona física con sueldos u otros ingresos del Título IV.
  // ISR del año = tarifa anual sobre (ingresos gravados - deducciones personales con tope - colegiaturas).
  // El subsidio para el empleo que te aplicaron en el año reduce ese ISR, pero nunca genera saldo a favor
  // (decreto DOF 1 may 2024). Luego se compara con lo que ya te retuvieron o pagaste.
  // colegiaturas = lo pagado en el año; se topa con el límite de nivelColegiatura x alumnos.
  function declaracionAnual({ ingresosGravados, ingresosExentos = 0, isrPagado = 0, subsidio = 0, deducciones = 0, colegiaturas = 0, nivelColegiatura = "primaria", alumnos = 1 }) {
    const grav = r2(limpiar(ingresosGravados));
    const exe = r2(limpiar(ingresosExentos));
    const pagado = r2(limpiar(isrPagado));
    const sub = r2(limpiar(subsidio));
    const ded = r2(limpiar(deducciones));
    const cole = colegiaturasDeducibles({ pagado: colegiaturas, nivel: nivelColegiatura, alumnos });
    const col = cole.deducible;

    const tope = topeDeducciones(grav + exe);
    const deduccionAplicada = Math.min(ded, tope.tope);
    const deduccionSinUsar = r2(ded - deduccionAplicada);
    const totalDeducciones = r2(deduccionAplicada + col);
    const base = Math.max(0, r2(grav - totalDeducciones));

    const conDed = isrAnual(base);
    const sinDed = isrAnual(grav);
    const subsidioAplicado = Math.min(sub, conDed.isr);
    const impuesto = r2(conDed.isr - subsidioAplicado);
    const impuestoSinDeducciones = r2(sinDed.isr - Math.min(sub, sinDed.isr));
    const diferencia = r2(pagado - impuesto);

    return {
      ingresosGravados: grav, ingresosExentos: exe, isrPagado: pagado, subsidio: sub,
      deducciones: ded, colegiaturas: col, colegiaturasDetalle: cole, tope, deduccionAplicada, deduccionSinUsar, totalDeducciones,
      base, tarifa: conDed, isrTarifa: conDed.isr, subsidioAplicado, impuesto,
      ahorroDeducciones: Math.max(0, r2(impuestoSinDeducciones - impuesto)),
      saldoFavor: Math.max(0, diferencia), aCargo: Math.max(0, -diferencia),
      pagadoMayorQueIngresos: grav > 0 ? pagado > grav : pagado > 0
    };
  }

  // ---------- ISR del aguinaldo (impuestos/aguinaldo-isr) ----------
  // Parte exenta: 30 UMA diarias (art. 93 fr. XIV LISR; el SAT aplica la UMA por la desindexación, DOF 27 ene 2016).
  // 2026: 30 x 117.31 = 3,519.30. Solo lo que pasa de ahí es gravado.
  // Método normal (art. 96 LISR): el gravado se suma al sueldo del mes y se aplica la tarifa mensual; lo que se
  // retiene por el aguinaldo es ISR(sueldo + gravado) - ISR(sueldo).
  // Opción del art. 174 del Reglamento de la LISR (la elige quien paga): I. gravado / 365 x 30.4; II. eso se suma al
  // sueldo ordinario del mes y se calcula ISR con la tarifa del art. 96; III. se resta el ISR del sueldo solo;
  // IV. tasa = III / I; V. retención = gravado x tasa. Pasos confirmados con Siempre al Día (ejemplo de $12,000 de
  // sueldo y $6,000 de aguinaldo: 366.30 contra 269.90) y FiscoClic. Para la tasa usamos el ISR sin redondear.
  // No incluye el subsidio para el empleo (la página lo advierte).
  const AGUINALDO_EXENTO_UMA = 30;

  function isrSinRedondeo(base) {
    const x = Calc.isrMensual(base);
    return x.renglon ? x.cuotaFija + x.marginal : 0;
  }

  function isrAguinaldo({ sueldoMensual, aguinaldo }) {
    const sueldo = r2(limpiar(sueldoMensual));
    const ag = r2(limpiar(aguinaldo));
    const exento = r2(AGUINALDO_EXENTO_UMA * Calc.DATOS.uma);
    const exentoAplicado = Math.min(ag, exento);
    const gravado = r2(ag - exentoAplicado);
    const isrSueldo = isrSinRedondeo(sueldo);
    // Método normal como en un recibo: cada ISR redondeado a centavos.
    const normal = gravado > 0 ? r2(Calc.isrMensual(sueldo + gravado).isr - Calc.isrMensual(sueldo).isr) : 0;
    let proporcion = 0, diferencia = 0, tasa = 0, art174 = 0;
    if (gravado > 0) {
      proporcion = gravado / 365 * 30.4;
      diferencia = isrSinRedondeo(sueldo + proporcion) - isrSueldo;
      tasa = diferencia / proporcion;
      art174 = r2(gravado * tasa);
    }
    const mejor = gravado === 0 ? "igual" : art174 < normal ? "art174" : normal < art174 ? "normal" : "igual";
    return {
      sueldo, aguinaldo: ag, exento, exentoAplicado, gravado, todoExento: ag > 0 && gravado === 0,
      normal, netoNormal: r2(ag - normal),
      proporcion: r2(proporcion), diferencia: r2(diferencia), tasa: r2(tasa * 100), art174, neto174: r2(ag - art174),
      mejor, ahorro: r2(Math.abs(normal - art174)), sinSueldo: sueldo === 0
    };
  }

  // ---------- IVA (impuestos/calculadora-iva) ----------
  // Tasa general 16% (art. 1 de la Ley del IVA). 8% en la región fronteriza norte y sur: estímulo fiscal (crédito de
  // 50% del IVA) de los decretos del DOF 31 dic 2018 y 30 dic 2020, prorrogados hasta el 31 dic 2026 (DOF 31 dic 2025,
  // vespertino; DFK, TLC Asociados y Punto Norte). Solo para quien está en el padrón del SAT de ese estímulo.
  const TASAS_IVA = { 16: 0.16, 8: 0.08 };

  // modo "agregar": el monto es SIN IVA y se le suma. modo "quitar": el monto ya trae IVA y se le separa.
  function calcularIva({ monto, tasa = 16, modo = "agregar" }) {
    const m = r2(limpiar(monto));
    const t = TASAS_IVA[+tasa] !== undefined ? +tasa : 16;
    const f = TASAS_IVA[t];
    const quitar = modo === "quitar";
    let base, iva, total;
    if (quitar) {
      total = m;
      base = r2(m / (1 + f));
      iva = r2(total - base);
    } else {
      base = m;
      iva = r2(m * f);
      total = r2(base + iva);
    }
    return { monto: m, tasa: t, modo: quitar ? "quitar" : "agregar", base, iva, total };
  }

  // ---------- Honorarios (impuestos/honorarios) ----------
  // Persona física que cobra por servicios profesionales. Revisado el 4 nov 2026 con Siempre al Día (jun 2025) y
  // Praxium (12 sep 2026), que coinciden; no pudimos abrir la ley en diputados.gob.mx.
  // Actividad profesional (régimen general, arts. 100 a 110 LISR): pago provisional sobre la utilidad (cobrado menos
  // gastos deducibles pagados) con la tarifa del art. 96. La ley usa la tarifa ACUMULADA del año; si cobras y gastas
  // lo mismo cada mes da lo mismo que la tarifa mensual, que es lo que usamos (estimado). Si te paga una persona moral,
  // te retiene 10% de ISR (art. 106, último párrafo).
  // RESICO: se reutiliza resicoMensual (1% a 2.5% de lo cobrado, retención de 1.25%, art. 113-J).
  // IVA: 16% sobre lo cobrado (art. 1 LIVA). Una persona moral te retiene dos terceras partes del IVA (art. 1-A fr. II
  // inciso a) LIVA y art. 3 fr. I de su Reglamento), en los dos regímenes. Restas el IVA de tus gastos (acreditable).
  const HONORARIOS = { retencionIsr: 10, tasaIva: 0.16, retencionIva: 2 / 3 };

  function honorarios({ ingresos, gastos = 0, cobradoAEmpresas = 0, gastosConIva = true } = {}) {
    const ing = r2(limpiar(ingresos));
    const gas = r2(limpiar(gastos));
    const capturadoEmpresas = r2(limpiar(cobradoAEmpresas));
    const empresas = Math.min(ing, capturadoEmpresas);
    // Actividad profesional
    const utilidad = Math.max(0, r2(ing - gas));
    const tarifa = Calc.isrMensual(utilidad);
    const retencionGeneral = r2(empresas * HONORARIOS.retencionIsr / 100);
    const difGeneral = r2(tarifa.isr - retencionGeneral);
    const general = {
      utilidad, isr: tarifa.isr, renglon: tarifa.renglon, retencion: retencionGeneral,
      aPagar: Math.max(0, difGeneral), saldoFavor: Math.max(0, -difGeneral)
    };
    // RESICO (no deduce gastos para el ISR)
    const resico = resicoMensual({ ingresos: ing, cobradoAEmpresas: empresas });
    // IVA
    const trasladado = r2(ing * HONORARIOS.tasaIva);
    const retenido = r2(r2(empresas * HONORARIOS.tasaIva) * HONORARIOS.retencionIva);
    const acreditable = gastosConIva ? r2(gas * HONORARIOS.tasaIva) : 0;
    const difIva = r2(trasladado - retenido - acreditable);
    const iva = { trasladado, retenido, acreditable, aPagar: Math.max(0, difIva), saldoFavor: Math.max(0, -difIva) };
    // Lo que te depositan tus clientes en el mes y lo que te queda después de tus gastos e impuestos del mes.
    const cobrasGeneral = r2(ing + trasladado - retencionGeneral - retenido);
    const cobrasResico = r2(ing + trasladado - resico.retencion - retenido);
    const quedaGeneral = r2(ing - gas - general.isr);
    const quedaResico = r2(ing - gas - resico.isr);
    let conviene = "igual";
    if (!resico.fueraDeRegimen && ing > 0) conviene = resico.isr < general.isr ? "resico" : general.isr < resico.isr ? "general" : "igual";
    return {
      ingresos: ing, gastos: gas, cobradoAEmpresas: empresas, empresasAjustado: capturadoEmpresas > ing, gastosMayores: gas > ing,
      general, resico, iva, cobrasGeneral, cobrasResico, quedaGeneral, quedaResico, conviene,
      ahorro: resico.fueraDeRegimen ? 0 : r2(Math.abs(general.isr - resico.isr))
    };
  }

  // ---------- Plataformas digitales (impuestos/plataformas-digitales) ----------
  // Retención de ISR que hace la plataforma sobre lo que cobras SIN IVA (art. 113-A LISR):
  //   transporte de pasajeros y entrega de bienes (Uber, Didi, Rappi): 2.1% (fr. I);
  //   hospedaje (Airbnb): 4% (fr. II);
  //   venta de bienes y prestación de servicios (Mercado Libre, Amazon): 2.5% en 2026. La ley dice 1% (fr. III), pero
  //   el art. 25 fr. VI de la Ley de Ingresos de la Federación 2026 la subió a 2.5%. Fuentes que coinciden: Praxium
  //   (12 sep 2026), Siigo e IDC (17 abr 2026). La iniciativa del Paquete Económico 2027 la mantiene en 2.5% (EY,
  //   10 sep 2026); revisar en enero de 2027 con la Ley de Ingresos 2027 publicada.
  // Sin RFC: 20% de ISR (art. 113-C fr. IV LISR) y 100% del IVA. Con RFC, la plataforma retiene 50% del IVA, es decir
  // 8% de lo cobrado (art. 18-J fr. II inciso a) LIVA). Fuentes: Praxium, Siigo e IDC.
  // Pago definitivo (art. 113-B LISR): si solo ganas por plataformas y el año anterior no pasaste de 300,000 pesos,
  // puedes quedarte con las retenciones como pago definitivo, sin deducir gastos (Praxium y Siigo).
  const PLATAFORMAS = {
    actividades: {
      transporte: { nombre: "Transporte de pasajeros o reparto (Uber, Didi, Rappi)", isr: 2.1 },
      hospedaje: { nombre: "Hospedaje (Airbnb, Booking)", isr: 4 },
      ventas: { nombre: "Venta de productos o servicios (Mercado Libre, Amazon)", isr: 2.5 }
    },
    sinRfcIsr: 20,
    tasaIva: 0.16,
    retencionIva: 0.5,
    sinRfcIva: 1,
    topeDefinitivo: 300000
  };

  // ingresos: lo que cobraste en el mes por la plataforma, sin IVA. ivaCero: lo que vendes paga IVA de 0%
  // (por ejemplo, alimentos sin preparar), así que no hay IVA que cobrar ni retener.
  function plataformasDigitales({ ingresos, actividad = "transporte", conRfc = true, ivaCero = false, soloPlataformas = true } = {}) {
    const ing = r2(limpiar(ingresos));
    const clave = PLATAFORMAS.actividades[actividad] ? actividad : "transporte";
    const act = PLATAFORMAS.actividades[clave];
    const rfc = conRfc !== false;
    const tasaIsr = rfc ? act.isr : PLATAFORMAS.sinRfcIsr;
    const isrRetenido = r2(ing * tasaIsr / 100);
    const iva = ivaCero ? 0 : r2(ing * PLATAFORMAS.tasaIva);
    const parteIva = rfc ? PLATAFORMAS.retencionIva : PLATAFORMAS.sinRfcIva;
    const ivaRetenido = r2(iva * parteIva);
    const deposito = r2(ing + iva - isrRetenido - ivaRetenido);
    const anual = r2(ing * 12);
    const puedeDefinitivo = rfc && soloPlataformas !== false && anual <= PLATAFORMAS.topeDefinitivo;
    return {
      ingresos: ing, actividad: clave, nombre: act.nombre, conRfc: rfc, ivaCero: !!ivaCero,
      tasaIsr, isrRetenido, iva, tasaRetencionIva: parteIva * 100, ivaRetenido, ivaPendiente: r2(iva - ivaRetenido),
      deposito, anual, isrAnual: r2(isrRetenido * 12), puedeDefinitivo,
      pasaTope: anual > PLATAFORMAS.topeDefinitivo
    };
  }

  // ---------- Deducciones personales (impuestos/deducciones-personales) ----------
  // Art. 151 LISR. Revisado el 6 nov 2026 con Siempre al Día (28 oct 2026), Praxium (10 sep 2026) y el texto del
  // artículo en SDV. Dentro del tope general (5 UMA anuales o 15% de tus ingresos, lo menor; topeDeducciones): gastos
  // médicos y de hospital, lentes (hasta 2,500 por persona, art. 264 del Reglamento), seguro de gastos médicos,
  // intereses reales del crédito hipotecario, gastos funerales (hasta 1 UMA anual, fr. II) y transporte escolar.
  // Fuera del tope: colegiaturas (colegiaturasDeducibles), donativos (fr. III, hasta 7% de los ingresos acumulables
  // del año anterior) y aportaciones voluntarias para el retiro (fr. V; sus límites salen de retiro.js).
  // Que los donativos queden fuera del tope lo dicen el texto del artículo en SDV y Siempre al Día; Praxium dice que
  // entran desde 2022. Usamos fuera del tope, como en DATOS.deducciones, y la página lo marca como dato en disputa.
  const DEDUCCIONES = { lentesPorPersona: 2500, funeralesUma: 1, donativosPorcentaje: 7 };

  // Límites de las aportaciones voluntarias deducibles (10% de los ingresos y 5 UMA anuales), de retiro.js.
  // En el navegador la página carga ../../assets/retiro.js antes de usar esta función.
  function limitesRetiro() {
    const R = typeof module !== "undefined" && module.exports ? require("./retiro.js") : raiz.Retiro;
    return R.DATOS.deducibleVoluntarias;
  }

  function deduccionesPersonales({ ingresosGravados, ingresosExentos = 0, isrRetenido, medicos = 0, lentes = 0, personasLentes = 1,
    seguro = 0, hipoteca = 0, funerales = 0, transporte = 0, colegiaturas = 0, nivelColegiatura = "primaria", alumnos = 1,
    donativos = 0, retiro = 0 } = {}) {
    const grav = r2(limpiar(ingresosGravados));
    const exe = r2(limpiar(ingresosExentos));
    const D = DEDUCCIONES;
    const personas = Math.min(DATOS.maxAlumnos, Math.max(1, Math.floor(limpiar(personasLentes))));
    const lentesPag = r2(limpiar(lentes));
    const funPag = r2(limpiar(funerales));
    const dentro = [
      { clave: "medicos", nombre: "Médicos, dentista, hospital y análisis", pagado: r2(limpiar(medicos)) },
      { clave: "lentes", nombre: "Lentes graduados", pagado: lentesPag, deducible: Math.min(lentesPag, D.lentesPorPersona * personas) },
      { clave: "seguro", nombre: "Seguro de gastos médicos", pagado: r2(limpiar(seguro)) },
      { clave: "hipoteca", nombre: "Intereses reales del crédito hipotecario", pagado: r2(limpiar(hipoteca)) },
      { clave: "funerales", nombre: "Gastos funerales", pagado: funPag, deducible: Math.min(funPag, r2(D.funeralesUma * umaAnual)) },
      { clave: "transporte", nombre: "Transporte escolar obligatorio", pagado: r2(limpiar(transporte)) }
    ].map(x => Object.assign({ deducible: x.pagado }, x));
    const sumaDentro = r2(dentro.reduce((s, x) => s + x.deducible, 0));
    const tope = topeDeducciones(grav + exe);
    const dentroAplicado = Math.min(sumaDentro, tope.tope);
    const sinUsar = r2(sumaDentro - dentroAplicado);

    const cole = colegiaturasDeducibles({ pagado: colegiaturas, nivel: nivelColegiatura, alumnos });
    // Donativos: 7% de los ingresos acumulables del año ANTERIOR; usamos los de este año como aproximación.
    const donPag = r2(limpiar(donativos));
    const donLimite = r2(grav * D.donativosPorcentaje / 100);
    const donDed = Math.min(donPag, donLimite);
    const LR = limitesRetiro();
    const retPag = r2(limpiar(retiro));
    const retLimite = Math.min(r2(grav * LR.porcentaje / 100), r2(LR.topeUma * umaAnual));
    const retDed = Math.min(retPag, retLimite);
    const fuera = r2(cole.deducible + donDed + retDed);

    const total = r2(dentroAplicado + fuera);
    const base = Math.max(0, r2(grav - total));
    const sin = isrAnual(grav);
    const con = isrAnual(base);
    const ahorro = r2(sin.isr - con.isr);
    const hayRetenido = isrRetenido !== undefined && isrRetenido !== null && String(isrRetenido).trim() !== "";
    const retenido = hayRetenido ? r2(limpiar(isrRetenido)) : 0;
    const diferencia = hayRetenido ? r2(retenido - con.isr) : 0;
    const saldoFavor = hayRetenido ? Math.max(0, diferencia) : 0;
    return {
      ingresosGravados: grav, ingresosExentos: exe, dentro, sumaDentro, tope, dentroAplicado, sinUsar,
      colegiaturas: cole, donativos: { pagado: donPag, limite: donLimite, deducible: donDed },
      retiro: { pagado: retPag, limite: retLimite, deducible: retDed }, fuera, total, base,
      isrSinDeducciones: sin.isr, isrConDeducciones: con.isr, tasaMarginal: con.porcentaje, ahorro,
      hayRetenido, isrRetenido: retenido, saldoFavor, aCargo: hayRetenido ? Math.max(0, -diferencia) : 0,
      devolucion: devolucion(hayRetenido ? saldoFavor : ahorro)
    };
  }

  const api = { DATOS, MAXIMO, umaAnual, limpiar, tasaResico, resicoMensual, resicoAnual, isrAnual, topeDeducciones, colegiaturasDeducibles, devolucion, declaracionAnual, isrAguinaldo, calcularIva, TASAS_IVA, HONORARIOS, honorarios, PLATAFORMAS, plataformasDigitales, DEDUCCIONES, deduccionesPersonales };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Impuestos = api;
})(this);
