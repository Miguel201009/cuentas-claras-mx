// Cálculos de la sección Trabajo (reparto de utilidades, horas extra y temporada de aguinaldo) de Cuentas Claras MX.
// Funciones puras, sin datos personales: todo se calcula en el navegador de la persona.
// En el navegador carga antes ../../assets/calc.js (UMA y salario mínimo vienen de Calc.DATOS).
(function (raiz) {
  const Calc = (typeof module !== "undefined" && module.exports) ? require("./calc.js") : raiz.Calc;

  const DATOS = {
    ptu: {
      // 10% de la renta gravable de la empresa. Resolución de la Sexta Comisión Nacional para la PTU,
      // DOF 18 sep 2020 (mantiene el 10%); lo repite el Manual laboral y fiscal PTU 2026 del SAT y la STPS.
      porcentaje: 0.10,
      // Tope por persona: 3 meses de salario o el promedio de la PTU de los últimos 3 años, lo que más
      // convenga al trabajador. Art. 127 fr. VIII LFT, reforma de subcontratación DOF 23 abr 2021.
      topeMeses: 3,
      // Eventuales: solo participan si trabajaron al menos 60 días en el año. Art. 127 fr. VII LFT.
      diasEventual: 60,
      // Parte libre de ISR: 15 veces la UMA diaria, criterio del SAT. El art. 93 fr. XIV LISR dice "15 días de salario
      // mínimo general del área geográfica del trabajador"; el SAT aplica la UMA por la desindexación (DOF 27 ene 2016).
      // Criterio único del sitio para aguinaldo (30), PTU (15) y horas extra (5): UMA, con la salvedad en cada página.
      exentoUma: 15,
      // Confianza: si ganan más que el sindicalizado (o, si no hay, el de planta) mejor pagado, su salario para la PTU
      // tiene como máximo ese salario más 20%. Art. 127 fr. II LFT.
      confianzaExtra: 0.20,
      // Fechas límite (art. 122 LFT: 60 días después del plazo de la declaración anual). Manual PTU 2026 del SAT y PROFEDET.
      fechaMorales: "30 de mayo",
      fechaFisicas: "29 de junio"
    },
    horasExtra: {
      // PENDIENTE DE COTEJO: las cifras de la reforma de 2026 (dobles por año, máximo de triples, jornada por año
      // y fechas DOF 3 mar y 1 may 2026) salen de resúmenes de despachos y especialistas, no del texto del decreto.
      // dof.gob.mx y diputados.gob.mx no fueron accesibles al revisar (oct 2026). Tratar como oficial: false.
      // Cotejar contra el decreto (arts. 66 y 68 LFT y transitorios segundo a cuarto) antes de quitar este aviso.
      verificadoDOF: false,
      // Horas extra que se pagan al doble (100% más) por semana. Art. 66 LFT y transitorio cuarto del decreto
      // del DOF 1 may 2026 (según resúmenes): 9 en 2026 y 2027, 10 en 2028, 11 en 2029 y 12 desde 2030.
      // En 2026 el pago coincide con la regla anterior a la reforma (arts. 66 a 68 LFT): 9 horas a la semana
      // al doble (100% más, art. 67) y lo que pase de 9 al triple (200% más, art. 68).
      dobles: { 2026: 9, 2027: 9, 2028: 10, 2029: 11, 2030: 12 },
      // Lo que pasa del límite del art. 66 se paga al triple (200% más). Según resúmenes de la reforma, no puede
      // pasar de 4 horas a la semana (art. 68). Pendiente de cotejo. Solo se usa para el aviso de "pasas del máximo".
      triplesMax: 4,
      // Jornada ordinaria máxima por semana. Art. 123 apartado A fr. IV constitucional (DOF 3 mar 2026)
      // y transitorio segundo del decreto de la LFT (DOF 1 may 2026), según resúmenes. Cada cambio empieza el 1 de enero.
      // 48 en 2026 es la regla de siempre (art. 61 LFT: 8 horas diarias, 6 días). Pendiente de cotejo de 2027 en adelante.
      jornadaSemanal: { 2026: 48, 2027: 46, 2028: 44, 2029: 42, 2030: 40 },
      // ISR, art. 93 fr. I LISR: si ganas el salario mínimo, el tiempo extra dentro del límite de la ley está exento.
      // Si ganas más, está exento el 50% del tiempo extra que no excede el límite de la ley (las horas dobles), sin
      // pasar de 5 veces el salario mínimo general por semana. El SAT aplica 5 UMA (criterio único del sitio).
      // Las horas al triple pasan del límite y pagan ISR completo.
      exentoUmaSemana: 5,
      exentoPorcentaje: 0.5,
      // Jornada diaria aceptada: de 1 a 24 horas. Menos de 1 hora da un valor de hora absurdo.
      jornadaMin: 1,
      jornadaMax: 24,
      maxHorasSemana: 168
    },
    // Temporada de aguinaldo: pensionados, gobierno y fecha límite. Revisado el 21 oct 2026 con la ley (transcripciones
    // de Justia, mLey y SDV), la página del IMSS y notas de prensa; dof.gob.mx y diputados.gob.mx no abrieron desde aquí.
    aguinaldo: {
      // Empresas privadas: "antes del día veinte de diciembre", al menos 15 días de salario (art. 87 LFT).
      diaLimite: 20,
      diasLey: 15,
      // Gobierno federal: al menos 40 días "sin deducción alguna"; 50% antes del 15 de diciembre y 50% a más tardar
      // el 15 de enero (art. 42 Bis LFTSE). El decreto anual del DOF (el de 2025 salió el 4 nov 2025) dio 40 días y
      // permitió pagar desde el 10 de noviembre. El decreto de 2026 aún no se publica (21 oct 2026).
      gobiernoDias: 40,
      gobiernoPrimeraParte: 0.5,
      // Multa al patrón que no paga: de 50 a 5,000 UMA (art. 1002 LFT), por cada trabajador afectado (art. 992 LFT).
      multaUma: { min: 50, max: 5000 },
      // Pensiones libres de ISR hasta 15 UMA diarias (art. 93 fr. IV LISR): unos $53,493 al mes en 2026 (Uno TV, IDC).
      pensionExentaUma: 15,
      // Días de aguinaldo por tipo de pensión (sobre la pensión mensual / 30) y en cuántas partes llega.
      pensiones: {
        // IMSS, Ley del Seguro Social de 1973, cesantía en edad avanzada o vejez: una mensualidad de la pensión, sin
        // asignaciones familiares ni ayudas asistenciales (art. 167 LSS 1973; preguntas frecuentes del IMSS). En noviembre.
        imss73: { dias: 30, partes: [{ cuando: "noviembre de 2026, con tu pensión", parte: 1 }] },
        // ISSSTE (pensiones del régimen anterior, décimo transitorio): hasta 40 días de la cuota de la pensión
        // (decreto de aguinaldo, DOF 4 nov 2025, art. quinto). 20 días en la primera quincena de noviembre y 20 en enero.
        issste: { dias: 40, partes: [{ cuando: "primera quincena de noviembre de 2026", parte: 0.5 }, { cuando: "enero de 2027", parte: 0.5 }] },
        // IMSS, invalidez (LSS 1997): no menos de 30 días de la pensión (art. 142 LSS).
        imssInvalidez: { dias: 30, minimo: true, partes: [{ cuando: "pregunta a quien te paga la pensión", parte: 1 }] },
        // IMSS, riesgo de trabajo: incapacidad permanente total, o parcial de más de 50%: 15 días (art. 58 fr. IV LSS).
        imssRiesgo: { dias: 15, partes: [{ cuando: "pregunta a quien te paga la pensión", parte: 1 }] },
        // IMSS, Ley 97, cesantía o vejez (retiro programado o renta vitalicia): no hay aguinaldo (IMSS).
        imss97: { dias: 0, partes: [] },
        // Pensión para el Bienestar de las Personas Adultas Mayores: programa social, sin aguinaldo (Uno TV, Ruptura 360).
        bienestar: { dias: 0, partes: [] }
      }
    },
    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: { sueldoMensual: 1e8, montoEmpresa: 1e12, diasEmpresa: 1e9 }
  };

  // Número válido, finito y no negativo; lo demás cuenta como 0.
  function num(x) {
    const n = +x;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Igual que num(), pero sin pasar de un máximo.
  function acotado(x, max) {
    return Math.min(num(x), max);
  }

  function porAnio(tabla, anio) {
    const anios = Object.keys(tabla).map(Number).sort((a, b) => a - b);
    const a = Math.round(num(anio)) || anios[0];
    if (a <= anios[0]) return tabla[anios[0]];
    if (a >= anios[anios.length - 1]) return tabla[anios[anios.length - 1]];
    return tabla[a];
  }

  // Reparto de utilidades (PTU) estimado para una persona. Arts. 117 a 131 LFT.
  // La mitad del monto a repartir se divide entre todos según los días trabajados y la otra mitad según
  // los salarios del año (art. 123). El salario es la cuota diaria, sin aguinaldo, bonos ni horas extra (art. 124).
  // caso: "planta", "confianza", "eventual", "directivo" (director, administrador o gerente general)
  // u "hogar" (trabajo del hogar).
  // salarioMaxPlanta (opcional, solo confianza): sueldo mensual del sindicalizado o de planta mejor pagado.
  // Si se da, el salario para el reparto no pasa de ese sueldo más 20% (art. 127 fr. II). El tope de 3 meses
  // (fr. VIII) se calcula con ese mismo salario para el reparto.
  function ptu({ rentaGravable, diasTotales, salariosTotales, salarioMensual, dias, promedio3 = 0,
    caso = "planta", salarioMaxPlanta = 0, porcentaje = DATOS.ptu.porcentaje }) {
    const cfg = DATOS.ptu;
    const max = DATOS.maximos;
    const recortado = num(rentaGravable) > max.montoEmpresa || num(salariosTotales) > max.montoEmpresa ||
      num(diasTotales) > max.diasEmpresa || num(salarioMensual) > max.sueldoMensual || num(promedio3) > max.montoEmpresa ||
      num(salarioMaxPlanta) > max.sueldoMensual;
    rentaGravable = acotado(rentaGravable, max.montoEmpresa);
    salariosTotales = acotado(salariosTotales, max.montoEmpresa);
    diasTotales = acotado(diasTotales, max.diasEmpresa);
    salarioMensual = acotado(salarioMensual, max.sueldoMensual);
    promedio3 = acotado(promedio3, max.montoEmpresa);
    salarioMaxPlanta = acotado(salarioMaxPlanta, max.sueldoMensual);
    const renta = num(rentaGravable);
    const repartir = renta * porcentaje;
    const mitad = repartir / 2;

    const sdReal = num(salarioMensual) / 30;
    // Límite de confianza (art. 127 fr. II): salario del sindicalizado o de planta mejor pagado más 20%.
    const esConfianza = caso === "confianza";
    const topeConfianzaMensual = esConfianza && salarioMaxPlanta > 0 ? salarioMaxPlanta * (1 + cfg.confianzaExtra) : 0;
    const confianzaTopada = topeConfianzaMensual > 0 && num(salarioMensual) > topeConfianzaMensual;
    const sd = confianzaTopada ? topeConfianzaMensual / 30 : sdReal;
    const confianzaSinDato = esConfianza && salarioMaxPlanta === 0;
    const misDias = Math.min(num(dias), 366);
    const misSalarios = sd * misDias;

    // Los totales de la empresa te incluyen a ti: nunca pueden ser menores que lo tuyo.
    const dTot = Math.max(num(diasTotales), misDias);
    const sTot = Math.max(num(salariosTotales), misSalarios);
    const ajustado = num(diasTotales) < misDias || num(salariosTotales) < misSalarios;

    const factorDias = dTot > 0 ? mitad / dTot : 0;
    const factorSalarios = sTot > 0 ? mitad / sTot : 0;
    const parteDias = factorDias * misDias;
    const parteSalarios = factorSalarios * misSalarios;
    const calculada = parteDias + parteSalarios;

    const tresMeses = cfg.topeMeses * 30 * sd;
    const promedio = num(promedio3);
    const tope = Math.max(tresMeses, promedio);
    const topeUsado = promedio > tresMeses ? "promedio" : "tresMeses";
    const conTope = Math.min(calculada, tope);
    const topado = calculada > tope;

    let derecho = true, razon = "";
    if (caso === "directivo") { derecho = false; razon = "directivo"; }
    else if (caso === "hogar") { derecho = false; razon = "hogar"; }
    else if (caso === "eventual" && misDias < cfg.diasEventual) { derecho = false; razon = "eventual"; }

    const total = derecho ? conTope : 0;
    const exento = cfg.exentoUma * Calc.DATOS.uma;
    return {
      renta, recortado, repartir, mitad, sd, sdReal, topeConfianzaMensual, confianzaTopada, confianzaSinDato,
      misDias, misSalarios, diasTotales: dTot, salariosTotales: sTot, ajustado,
      factorDias, factorSalarios, parteDias, parteSalarios, calculada,
      tresMeses, promedio, tope, topeUsado, topado, derecho, razon,
      total, exento, exentoAplicado: Math.min(total, exento), gravado: Math.max(0, total - exento)
    };
  }

  function limiteDobles(anio) { return porAnio(DATOS.horasExtra.dobles, anio); }
  function jornadaSemanal(anio) { return porAnio(DATOS.horasExtra.jornadaSemanal, anio); }

  // Pago de horas extra de una semana. Arts. 66 a 68 LFT (reforma DOF 1 may 2026, pendiente de cotejo).
  // Valor de la hora = salario diario (sueldo mensual / 30) entre las horas de la jornada diaria.
  // Las primeras horas hasta el límite del año se pagan al doble; las demás, al triple.
  // Jornada vacía o 0: no se calcula (sinJornada). Entre 0 y 1 hora, o más de 24: se acota y se avisa.
  function horasExtra({ salarioMensual, horasJornada = 8, horas, anio = Calc.DATOS.anio }) {
    const cfg = DATOS.horasExtra;
    const recortado = num(salarioMensual) > DATOS.maximos.sueldoMensual;
    const sd = acotado(salarioMensual, DATOS.maximos.sueldoMensual) / 30;
    const jEscrita = num(horasJornada);
    const jornada = jEscrita === 0 ? 0 : Math.min(Math.max(jEscrita, cfg.jornadaMin), cfg.jornadaMax);
    const jornadaAcotada = jEscrita !== jornada;
    const valorHora = jornada > 0 ? sd / jornada : 0;
    const h = Math.min(num(horas), cfg.maxHorasSemana);
    const limite = limiteDobles(anio);
    const maximo = limite + cfg.triplesMax;
    const dobles = Math.min(h, limite);
    const triples = Math.max(0, h - limite);
    const pagoDobles = dobles * valorHora * 2;
    const pagoTriples = triples * valorHora * 3;
    const total = pagoDobles + pagoTriples;
    // ISR (art. 93 fr. I LISR, criterio del SAT con UMA). Solo las horas dobles están dentro del límite de la ley.
    // Quien gana el salario mínimo general (o menos) no paga ISR por sus horas dobles; los demás, por la mitad,
    // hasta 5 UMA por semana. Las triples pagan ISR completo.
    const exentoTopeSemana = cfg.exentoUmaSemana * Calc.DATOS.uma;
    const ganaMinimo = sd > 0 && Math.round(sd * 100) <= Math.round(Calc.DATOS.salarioMinimo.general * 100);
    const exento = ganaMinimo ? pagoDobles : Math.min(pagoDobles * cfg.exentoPorcentaje, exentoTopeSemana);
    return {
      sd, recortado, jornada, sinJornada: jornada === 0, jornadaAcotada, valorHora,
      horaDoble: 2 * valorHora, horaTriple: 3 * valorHora,
      horas: h, limite, maximo, excede: h > maximo, dobles, triples, pagoDobles, pagoTriples, total,
      jornadaSemanal: jornadaSemanal(anio),
      exentoTopeSemana, exentoTopeSemanaSalarioMinimo: cfg.exentoUmaSemana * Calc.DATOS.salarioMinimo.general,
      ganaMinimo, exento, gravado: Math.max(0, total - exento)
    };
  }

  const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  // Días de aguinaldo que escribe la persona: de 0 a 365. Lo que pase de 365 se recorta y se avisa.
  function diasAguinaldo(dias) {
    const d = num(dias);
    return { dias: Math.min(d, 365), acotado: d > 365 };
  }

  // Aguinaldo de una pensión del IMSS o del ISSSTE. tipo: imss73, issste, imssInvalidez, imssRiesgo, imss97 o bienestar.
  // Pensión diaria = pensión mensual / 30; aguinaldo = pensión diaria x días (en imss73, 30 días = una mensualidad).
  function aguinaldoPension({ pensionMensual, tipo = "imss73" }) {
    const cfg = DATOS.aguinaldo;
    const clave = Object.prototype.hasOwnProperty.call(cfg.pensiones, tipo) ? tipo : "imss73";
    const regla = cfg.pensiones[clave];
    const recortado = num(pensionMensual) > DATOS.maximos.sueldoMensual;
    const pension = acotado(pensionMensual, DATOS.maximos.sueldoMensual);
    const diaria = pension / 30;
    const total = diaria * regla.dias;
    const partes = regla.partes.map(p => ({ cuando: p.cuando, monto: total * p.parte }));
    const exentoPensionMensual = Calc.redondear(cfg.pensionExentaUma * Calc.DATOS.umaMensual);
    return {
      tipo: clave, dias: regla.dias, minimo: !!regla.minimo, derecho: regla.dias > 0,
      pension, recortado, diaria, total, partes, exentoPensionMensual, pasaExento: pension > exentoPensionMensual
    };
  }

  // Aguinaldo de una persona que trabaja para el gobierno federal (art. 42 Bis LFTSE): al menos 40 días, proporcional
  // si entró durante el año (decreto anual, art. séptimo), mitad antes del 15 de diciembre y mitad a más tardar el 15 de enero.
  // ingreso: Date; si falta o es anterior al año, cuenta el año completo.
  function aguinaldoGobierno({ salarioMensual, ingreso, dias = DATOS.aguinaldo.gobiernoDias, anio = Calc.DATOS.anio }) {
    const cfg = DATOS.aguinaldo;
    const recortado = num(salarioMensual) > DATOS.maximos.sueldoMensual;
    const sueldo = acotado(salarioMensual, DATOS.maximos.sueldoMensual);
    const d = diasAguinaldo(dias);
    const inicio = new Date(anio, 0, 1);
    const ing = ingreso instanceof Date && !isNaN(ingreso) ? ingreso : inicio;
    const r = Calc.aguinaldo({ salarioMensual: sueldo, ingreso: ing, diasAguinaldo: d.dias, anio });
    const primera = r.bruto * cfg.gobiernoPrimeraParte;
    return Object.assign({}, r, {
      sueldo, recortado, dias: d.dias, diasAcotado: d.acotado, menosDeLey: d.dias < cfg.gobiernoDias,
      entraDespues: r.trabajados === 0, primera, segunda: r.bruto - primera,
      exentoAplicado: Math.min(r.bruto, r.exento)
    });
  }

  // Aguinaldo proporcional al dejar el trabajo (art. 87 LFT, segundo párrafo): cuenta del 1 de enero del año de salida
  // (o de la fecha de entrada, si fue después) al último día trabajado. ingreso y salida: Date ya revisadas.
  function aguinaldoSalida({ salarioMensual, ingreso, salida, dias = DATOS.aguinaldo.diasLey }) {
    const recortado = num(salarioMensual) > DATOS.maximos.sueldoMensual;
    const sueldo = acotado(salarioMensual, DATOS.maximos.sueldoMensual);
    const d = diasAguinaldo(dias);
    const valida = x => x instanceof Date && !isNaN(x);
    if (!valida(salida)) salida = new Date(Calc.DATOS.anio, 11, 31);
    if (!valida(ingreso)) ingreso = new Date(salida.getFullYear(), 0, 1);
    const r = Calc.aguinaldo({ salarioMensual: sueldo, ingreso, diasAguinaldo: d.dias, anio: salida.getFullYear(), corte: salida });
    return Object.assign({}, r, {
      sueldo, recortado, dias: d.dias, diasAcotado: d.acotado, menosDeLey: d.dias < DATOS.aguinaldo.diasLey,
      anio: salida.getFullYear(), exentoAplicado: Math.min(r.bruto, r.exento)
    });
  }

  // Fechas y multas del aguinaldo de un año. Último día: el 19 de diciembre ("antes del día veinte", art. 87 LFT).
  // Último día hábil: el último de lunes a viernes antes del 20. Para reclamar hay un año (art. 516 LFT): la PROFEDET y la
  // prensa lo cuentan hasta el 20 de diciembre del año siguiente. Multa: de 50 a 5,000 UMA (art. 1002 LFT).
  function calendarioAguinaldo(anio = Calc.DATOS.anio) {
    const a = Math.round(num(anio)) || Calc.DATOS.anio;
    const cfg = DATOS.aguinaldo;
    const veinte = new Date(a, 11, cfg.diaLimite);
    const limite = new Date(a, 11, cfg.diaLimite - 1);
    const habil = new Date(limite);
    while (habil.getDay() === 0 || habil.getDay() === 6) habil.setDate(habil.getDate() - 1);
    return {
      anio: a, veinte, diaVeinte: DIAS_SEMANA[veinte.getDay()], limite, diaLimite: DIAS_SEMANA[limite.getDay()],
      ultimoHabil: habil, diaHabil: DIAS_SEMANA[habil.getDay()], reclamarHasta: new Date(a + 1, 11, cfg.diaLimite),
      multaMin: Calc.redondear(cfg.multaUma.min * Calc.DATOS.uma), multaMax: Calc.redondear(cfg.multaUma.max * Calc.DATOS.uma)
    };
  }

  const api = {
    DATOS, ptu, horasExtra, limiteDobles, jornadaSemanal,
    aguinaldoPension, aguinaldoGobierno, aguinaldoSalida, calendarioAguinaldo
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Trabajo = api;
})(this);
