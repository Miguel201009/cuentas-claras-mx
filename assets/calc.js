// Cálculos laborales de Cuentas Claras MX. Funciones puras, sin datos personales:
// todo se calcula en el navegador de la persona.
(function (raiz) {
  // Valores oficiales vigentes. Actualizar cada enero (salario mínimo) y febrero (UMA).
  const DATOS = {
    anio: 2026,
    salarioMinimo: { general: 315.04, frontera: 440.87 }, // CONASAMI, DOF 9 dic 2025, vigente desde 1 ene 2026
    uma: 117.31, // INEGI, DOF 9 ene 2026, vigente del 1 feb 2026 al 31 ene 2027 (en enero 2026 regía 113.14)
    umaMensual: 3566.22, // INEGI, mismo DOF (117.31 x 30.4)
    diasMes: 30.4, // días promedio del mes para pasar de diario a mensual (UMA mensual, cuotas IMSS estimadas)

    // Tarifa MENSUAL del art. 96 LISR para 2026: Anexo 8 de la RMF 2026, DOF 28 dic 2025 (no cambió en la
    // 1a. modificación del DOF 9 jul 2026). [límite inferior, límite superior, cuota fija, % sobre excedente].
    // Cifras tomadas de transcripciones que coinciden entre sí; pendiente cotejarlas contra el PDF del SAT.
    // No recalcular las cuotas fijas: se usan tal como vienen en el Anexo 8.
    isrMensual: [
      [0.01, 844.59, 0, 1.92],
      [844.60, 7168.51, 16.22, 6.40],
      [7168.52, 12598.02, 420.95, 10.88],
      [12598.03, 14644.64, 1011.68, 16.00],
      [14644.65, 17533.64, 1339.14, 17.92],
      [17533.65, 35362.83, 1856.84, 21.36],
      [35362.84, 55736.68, 5665.16, 23.52],
      [55736.69, 106410.50, 10457.09, 30.00],
      [106410.51, 141880.66, 25659.23, 32.00],
      [141880.67, 425641.99, 37009.69, 34.00],
      [425642.00, Infinity, 133488.54, 35.00]
    ],

    // Subsidio para el empleo: Decreto del DOF 1 may 2024, modificado el 31 dic 2024 y el 31 dic 2025.
    // Monto fijo mensual de feb a dic 2026: 15.02% de la UMA mensual 2026 (en enero fue 536.21).
    // Solo si la base gravable del mes no pasa del tope; arriba del tope es 0 (no baja poco a poco).
    // No genera saldo a favor ni se entrega en efectivo.
    subsidioEmpleo: { mensual: 535.65, enero: 536.21, tope: 11492.66 },

    // Cuotas obreras del IMSS (lo que se descuenta al trabajador), Ley del Seguro Social.
    imss: {
      topeUma: 25, // tope del SBC: 25 UMA (art. 28 LSS y desindexación DOF 27 ene 2016)
      excedenteUma: 3, // el ramo de excedente solo cobra sobre lo que pasa de 3 UMA
      ramos: [
        { clave: "excedente", nombre: "Enfermedad y maternidad (excedente de 3 UMA)", tasa: 0.0040, ley: "Art. 106 LSS" },
        { clave: "dinero", nombre: "Enfermedad y maternidad (prestaciones en dinero)", tasa: 0.0025, ley: "Art. 107 LSS" },
        { clave: "pensionados", nombre: "Gastos médicos de pensionados", tasa: 0.00375, ley: "Art. 25 LSS" },
        { clave: "invalidez", nombre: "Invalidez y vida", tasa: 0.00625, ley: "Art. 147 LSS" },
        { clave: "cesantia", nombre: "Cesantía en edad avanzada y vejez", tasa: 0.01125, ley: "Art. 168 LSS" }
      ]
    },
    // Factor de integración mínimo de ley: 1 + (15 días de aguinaldo + 12 de vacaciones x 25%) / 365.
    factorIntegracion: 1.0493
  };

  const DIA = 864e5;

  function fecha(texto) {
    const d = new Date(texto + "T00:00:00");
    return isNaN(d) ? null : d;
  }

  function diasEntre(a, b) {
    return Math.round((b - a) / DIA);
  }

  // Revisa las fechas de entrada y de último día que escribe la persona (formato del campo date, AAAA-MM-DD).
  // Devuelve { ingreso, salida } o { error } con un mensaje para la página.
  const FECHA_MIN = "1950-01-01", FECHA_MAX = "2030-12-31";
  function validarFechas(textoIngreso, textoSalida) {
    if (!textoIngreso || !textoSalida) return { error: "Escribe las dos fechas: cuándo entraste y tu último día de trabajo." };
    const ingreso = fecha(textoIngreso), salida = fecha(textoSalida);
    if (!ingreso || !salida) return { error: "Revisa las fechas: alguna no es válida." };
    const min = fecha(FECHA_MIN), max = fecha(FECHA_MAX);
    if (ingreso < min || salida < min || ingreso > max || salida > max) return { error: "Revisa las fechas: usa fechas entre 1950 y 2030." };
    if (salida < ingreso) return { error: "Tu último día de trabajo no puede ser antes de la fecha en que entraste." };
    return { ingreso, salida };
  }

  function aniosCompletos(ingreso, salida) {
    let n = salida.getFullYear() - ingreso.getFullYear();
    const aniversario = new Date(salida.getFullYear(), ingreso.getMonth(), ingreso.getDate());
    if (salida < aniversario) n--;
    return Math.max(0, n);
  }

  // Antigüedad en años: años cumplidos más la parte del año en curso (días desde el último aniversario / 365).
  // El último día de trabajo cuenta, igual que en el aguinaldo: del 16 oct 2011 al 15 oct 2026 son 15 años.
  function tiempoServicio(ingreso, salida) {
    const fin = new Date(salida.getFullYear(), salida.getMonth(), salida.getDate() + 1);
    const anios = aniosCompletos(ingreso, fin);
    const ultimoAniv = new Date(ingreso.getFullYear() + anios, ingreso.getMonth(), ingreso.getDate());
    const fraccion = Math.min(1, Math.max(0, diasEntre(ultimoAniv, fin) / 365));
    return { anios, fraccion, total: anios + fraccion };
  }

  // Redondeo a centavos, como en un recibo de nómina.
  function r2(n) {
    return Math.round(n * 100 + 1e-6) / 100;
  }

  // Número válido y positivo; vacío, texto, negativo o infinito cuenta como 0.
  function monto(x) {
    const n = +x;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function salarioMinimoZona(zona) {
    return DATOS.salarioMinimo[zona] || DATOS.salarioMinimo.general;
  }

  // Art. 76 LFT (reforma 2023): días de vacaciones al cumplir n años de servicio.
  function diasVacaciones(n) {
    if (n < 1) return 0;
    if (n <= 5) return 12 + 2 * (n - 1);
    return 20 + 2 * Math.ceil((n - 5) / 5);
  }

  // Art. 87 LFT: aguinaldo proporcional a los días trabajados en el año.
  function aguinaldo({ salarioMensual, ingreso, diasAguinaldo = 15, anio = DATOS.anio, corte }) {
    const sd = salarioMensual / 30;
    const inicio = new Date(anio, 0, 1);
    const fin = corte || new Date(anio, 11, 31);
    const desde = ingreso > inicio ? ingreso : inicio;
    const diasAnio = (new Date(anio, 11, 31) - inicio) / DIA + 1;
    const trabajados = desde > fin ? 0 : diasEntre(desde, fin) + 1;
    const diasProp = diasAguinaldo * trabajados / diasAnio;
    const bruto = sd * diasProp;
    const exento = 30 * DATOS.uma; // Art. 93 fr. XIV LISR
    return { sd, trabajados, diasAnio, diasProp, bruto, exento, gravado: Math.max(0, bruto - exento) };
  }

  // Finiquito (renuncia) o liquidación (despido injustificado). Usa salario diario base;
  // la ley pide salario integrado para indemnizaciones, así que el resultado es un mínimo.
  function finiquito({ salarioMensual, ingreso, salida, diasAguinaldo = 15, primaVacacional = 0.25,
    vacacionesTomadas = 0, vacacionesPendientes = 0, diasSinPagar = 0, motivo = "renuncia",
    zona = "general", veinteDias = false }) {
    salarioMensual = monto(salarioMensual);
    // Los días no pueden ser negativos: un -100 por error no debe restar ni sumar dinero.
    diasSinPagar = monto(diasSinPagar);
    vacacionesTomadas = monto(vacacionesTomadas);
    vacacionesPendientes = monto(vacacionesPendientes);
    const sd = salarioMensual / 30;
    const { anios, fraccion, total: antiguedad } = tiempoServicio(ingreso, salida);

    const ag = aguinaldo({ salarioMensual, ingreso, diasAguinaldo, anio: salida.getFullYear(), corte: salida });
    const diasVacAnio = diasVacaciones(anios + 1) * fraccion;
    const diasVac = Math.max(0, diasVacAnio - vacacionesTomadas) + vacacionesPendientes;

    const prima = primaAntiguedad({ salarioMensual, ingreso, salida, motivo, zona });
    const aplicaPrimaAnt = prima.aplica;

    const conceptos = [
      { nombre: "Días trabajados sin pagar", monto: sd * diasSinPagar, ley: "Art. 84 LFT" },
      { nombre: "Aguinaldo proporcional", monto: ag.bruto, ley: "Art. 87 LFT" },
      { nombre: "Vacaciones no disfrutadas", monto: sd * diasVac, ley: "Arts. 76 y 79 LFT" },
      { nombre: "Prima vacacional", monto: sd * diasVac * primaVacacional, ley: "Art. 80 LFT" },
      { nombre: "Prima de antigüedad", monto: prima.prima, ley: "Art. 162 LFT" }
    ];
    if (motivo === "despido") {
      conceptos.push({ nombre: "Indemnización de 3 meses", monto: 90 * sd, ley: "Arts. 48 y 50 LFT" });
      if (veinteDias) conceptos.push({ nombre: "20 días por año trabajado", monto: 20 * antiguedad * sd, ley: "Art. 50 fr. II LFT" });
    }
    const total = conceptos.reduce((s, c) => s + c.monto, 0);
    return { sd, anios, antiguedad, diasVac, aplicaPrimaAnt, prima, conceptos, total };
  }

  // Prima de antigüedad, art. 162 LFT: 12 días de salario por cada año de servicio, con la parte
  // proporcional del último año. El salario que se usa no puede ser menor al salario mínimo (art. 485)
  // ni mayor al doble del salario mínimo del lugar donde se trabajaba (art. 486).
  // Al renunciar solo se paga con 15 años cumplidos o más; en los demás casos, con cualquier antigüedad.
  // Motivos: renuncia, despido (injustificado), justificado (despido con causa, art. 47),
  // rescision (el trabajador se va por falta del patrón, art. 51), incapacidad (no profesional, art. 54),
  // muerte (la cobran los beneficiarios, art. 501) y cierre (terminación colectiva, arts. 436 y 439).
  // Sin sueldo capturado (vacío o 0) no se calcula: el piso del salario mínimo daría una prima engañosa.
  function primaAntiguedad({ salarioMensual, ingreso, salida, motivo = "renuncia", zona = "general" }) {
    const sd = monto(salarioMensual) / 30;
    const salarioMinimo = salarioMinimoZona(zona);
    const tope = 2 * salarioMinimo;
    const sinSueldo = sd === 0;
    const base = sinSueldo ? 0 : Math.min(Math.max(sd, salarioMinimo), tope);
    const { anios, fraccion, total: antiguedad } = tiempoServicio(ingreso, salida);
    const aplica = motivo !== "renuncia" || anios >= 15;
    const dias = 12 * antiguedad;
    const prima = aplica ? dias * base : 0;
    // Art. 54 LFT: con incapacidad que no viene del trabajo se paga además un mes de salario.
    const mesIncapacidad = motivo === "incapacidad" ? 30 * sd : 0;
    return {
      sd, salarioMinimo, tope, base, sinSueldo, topado: sd > tope, conPiso: !sinSueldo && sd < salarioMinimo,
      anios, fraccion, antiguedad, aplica, dias, prima, mesIncapacidad, total: prima + mesIncapacidad
    };
  }

  // ISR según la tarifa mensual del art. 96 LISR (antes de restar el subsidio para el empleo).
  function isrMensual(baseGravable) {
    const base = Math.max(0, +baseGravable || 0);
    const tabla = DATOS.isrMensual;
    if (base < tabla[0][0]) {
      return { base, renglon: 0, limiteInferior: 0, limiteSuperior: 0, cuotaFija: 0, porcentaje: 0, excedente: 0, marginal: 0, isr: 0 };
    }
    let i = tabla.length - 1;
    while (i > 0 && base < tabla[i][0]) i--;
    const [limiteInferior, limiteSuperior, cuotaFija, porcentaje] = tabla[i];
    const excedente = base - limiteInferior;
    const marginal = excedente * porcentaje / 100;
    return { base, renglon: i + 1, limiteInferior, limiteSuperior, cuotaFija, porcentaje, excedente, marginal, isr: r2(marginal + cuotaFija) };
  }

  // Subsidio para el empleo del mes: monto fijo si la base gravable no pasa del tope; si pasa, 0.
  function subsidioEmpleo(ingresoMensual) {
    const s = DATOS.subsidioEmpleo;
    return ingresoMensual > 0 && ingresoMensual <= s.tope ? s.mensual : 0;
  }

  // Cuotas obreras del IMSS por ramo. Recibe el salario base de cotización (SBC) diario; lo acota
  // entre el salario mínimo de la zona y 25 UMA. El mensual usa los días indicados (30.4 por omisión).
  function cuotasImssObrero(sbcDiario, zona = "general", dias = DATOS.diasMes) {
    const cfg = DATOS.imss;
    const tope = cfg.topeUma * DATOS.uma;
    const umbral = cfg.excedenteUma * DATOS.uma;
    const capturado = Math.max(0, +sbcDiario || 0);
    const sbc = Math.min(Math.max(capturado, salarioMinimoZona(zona)), tope);
    const ramos = cfg.ramos.map(r => {
      const base = r.clave === "excedente" ? Math.max(0, sbc - umbral) : sbc;
      const diario = base * r.tasa;
      return Object.assign({}, r, { base, diario, mensual: r2(diario * dias) });
    });
    const diario = ramos.reduce((s, r) => s + r.diario, 0);
    const mensual = r2(ramos.reduce((s, r) => s + r.mensual, 0));
    return { sbc, topado: capturado > tope, tope, umbral, dias, ramos, diario, mensual };
  }

  // Sueldo neto de un sueldo mensual simple: la base gravable es el sueldo bruto (sin exentos) y el SBC
  // se estima con el factor de integración mínimo de ley. El salario diario es el sueldo mensual entre 30
  // (art. 89 LFT, igual que en aguinaldo y prima de antigüedad); las cuotas del IMSS se pasan a mes con
  // 30.4 días en promedio, porque el IMSS cobra por los días de cada mes.
  // Quien gana solo el salario mínimo de su zona no paga ISR (art. 96 LISR) y su parte del IMSS la paga el
  // patrón (art. 36 LSS). Se aplica si el salario diario (sueldo / 30) no pasa del mínimo, o si la persona
  // dice que gana exactamente el mínimo (ganaMinimo) y el sueldo no pasa de 31 días de salario mínimo:
  // así entran los meses de 31 días y la cifra mensual de la CONASAMI (mínimo x 365 / 12).
  function sueldoNeto({ salarioMensual, zona = "general", ganaMinimo = false, factorIntegracion = DATOS.factorIntegracion, dias = DATOS.diasMes }) {
    const bruto = monto(salarioMensual);
    const salarioMinimo = salarioMinimoZona(zona);
    const limiteMinimo = r2(salarioMinimo * 30);
    const limiteMinimo31 = r2(salarioMinimo * 31);
    const minimoDeclarado = ganaMinimo && bruto > limiteMinimo && bruto <= limiteMinimo31;
    const soloMinimo = bruto <= limiteMinimo || minimoDeclarado;
    const debajoMinimo = bruto > 0 && bruto < limiteMinimo; // menos de 30 días de salario mínimo
    const ganaMinimoNoAplica = ganaMinimo && bruto > limiteMinimo31;

    const isr = isrMensual(bruto);
    const subsidio = subsidioEmpleo(bruto);
    const subsidioAplicado = Math.min(subsidio, isr.isr); // el sobrante no se entrega ni se acumula
    const isrDespuesSubsidio = r2(isr.isr - subsidioAplicado);
    const isrRetenido = soloMinimo ? 0 : isrDespuesSubsidio;
    const exentoMinimo = isrDespuesSubsidio - isrRetenido;

    const sd = bruto / 30;
    const imss = cuotasImssObrero(sd * factorIntegracion, zona, dias);
    const imssObrero = soloMinimo ? 0 : imss.mensual;

    const descuentos = r2(isrRetenido + imssObrero);
    const neto = r2(bruto - descuentos);
    return {
      bruto, zona, salarioMinimo, limiteMinimo, limiteMinimo31, soloMinimo, minimoDeclarado, debajoMinimo, ganaMinimoNoAplica,
      isr, isrTarifa: isr.isr, subsidio, subsidioAplicado, sinSubsidioPorTope: bruto > DATOS.subsidioEmpleo.tope,
      exentoMinimo, isrRetenido, sd, sbc: imss.sbc, imss, imssObrero, patronPagaImss: soloMinimo,
      descuentos, neto,
      tasaIsr: bruto ? isrRetenido / bruto : 0,
      tasaEfectiva: bruto ? descuentos / bruto : 0
    };
  }

  const api = {
    DATOS, fecha, validarFechas, aniosCompletos, tiempoServicio, diasVacaciones, aguinaldo, finiquito, salarioMinimoZona,
    redondear: r2, isrMensual, subsidioEmpleo, cuotasImssObrero, sueldoNeto, primaAntiguedad
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Calc = api;
})(this);

// Formato de pesos y utilidades de página.
function mxn(n) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

// Lee un número de un campo de la página. Vacío, texto o negativo cuenta como 0. Lo que pase del máximo
// (100 millones por omisión; casi siempre es un error de dedo) se acota y se marca con acotado = true.
function leerNumero(campo, maximo = 1e8) {
  const n = +campo.value;
  if (n > maximo) return { valor: maximo, acotado: true };
  return { valor: Number.isFinite(n) && n > 0 ? n : 0, acotado: false };
}
