// Cálculos de la sección Trabajo (reparto de utilidades y horas extra) de Cuentas Claras MX.
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

  const api = { DATOS, ptu, horasExtra, limiteDobles, jornadaSemanal };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Trabajo = api;
})(this);
