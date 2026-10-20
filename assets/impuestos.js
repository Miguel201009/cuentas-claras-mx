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

  const api = { DATOS, MAXIMO, umaAnual, limpiar, tasaResico, resicoMensual, resicoAnual, isrAnual, topeDeducciones, colegiaturasDeducibles, devolucion, declaracionAnual };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Impuestos = api;
})(this);
