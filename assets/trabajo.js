// Cálculos de la sección Trabajo (reparto de utilidades, horas extra, temporada de aguinaldo e incapacidad del IMSS)
// de Cuentas Claras MX.
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
    // Salario mínimo. Los valores vigentes viven en Calc.DATOS.salarioMinimo (2026: 315.04 general y 440.87 en la zona
    // libre de la frontera norte; EY, Por Esto, Fox Sports, ViveUSA). El de 2027 lo fija la CONASAMI en diciembre de 2026
    // y rige desde el 1 ene 2027: mientras no se anuncie, publicado2027 es false y la página solo muestra escenarios.
    // AL ANUNCIARSE: poner publicado2027: true, las cifras en anuncio2027 y actualizar Calc.DATOS (anio y salarioMinimo).
    salarioMinimo: {
      publicado2027: false,
      anuncio2027: { general: 0, frontera: 0, fecha: "" },
      // Escenarios de prensa, NO oficiales: 12% y 13% (Fox Sports, 15 oct 2026, "escenarios hipotéticos").
      escenarios: [12, 13],
      // Meta del gobierno: que el salario mínimo alcance para 2.5 canastas básicas en 2030 (Uno TV, ViveUSA).
      metaCanastas: 2.5,
      // Historial del salario mínimo general (pesos diarios, desde el 1 de enero de cada año). Expansión (1 dic 2022),
      // ADN40 (19 nov 2025), N+ (2024) y EY/Por Esto (2026). 2021: 123.22 x 1.15 = 141.70.
      historialGeneral: { 2019: 102.68, 2020: 123.22, 2021: 141.70, 2022: 172.87, 2023: 207.44, 2024: 248.93, 2025: 278.80, 2026: 315.04 },
      // Zona libre de la frontera norte: Expansión y N+ (2023 y 2024), ADN40 y Por Esto (2025), EY (2026).
      historialFrontera: { 2023: 312.41, 2024: 374.89, 2025: 419.88, 2026: 440.87 },
      // Para pasar de diario a semana, quincena y mes: art. 89 LFT (semana entre 7, mes entre 30). El mes promedio
      // (365 / 12 = 30.4167 días) es el que usan EY y la prensa: 315.04 x 365 / 12 = 9,582.47.
      diasSemana: 7, diasQuincena: 15, diasMes: 30, diasAnio: 365
    },
    // Días de descanso obligatorio, art. 74 LFT: 1 ene; primer lunes de febrero (5 feb); tercer lunes de marzo (21 mar);
    // 1 may; 16 sep; tercer lunes de noviembre (20 nov); 1 oct cada seis años, con el cambio de Presidente (2024, 2030);
    // 25 dic; y el día de la jornada electoral en elecciones ordinarias federales y locales (fr. IX).
    // Art. 75 LFT: si trabajas ese día te pagan, además de tu salario del día, un salario doble (pago triple).
    // Art. 71 LFT: si además es domingo, prima dominical de al menos 25% del salario de un día ordinario.
    // Revisado el 21 oct 2026 con Expansión (27 abr 2026), La Verdad Noticias y El Imparcial; diputados.gob.mx no abrió.
    descanso: {
      // Elecciones ordinarias federales: domingo 6 de junio de 2027 (Expansión, 11 sep 2026; ADN40, 10 sep 2026; La Verdad).
      elecciones: { 2027: "2027-06-06" },
      // Año en que hubo cambio de Presidente (el siguiente es cada seis años).
      transmisionBase: 2024,
      pagoAdicional: 2,
      primaDominical: 0.25
    },
    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    // Incapacidad temporal del IMSS (subsidio en dinero).
    // Enfermedad general: 60% del último salario diario de cotización desde el 4o. día, hasta 52 semanas y 26 más de
    // prórroga (arts. 96 y 98 LSS). Pide 4 semanas cotizadas justo antes de enfermarte; si eres eventual, 6 en los
    // últimos 4 meses (art. 97). Riesgo de trabajo: 100% del salario con que cotizabas desde el primer día, sin semanas
    // mínimas, hasta 52 semanas (art. 58 fr. I). Fuentes que coinciden: Expansión (8 oct 2026), calcu.mx (jul 2026),
    // Rivenza (jun 2026) y Cofide (jun 2026).
    // Pago en cuenta bancaria obligatorio desde el 6 oct 2026 si el pago llega a 9 salarios mínimos (enfermedad),
    // 16 (riesgo) o 99 (maternidad): acuerdo del Consejo Técnico del IMSS, DOF 5 oct 2026 (Expansión y Consultor Salud).
    incapacidad: {
      enfermedad: { porcentaje: 0.60, diasEspera: 3, maxDias: (52 + 26) * 7, semanas: 4, semanasEventual: 6, cuentaSm: 9 },
      riesgo: { porcentaje: 1, diasEspera: 0, maxDias: 52 * 7, semanas: 0, cuentaSm: 16 }
    },

    // Liquidación por despido injustificado (trabajo/liquidacion-despido-injustificado). Revisado el 4 nov 2026.
    // Indemnización: 3 meses de salario (art. 123 apartado A fr. XXII constitucional y art. 48 LFT) con salario integrado
    // (art. 84 y 89 LFT). 20 días por año (art. 50 fr. II LFT): solo cuando el patrón se niega a reinstalarte (art. 49 y 947)
    // o cuando tú rescindes por falta del patrón (art. 52); no en todo despido (El Conta, 2 ene 2026). Muchas calculadoras
    // los suman siempre (Factorial, FiniquitoJusto, SDV): por eso la página da el total con y sin ellos.
    // ISR: exentos 90 UMA por cada año de servicio; la fracción de más de 6 meses cuenta como año (art. 93 fr. XIII LISR;
    // Buk, ago 2026; SDV). Sobre lo gravado se retiene con la tasa del último sueldo mensual ordinario (ISR de la tarifa del
    // art. 96 entre el sueldo; art. 95 y 96 LISR; El Financiero y SDV). Plazo para demandar: 2 meses (art. 518 LFT).
    liquidacion: { mesesIndemnizacion: 3, diasPorAnio: 20, exentoUmaPorAnio: 90 },

    // Nómina semanal y quincenal (trabajo/nomina-semanal-quincenal). Tarifas del art. 96 LISR para periodos de 7 y 15 días:
    // Anexo 8 de la RMF 2026, DOF 28 dic 2025, apartado B fracciones II y IV. Coinciden Praxium (12 sep 2026) y
    // El Contribuyente; pendiente cotejar con el PDF del SAT (red bloqueada). [límite inferior, límite superior, cuota fija, %].
    // Subsidio para el empleo en periodos menores a un mes: monto mensual / 30.4 x días del periodo (decreto DOF 1 may 2024,
    // reforma 31 dic 2025; IDC, 2 ene 2026, y Contador MX). El decreto da el tope de ingresos solo al mes ($11,492.66):
    // para la semana y la quincena lo pasamos a mes con 30.4 días (estimado, el decreto no lo detalla).
    nomina: {
      semanal: [
        [0.01, 194.46, 0, 1.92],
        [194.47, 1650.67, 3.71, 6.40],
        [1650.68, 2900.87, 96.95, 10.88],
        [2900.88, 3372.11, 232.96, 16.00],
        [3372.12, 4037.32, 308.35, 17.92],
        [4037.33, 8142.75, 427.56, 21.36],
        [8142.76, 12834.08, 1304.45, 23.52],
        [12834.09, 24502.45, 2407.86, 30.00],
        [24502.46, 32669.91, 5908.35, 32.00],
        [32669.92, 98009.66, 8521.94, 34.00],
        [98009.67, Infinity, 30737.49, 35.00]
      ],
      quincenal: [
        [0.01, 416.70, 0, 1.92],
        [416.71, 3537.15, 7.95, 6.40],
        [3537.16, 6216.15, 207.75, 10.88],
        [6216.16, 7225.95, 499.20, 16.00],
        [7225.96, 8651.40, 660.75, 17.92],
        [8651.41, 17448.75, 916.20, 21.36],
        [17448.76, 27501.60, 2795.25, 23.52],
        [27501.61, 52505.25, 5159.70, 30.00],
        [52505.26, 70006.95, 12660.75, 32.00],
        [70006.96, 210020.70, 18261.30, 34.00],
        [210020.71, Infinity, 65866.05, 35.00]
      ],
      dias: { semanal: 7, quincenal: 15 },
      diasSubsidio: 30.4
    },

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

  // ---------- Salario mínimo ----------

  // Lo que gana a la semana, quincena y mes quien cobra el salario mínimo. zona: "general" o "frontera".
  // aumento (%): escenario para 2027 (0 = salario vigente). El salario diario se redondea a centavos, como lo publica la CONASAMI.
  function salarioMinimoPeriodos({ zona = "general", aumento = 0, diario } = {}) {
    const cfg = DATOS.salarioMinimo;
    const z = zona === "frontera" ? "frontera" : "general";
    const base = diario !== undefined ? num(diario) : Calc.DATOS.salarioMinimo[z];
    const pct = Math.min(num(aumento), 100);
    const d = Calc.redondear(base * (1 + pct / 100));
    return {
      zona: z, base, aumento: pct, aumentoAcotado: num(aumento) > 100, diario: d, alza: Calc.redondear(d - base),
      semana: Calc.redondear(d * cfg.diasSemana), quincena: Calc.redondear(d * cfg.diasQuincena),
      mes30: Calc.redondear(d * cfg.diasMes), mesPromedio: Calc.redondear(d * cfg.diasAnio / 12),
      anio: Calc.redondear(d * cfg.diasAnio)
    };
  }

  // Historial con el aumento de cada año, en %, contra el año anterior (el primer año no tiene aumento).
  function historialSalarioMinimo(tabla = DATOS.salarioMinimo.historialGeneral) {
    const anios = Object.keys(tabla).map(Number).sort((a, b) => a - b);
    return anios.map((a, i) => ({ anio: a, diario: tabla[a], aumento: i ? tabla[a] / tabla[anios[i - 1]] - 1 : 0 }));
  }

  // ---------- Días de descanso obligatorio ----------

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  // n-ésimo lunes de un mes (mes de 0 a 11).
  function lunes(anio, mes, n) {
    const d = new Date(anio, mes, 1);
    const primero = 1 + ((8 - d.getDay()) % 7);
    return new Date(anio, mes, primero + 7 * (n - 1));
  }

  // Días de descanso obligatorio de un año (art. 74 LFT), en orden. Cada uno: { fecha, dia, texto, motivo, fraccion }.
  function diasDescanso(anio) {
    const a = Math.round(num(anio)) || Calc.DATOS.anio;
    const cfg = DATOS.descanso;
    const lista = [
      { fecha: new Date(a, 0, 1), motivo: "Año Nuevo", fraccion: "I" },
      { fecha: lunes(a, 1, 1), motivo: "Día de la Constitución (5 de febrero)", fraccion: "II" },
      { fecha: lunes(a, 2, 3), motivo: "Natalicio de Benito Juárez (21 de marzo)", fraccion: "III" },
      { fecha: new Date(a, 4, 1), motivo: "Día del Trabajo", fraccion: "IV" },
      { fecha: new Date(a, 8, 16), motivo: "Día de la Independencia", fraccion: "V" },
      { fecha: lunes(a, 10, 3), motivo: "Revolución Mexicana (20 de noviembre)", fraccion: "VI" },
      { fecha: new Date(a, 11, 25), motivo: "Navidad", fraccion: "VIII" }
    ];
    if (a >= cfg.transmisionBase && (a - cfg.transmisionBase) % 6 === 0) {
      lista.push({ fecha: new Date(a, 9, 1), motivo: "Cambio de Presidente de la República", fraccion: "VII" });
    }
    if (cfg.elecciones[a]) {
      const [y, m, d] = cfg.elecciones[a].split("-").map(Number);
      lista.push({ fecha: new Date(y, m - 1, d), motivo: "Jornada electoral (elecciones federales)", fraccion: "IX" });
    }
    return lista.sort((x, y) => x.fecha - y.fecha).map(x => Object.assign(x, {
      dia: DIAS_SEMANA[x.fecha.getDay()],
      texto: `${DIAS_SEMANA[x.fecha.getDay()]} ${x.fecha.getDate()} de ${MESES[x.fecha.getMonth()]} de ${x.fecha.getFullYear()}`,
      domingo: x.fecha.getDay() === 0
    }));
  }

  // Los que faltan de un año a partir de una fecha (incluida).
  function diasDescansoPendientes(desde) {
    const d = desde instanceof Date && !isNaN(desde) ? desde : new Date(Calc.DATOS.anio, 0, 1);
    const hoy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return diasDescanso(d.getFullYear()).filter(x => x.fecha >= hoy);
  }

  // Cuánto te deben si trabajas un día de descanso obligatorio (art. 75 LFT): tu salario normal del día más un salario doble.
  // monto y periodo: lo que ganas por día, semana, quincena o mes (art. 89 LFT: semana entre 7; quincena entre 15; mes entre 30).
  // domingo: si el día cae en domingo, se suma la prima dominical (art. 71 LFT, al menos 25%).
  const DIVISOR = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 };
  function pagoDiaFestivo({ monto, periodo = "diario", dias = 1, domingo = false }) {
    const cfg = DATOS.descanso;
    const div = DIVISOR[periodo] || 1;
    const recortado = num(monto) > DATOS.maximos.sueldoMensual;
    const sd = acotado(monto, DATOS.maximos.sueldoMensual) / div;
    const n = Math.min(Math.round(num(dias)), 366);
    const normal = sd * n;
    const adicional = sd * cfg.pagoAdicional * n;
    const prima = domingo ? sd * cfg.primaDominical * n : 0;
    const extra = adicional + prima;
    return {
      sd, dias: n, recortado, diasAcotado: Math.round(num(dias)) > 366, normal, adicional, prima, extra,
      total: normal + extra, porDia: n ? (normal + extra) / n : 0
    };
  }

  // ---------- UMA (trabajo/uma-2027) ----------
  // Ley para Determinar el Valor de la UMA (DOF 30 dic 2016): art. 4, diaria = la del año anterior x (1 + inflación
  // anual del INPC de diciembre del año anterior); mensual = diaria x 30.4; anual = mensual x 12. Art. 5: el INEGI la
  // publica en el DOF en los primeros 10 días de enero y rige desde el 1 de febrero.
  // 2026: 117.31 / 3,566.22 / 42,794.64 (INEGI, DOF 9 ene 2026; UnoTV, Littler). 2025: 113.14.
  // La UMA 2027 NO existe todavía: se publica en enero de 2027. umaEstimada solo hace un escenario con la inflación
  // que escriba la persona. Referencia (no es la de diciembre): 3.62% anual en la 1a. quincena de octubre de 2026
  // (INEGI; La Razón, Excélsior, La Jornada, 22 y 23 oct 2026).
  const UMA = { anteriores: { 2025: 113.14 }, diasMes: 30.4, meses: 12, inflacionReferencia: 3.62, maxInflacion: 50 };

  function valoresUma(diaria) {
    const d = Calc.redondear(num(diaria));
    const mensual = Calc.redondear(d * UMA.diasMes);
    return { diaria: d, mensual, anual: Calc.redondear(mensual * UMA.meses) };
  }

  // Convierte UMA a pesos o pesos a UMA. de: "uma" o "pesos"; periodo: "diaria", "mensual" o "anual".
  function convertirUma({ cantidad, de = "uma", periodo = "diaria", uma = Calc.DATOS.uma } = {}) {
    const recortado = num(cantidad) > DATOS.maximos.montoEmpresa;
    const c = acotado(cantidad, DATOS.maximos.montoEmpresa);
    const v = valoresUma(uma > 0 ? uma : Calc.DATOS.uma);
    const p = ["diaria", "mensual", "anual"].includes(periodo) ? periodo : "diaria";
    const unidad = v[p];
    const aPesos = de !== "pesos";
    const resultado = aPesos ? Calc.redondear(c * unidad) : (unidad ? Math.round(c / unidad * 10000) / 10000 : 0);
    return { cantidad: c, recortado, de: aPesos ? "uma" : "pesos", periodo: p, unidad, valores: v, resultado };
  }

  // Escenario de la UMA 2027 con una inflación supuesta (en %). No es la cifra oficial.
  function umaEstimada(inflacion = UMA.inflacionReferencia, base = Calc.DATOS.uma) {
    const inf = Math.min(num(inflacion), UMA.maxInflacion);
    const v = valoresUma(base * (1 + inf / 100));
    return Object.assign({ inflacion: inf, acotada: num(inflacion) > UMA.maxInflacion, alza: Calc.redondear(v.diaria - base), estimada: true }, v);
  }

  // Subsidio del IMSS por incapacidad temporal. tipo: "enfermedad" (enfermedad general o accidente fuera del trabajo)
  // o "riesgo" (accidente o enfermedad de trabajo, también en el trayecto). dato: "sueldo" (sueldo mensual bruto; el SBC
  // se estima con el factor de integración mínimo) o "sbc" (salario base de cotización diario del recibo).
  // dias: días de incapacidad que te dieron. semanas: semanas cotizadas justo antes (vacío = no sabe). eventual: si eres
  // trabajador eventual (la regla es 6 semanas en los últimos 4 meses). El SBC no baja del salario mínimo de la zona
  // ni pasa de 25 UMA (art. 28 LSS).
  function incapacidadImss({ tipo = "enfermedad", dato = "sueldo", monto, dias, semanas, eventual = false, zona = "general" } = {}) {
    const cfg = DATOS.incapacidad[tipo === "riesgo" ? "riesgo" : "enfermedad"];
    const esRiesgo = tipo === "riesgo";
    const esSbc = dato === "sbc";
    const avisos = [];
    const capt = acotado(monto, esSbc ? 1e6 : DATOS.maximos.sueldoMensual);
    if (!capt) return { ok: false, error: esSbc ? "Escribe tu salario base de cotización diario." : "Escribe tu sueldo mensual." };
    const fi = Calc.DATOS.factorIntegracion;
    const salarioMinimo = Calc.salarioMinimoZona(zona === "frontera" ? "frontera" : "general");
    const tope = Calc.redondear(Calc.DATOS.imss.topeUma * Calc.DATOS.uma);
    const sbcCapturado = Calc.redondear(esSbc ? capt : capt / 30 * fi);
    const sbc = Math.min(Math.max(sbcCapturado, salarioMinimo), tope);
    const conPiso = sbcCapturado < salarioMinimo, topado = sbcCapturado > tope;
    const salarioDiario = esSbc ? capt / fi : capt / 30;
    const d = Math.floor(num(dias));
    const diasUsados = Math.min(d, cfg.maxDias);
    if (d > cfg.maxDias) avisos.push("maxDias");
    const espera = Math.min(diasUsados, cfg.diasEspera);
    const diasPagados = diasUsados - espera;
    const pagoDiario = Calc.redondear(sbc * cfg.porcentaje);
    const imss = Calc.redondear(pagoDiario * diasPagados);
    const s = semanas === "" || semanas == null || !Number.isFinite(+semanas) ? null : Math.max(0, Math.floor(+semanas));
    const minimas = esRiesgo ? 0 : (eventual ? cfg.semanasEventual : cfg.semanas);
    const cumple = esRiesgo ? true : (s === null ? null : s >= minimas);
    const recibes = cumple === false ? 0 : imss;
    const sueldoDias = Calc.redondear(salarioDiario * diasUsados);
    return {
      ok: true, tipo: esRiesgo ? "riesgo" : "enfermedad", sbcCapturado, sbc, conPiso, topado, tope, salarioMinimo,
      porcentaje: cfg.porcentaje, dias: diasUsados, diasEspera: espera, diasPagados, pagoDiario, imss,
      semanas: s, minimas, cumple, recibes, salarioDiario, sueldoDias,
      diferencia: Math.max(0, Calc.redondear(sueldoDias - recibes)),
      cuentaBancaria: Calc.redondear(cfg.cuentaSm * Calc.DATOS.salarioMinimo.general), avisos
    };
  }

  // ---------- Liquidación por despido injustificado ----------
  // salarioMensual: sueldo mensual bruto. ingreso y salida: Date ya revisadas (Calc.validarFechas). sdi: salario diario
  // integrado del recibo (opcional; si falta se estima con el aguinaldo y la prima vacacional del año de servicio en curso,
  // como el factor de integración del IMSS). La prima de antigüedad se calcula con Calc.primaAntiguedad (salario base con
  // tope de 2 salarios mínimos). No incluye el finiquito (aguinaldo, vacaciones y días sin pagar) ni salarios caídos.
  function liquidacionDespido({ salarioMensual, ingreso, salida, sdi, diasAguinaldo = 15, primaVacacional = 0.25, zona = "general" } = {}) {
    const cfg = DATOS.liquidacion;
    const recortado = num(salarioMensual) > DATOS.maximos.sueldoMensual;
    const sueldo = acotado(salarioMensual, DATOS.maximos.sueldoMensual);
    if (!sueldo) return { ok: false, error: "Escribe tu sueldo mensual para calcular." };
    const sd = sueldo / 30;
    const t = Calc.tiempoServicio(ingreso, salida);
    const diasVac = Calc.diasVacaciones(t.anios + 1);
    const aguinaldoDias = Math.min(num(diasAguinaldo) || 15, 365);
    const factor = 1 + (aguinaldoDias + diasVac * primaVacacional) / 365;
    const sdiCapturado = acotado(sdi, 1e6);
    const sdiUsado = Calc.redondear(sdiCapturado || sd * factor);
    const tresMeses = Calc.redondear(cfg.mesesIndemnizacion * 30 * sdiUsado);
    const veinteDias = Calc.redondear(cfg.diasPorAnio * t.total * sdiUsado);
    const prima = Calc.primaAntiguedad({ salarioMensual: sueldo, ingreso, salida, motivo: "despido", zona });
    const primaMonto = Calc.redondear(prima.prima);
    const basico = Calc.redondear(tresMeses + primaMonto);
    const conVeinte = Calc.redondear(basico + veinteDias);
    // ISR: 90 UMA por año de servicio; más de 6 meses cuenta como año. Con menos de un año, la parte proporcional (estimado).
    const aniosExento = t.anios + (t.fraccion > 0.5 ? 1 : 0) || t.fraccion;
    const exento = Calc.redondear(cfg.exentoUmaPorAnio * Calc.DATOS.uma * aniosExento);
    const tasa = Calc.isrMensual(sueldo).isr / sueldo;
    const isr = total => {
      const gravado = Math.max(0, Calc.redondear(total - exento));
      const retencion = Calc.redondear(gravado * tasa);
      return { total, exento: Math.min(exento, total), gravado, retencion, neto: Calc.redondear(total - retencion) };
    };
    return {
      ok: true, sueldo, recortado, sd, anios: t.anios, fraccion: t.fraccion, antiguedad: t.total, diasVac, factor,
      sdiEstimado: !sdiCapturado, sdi: sdiUsado, tresMeses, veinteDias, prima, primaMonto, basico, conVeinte,
      aniosExento, exentoTotal: exento, tasa, isrBasico: isr(basico), isrConVeinte: isr(conVeinte)
    };
  }

  // ---------- Nómina semanal y quincenal ----------
  // ISR con una tarifa [límite inferior, límite superior, cuota fija, %].
  function isrTarifa(tabla, base) {
    const b = Math.max(0, +base || 0);
    if (b < tabla[0][0]) return 0;
    let i = tabla.length - 1;
    while (i > 0 && b < tabla[i][0]) i--;
    const [li, , cuota, pct] = tabla[i];
    return Calc.redondear((b - li) * pct / 100 + cuota);
  }

  // Sueldo neto de una semana y de una quincena. monto y periodo: lo que ganas por día, semana, quincena o mes
  // (art. 89 LFT: semana entre 7, quincena entre 15, mes entre 30). Semana = salario diario x 7; quincena = x 15.
  // ISR con la tarifa del periodo menos el subsidio del periodo; IMSS obrero con el SBC estimado por los días del periodo.
  // Quien gana el salario mínimo de su zona no paga ISR ni IMSS (art. 96 LISR y art. 36 LSS).
  function nominaPeriodos({ monto, periodo = "mensual", zona = "general", ganaMinimo = false } = {}) {
    const cfg = DATOS.nomina;
    const div = DIVISOR[periodo] || 30;
    const recortado = num(monto) > DATOS.maximos.sueldoMensual;
    const capt = acotado(monto, DATOS.maximos.sueldoMensual);
    const z = zona === "frontera" ? "frontera" : "general";
    const sd = capt / div;
    const salarioMinimo = Calc.salarioMinimoZona(z);
    const enMinimo = sd > 0 && Math.round(sd * 100) <= Math.round(salarioMinimo * 100);
    // Casilla "gano el salario mínimo": cubre la cifra mensual de la CONASAMI (mínimo x 365 / 12) y los meses de 31 días.
    const minimo = enMinimo || (!!ganaMinimo && sd > 0 && Math.round(sd * 3000) <= Math.round(salarioMinimo * 3100));
    const ganaMinimoNoAplica = !!ganaMinimo && sd > 0 && !minimo;
    const sub = Calc.DATOS.subsidioEmpleo;
    const mensualEquivalente = Calc.redondear(sd * cfg.diasSubsidio);
    const conSubsidio = sd > 0 && mensualEquivalente <= sub.tope;
    const sbcEstimado = sd * Calc.DATOS.factorIntegracion;
    const calc = clave => {
      const dias = cfg.dias[clave];
      const bruto = Calc.redondear(sd * dias);
      const isrT = isrTarifa(cfg[clave], bruto);
      const subsidio = conSubsidio ? Calc.redondear(sub.mensual / cfg.diasSubsidio * dias) : 0;
      const subsidioAplicado = Math.min(subsidio, isrT);
      const isrRetenido = minimo ? 0 : Calc.redondear(isrT - subsidioAplicado);
      const imss = Calc.cuotasImssObrero(sbcEstimado, z, dias);
      const imssObrero = minimo ? 0 : imss.mensual;
      const descuentos = Calc.redondear(isrRetenido + imssObrero);
      return { dias, bruto, isrTarifa: isrT, subsidio, subsidioAplicado, isrRetenido, imssObrero, descuentos, neto: Calc.redondear(bruto - descuentos) };
    };
    const mes = Calc.sueldoNeto({ salarioMensual: Calc.redondear(sd * 30), zona: z, ganaMinimo: minimo });
    return {
      sd, recortado, zona: z, salarioMinimo, soloMinimo: minimo, ganaMinimoNoAplica, debajoMinimo: sd > 0 && sd < salarioMinimo,
      mensualEquivalente, conSubsidio, sbc: Calc.cuotasImssObrero(sbcEstimado, z).sbc,
      semana: calc("semanal"), quincena: calc("quincenal"), mes: { bruto: mes.bruto, neto: mes.neto, descuentos: mes.descuentos }
    };
  }

  const api = {
    DATOS, ptu, horasExtra, limiteDobles, jornadaSemanal, liquidacionDespido, isrTarifa, nominaPeriodos,
    aguinaldoPension, aguinaldoGobierno, aguinaldoSalida, calendarioAguinaldo,
    salarioMinimoPeriodos, historialSalarioMinimo, diasDescanso, diasDescansoPendientes, pagoDiaFestivo,
    UMA, valoresUma, convertirUma, umaEstimada, incapacidadImss
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Trabajo = api;
})(this);
