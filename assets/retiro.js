// Cálculos de la sección Retiro e IMSS de Cuentas Claras MX: proyección de la Afore, semanas cotizadas
// y pensión de la Ley 73. Funciones puras, sin datos personales: todo se calcula en el navegador de la persona.
// En el navegador carga antes ../../assets/calc.js (UMA, salario mínimo y factor de integración vienen de Calc.DATOS).
//
// Nota de fuentes (oct 2026): el DOF, la Cámara de Diputados, el IMSS y la CONSAR no se pudieron abrir desde
// la red de trabajo. Cada cifra se confirmó con al menos dos fuentes secundarias que coinciden entre sí y
// queda pendiente cotejarla con el texto oficial.
(function (raiz) {
  const Calc = (typeof module !== "undefined" && module.exports) ? require("./calc.js") : raiz.Calc;

  const DATOS = {
    // ---------- Aportaciones a la cuenta individual de la Afore (Ley 97) ----------
    // Retiro: 2% del salario base de cotización (SBC), lo paga el patrón. Art. 168 fr. I LSS.
    retiroPatron: 2,
    // Cesantía en edad avanzada y vejez (CEAV) que pone el trabajador: 1.125% del SBC. Art. 168 fr. II
    // inciso b) LSS. La reforma de 2020 no la cambió.
    ceavTrabajador: 1.125,
    // CEAV que pone el patrón, en % del SBC, según cuántas UMA gana la persona. Art. 168 fr. II inciso a) LSS
    // y artículo segundo transitorio del decreto de reforma publicado en el DOF el 16 dic 2020: sube cada
    // 1 de enero de 2023 a 2030. Quien cotiza con 1 salario mínimo paga 3.150% todos los años.
    // Columnas: 1.01 SM a 1.50 UMA, 1.51 a 2.00, 2.01 a 2.50, 2.51 a 3.00, 3.01 a 3.50, 3.51 a 4.00, 4.01 UMA o más.
    // Desde 2030 se queda la columna de 2030 (es la tabla del art. 168).
    // Fuentes secundarias que coinciden: El Contribuyente, Fortia, calcu.mx y BDO México. Pendiente cotejar con el DOF.
    ceavPatron: {
      salarioMinimo: 3.150,
      hastaUma: [1.50, 2.00, 2.50, 3.00, 3.50, 4.00, Infinity],
      anios: {
        2026: [3.676, 4.851, 5.556, 6.026, 6.361, 6.613, 7.513],
        2027: [3.807, 5.276, 6.157, 6.745, 7.164, 7.479, 8.603],
        2028: [3.939, 5.701, 6.759, 7.464, 7.967, 8.345, 9.694],
        2029: [4.070, 6.126, 7.360, 8.183, 8.770, 9.211, 10.784],
        2030: [4.202, 6.552, 7.962, 8.902, 9.573, 10.077, 11.875]
      }
    },
    // Cuota social del Gobierno Federal: pesos por cada día cotizado, solo para quien gana hasta 4 UMA.
    // Art. 168 fr. IV LSS (reforma DOF 16 dic 2020, vigente desde el 1 ene 2023). Son los montos BASE de la ley:
    // la misma fracción ordena actualizarlos cada trimestre con el INPC (marzo, junio, septiembre y diciembre),
    // así que el monto que llega en 2026 es mayor. Aquí se usan como un MÍNIMO y las páginas lo dicen así.
    // PENDIENTE: no se pudo confirmar el monto actualizado de 2026 ni la fecha base de la actualización
    // (transitorios del decreto DOF 16 dic 2020): el DOF, diputados.gob.mx y el IMSS no abren desde nuestra red.
    // Fuentes secundarias de la tabla: El Contribuyente y Afore SURA.
    cuotaSocial: {
      salarioMinimo: 10.75,
      hastaUma: [1.50, 2.00, 2.50, 3.00, 3.50, 4.00],
      pesos: [10.00, 9.25, 8.50, 7.75, 7.00, 6.25]
    },
    // Comisión de las Afore en 2026: 0.54% anual sobre el saldo en nueve Afore y 0.52% en PensionISSSTE.
    // Autorizada por la Junta de Gobierno de la CONSAR en noviembre de 2025 (La Jornada 21 nov 2025,
    // El Informador, El Mañana). Pendiente cotejar con el comunicado de la CONSAR.
    comision: 0.54,

    // ---------- Semanas de cotización ----------
    // Ley 97: semanas para la pensión de cesantía o vejez según el año en que se pide. Arts. 154 y 162 LSS y
    // artículo cuarto transitorio del decreto DOF 16 dic 2020: 750 en 2021 y 25 más cada año hasta 1,000 en 2031.
    // Fuentes secundarias que coinciden: afore-en-linea.com.mx, Rivenza, retirartemejor.com, Yo te presto.
    semanasLey97: {
      2021: 750, 2022: 775, 2023: 800, 2024: 825, 2025: 850, 2026: 875,
      2027: 900, 2028: 925, 2029: 950, 2030: 975, 2031: 1000
    },
    // Ley 73: 500 semanas para cesantía (60 años) o vejez (65 años). LSS de 1973 (art. 145 para cesantía) y ficha
    // del trámite IMSS-01-002 del IMSS.
    semanasLey73: 500,
    semanasPorAnio: 52,

    // ---------- Pensión de la Ley 73 ----------
    ley73: {
      // Art. 167 de la LSS de 1973 (texto reformado, el que aplica hoy). Cada fila:
      // [grupo: hasta cuántas veces el salario mínimo, cuantía básica %, incremento anual %].
      // Fuentes secundarias que coinciden: documento del IMSS publicado por el ITAM ("Regimen_73_97_Ejemplos"),
      // artículo de Ra Ximhai (Redalyc), calcu.mx y asesores de pensiones. Pendiente cotejar con el texto oficial.
      tabla: [
        [1.00, 80.00, 0.563], [1.25, 77.11, 0.814], [1.50, 58.18, 1.178], [1.75, 49.23, 1.430],
        [2.00, 42.67, 1.615], [2.25, 37.65, 1.756], [2.50, 33.68, 1.868], [2.75, 30.48, 1.958],
        [3.00, 27.83, 2.033], [3.25, 25.60, 2.096], [3.50, 23.70, 2.149], [3.75, 22.07, 2.195],
        [4.00, 20.65, 2.235], [4.25, 19.39, 2.271], [4.50, 18.29, 2.302], [4.75, 17.30, 2.330],
        [5.00, 16.41, 2.355], [5.25, 15.61, 2.377], [5.50, 14.88, 2.398], [5.75, 14.22, 2.416],
        [6.00, 13.62, 2.433], [Infinity, 13.00, 2.450]
      ],
      // Art. 167: un incremento anual por cada 52 semanas después de las primeras 500. Con 13 a 26 semanas
      // sobrantes se gana medio incremento y con más de 26, uno completo.
      semanasBase: 500,
      // Art. 171 LSS 1973: la pensión de cesantía es un % de la de vejez según la edad al pedirla.
      factorEdad: { 60: 0.75, 61: 0.80, 62: 0.85, 63: 0.90, 64: 0.95, 65: 1 },
      // Arts. 164 y 166 LSS 1973: asignaciones familiares y ayuda asistencial, en % de la cuantía de la pensión.
      // Pareja 15%, cada hijo 10%. Sin pareja ni hijos: 10% por cada padre que dependa de ti. Sin nadie: ayuda de 15%;
      // con un solo padre, ayuda de 10% además de su asignación.
      asignaciones: { pareja: 0.15, hijo: 0.10, padre: 0.10, ayudaSinFamilia: 0.15, ayudaUnPadre: 0.10 },
      // Art. 169 LSS 1973: con asignaciones y ayudas, la pensión no pasa del 100% del salario promedio.
      topeSalarioPromedio: 1,
      // Incremento de 11% a las pensiones: artículo décimo cuarto transitorio del decreto de reforma a la LSS
      // (DOF 20 dic 2001), reformado por el DOF del 5 ene 2004. La pensión mínima de 2026 que publican la AMCP y la
      // prensa ($10,636.54) es justo 1 salario mínimo mensual x 1.11, lo que confirma que se aplica.
      incremento: 1.11,
      diasMes: 365 / 12
    },

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: {
      sueldoMensual: 1e8, saldo: 1e10, voluntaria: 1e6, rendimiento: 10, comision: 3, aumento: 10,
      anios: 70, aniosCobro: 40, densidad: 100, semanas: 5000, hijos: 10, padres: 2, edad: 120
    },
    // Edades que acepta la calculadora de Afore (hoy y al retirarte). Fuera de este rango no se proyecta.
    edades: { min: 15, max: 100 }
  };

  // Número válido, finito y positivo; lo demás cuenta como 0.
  function num(x) {
    const n = +x;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Igual que num(), pero sin pasar de un máximo. Devuelve { valor, acotado }.
  function acotar(x, max) {
    const n = num(x);
    return n > max ? { valor: max, acotado: true } : { valor: n, acotado: false };
  }

  // Valor de una tabla por año: antes del primer año usa el primero; después del último, el último.
  function porAnio(tabla, anio) {
    const anios = Object.keys(tabla).map(Number).sort((a, b) => a - b);
    const a = Math.floor(num(anio)) || anios[0];
    if (a <= anios[0]) return tabla[anios[0]];
    if (a >= anios[anios.length - 1]) return tabla[anios[anios.length - 1]];
    return tabla[a];
  }

  function r2(n) {
    return Math.round(n * 100 + 1e-6) / 100;
  }

  // Salario base de cotización diario a partir del sueldo mensual: sueldo / 30 x factor de integración mínimo,
  // sin bajar del salario mínimo general ni pasar de 25 UMA (art. 28 LSS). Sin sueldo, 0.
  function sbcDiario(sueldoMensual, factor = Calc.DATOS.factorIntegracion) {
    const s = num(sueldoMensual);
    if (!s) return 0;
    const tope = Calc.DATOS.imss.topeUma * Calc.DATOS.uma;
    return Math.min(Math.max(s / 30 * factor, Calc.DATOS.salarioMinimo.general), tope);
  }

  // Cuota patronal de CEAV (% del SBC) para un SBC diario y un año.
  function tasaCeavPatron(sbc, anio = Calc.DATOS.anio) {
    const cfg = DATOS.ceavPatron;
    if (num(sbc) <= Calc.DATOS.salarioMinimo.general) return cfg.salarioMinimo;
    const veces = sbc / Calc.DATOS.uma;
    const fila = cfg.hastaUma.findIndex(h => veces <= h);
    return porAnio(cfg.anios, anio)[fila];
  }

  // Cuota social del gobierno, pesos por día cotizado (montos base de la ley). Más de 4 UMA: 0.
  function cuotaSocialDiaria(sbc) {
    const cfg = DATOS.cuotaSocial;
    const s = num(sbc);
    if (!s) return 0;
    if (s <= Calc.DATOS.salarioMinimo.general) return cfg.salarioMinimo;
    const veces = s / Calc.DATOS.uma;
    const fila = cfg.hastaUma.findIndex(h => veces <= h);
    return fila === -1 ? 0 : cfg.pesos[fila];
  }

  // Aportación obligatoria de un mes a la cuenta individual (sin vivienda), en pesos.
  // Quien gana el salario mínimo no paga su parte: el patrón paga también la cuota del trabajador (art. 36 LSS).
  // Mismo criterio que Calc.sueldoNeto(): salario diario (sueldo / 30) que no pasa del mínimo general.
  // El total no cambia; solo cambia quién la paga.
  function aportacionMensual(sueldoMensual, anio = Calc.DATOS.anio, dias = Calc.DATOS.diasMes) {
    const sueldo = num(sueldoMensual);
    const sbc = sbcDiario(sueldo);
    const mensual = sbc * dias;
    const tasaPatron = sbc ? tasaCeavPatron(sbc, anio) : 0;
    const retiro = mensual * DATOS.retiroPatron / 100;
    const ceavPatron = mensual * tasaPatron / 100;
    const ceavTrabajador = mensual * DATOS.ceavTrabajador / 100;
    const cuotaSocial = cuotaSocialDiaria(sbc) * dias;
    const total = retiro + ceavPatron + ceavTrabajador + cuotaSocial;
    const patronPagaTuParte = sueldo > 0 && sueldo <= r2(Calc.DATOS.salarioMinimo.general * 30);
    return {
      sbc, veces: sbc / Calc.DATOS.uma, sbcMensual: mensual, tasaPatron, retiro, ceavPatron, ceavTrabajador, cuotaSocial,
      patronPagaTuParte, patron: retiro + ceavPatron + (patronPagaTuParte ? ceavTrabajador : 0),
      trabajador: patronPagaTuParte ? 0 : ceavTrabajador,
      total, tasaTotal: mensual ? (retiro + ceavPatron + ceavTrabajador) / mensual * 100 : 0
    };
  }

  // Proyección del saldo de la Afore en pesos de hoy (el rendimiento y el aumento de sueldo son por encima de la
  // inflación). Mes a mes: el saldo rinde (rendimiento - comisión) y luego entra la aportación del mes.
  // Las aportaciones obligatorias se multiplican por la parte del tiempo con empleo formal (densidad);
  // las voluntarias, no. El año de calendario de cada mes decide la cuota patronal (sube cada enero hasta 2030):
  // con mesInicio (1 = enero ... 12 = diciembre) el primer mes es ese mes de anioInicio. El aumento de sueldo
  // entra cada 12 meses desde hoy. Edades fuera de 15 a 100 años no se proyectan (edadValida = false).
  function proyeccionAfore({ edad, edadRetiro, sueldoMensual, saldo = 0, voluntaria = 0, rendimiento = 4,
    comision = DATOS.comision, aumentoSueldo = 0, densidad = 100, aniosCobro = 20, anioInicio = Calc.DATOS.anio,
    mesInicio = 1 }) {
    const max = DATOS.maximos;
    const avisos = [];
    const enRango = n => n >= DATOS.edades.min && n <= DATOS.edades.max;
    const e = Math.min(num(edad), max.edad);
    const er = Math.min(num(edadRetiro), max.edad);
    const edadValida = enRango(e), retiroValido = enRango(er);
    if (!edadValida) avisos.push("edad");
    if (!retiroValido) avisos.push("retiro");
    let anios = edadValida && retiroValido ? Math.max(0, er - e) : 0;
    if (anios > max.anios) { anios = max.anios; avisos.push("anios"); }
    const meses = Math.round(anios * 12);
    const lee = (x, tope, clave) => { const r = acotar(x, tope); if (r.acotado) avisos.push(clave); return r.valor; };
    const sueldo = lee(sueldoMensual, max.sueldoMensual, "sueldo");
    const saldoInicial = lee(saldo, max.saldo, "saldo");
    const vol = lee(voluntaria, max.voluntaria, "voluntaria");
    const rend = lee(rendimiento, max.rendimiento, "rendimiento");
    const com = lee(comision, max.comision, "comision");
    const aum = lee(aumentoSueldo, max.aumento, "aumento");
    const dens = lee(densidad, max.densidad, "densidad") / 100;
    const cobroValido = num(aniosCobro) >= 1;
    if (!cobroValido) avisos.push("cobroMin");
    const cobro = Math.max(1, lee(aniosCobro, max.aniosCobro, "cobro"));
    const mes0 = Math.min(12, Math.max(1, Math.floor(num(mesInicio)) || 1)) - 1; // 0 = enero

    const tasaMes = anual => Math.pow(1 + anual / 100, 1 / 12) - 1;
    const iNeto = tasaMes(rend - com);
    const iBruto = tasaMes(rend);
    let s = saldoInicial, sinCom = saldoInicial, obligatorio = 0, voluntario = 0;
    let anioActual = anioInicio, sueldoAnio = sueldo, aport = aportacionMensual(sueldo, anioInicio);
    for (let m = 0; m < meses; m++) {
      const anioMes = anioInicio + Math.floor((mes0 + m) / 12);
      const sueldoMes = sueldo * Math.pow(1 + aum / 100, Math.floor(m / 12));
      if (anioMes !== anioActual || sueldoMes !== sueldoAnio) {
        anioActual = anioMes;
        sueldoAnio = sueldoMes;
        aport = aportacionMensual(sueldoAnio, anioActual);
      }
      const o = aport.total * dens;
      obligatorio += o;
      voluntario += vol;
      s = s * (1 + iNeto) + o + vol;
      sinCom = sinCom * (1 + iBruto) + o + vol;
    }
    const sueldoFinal = meses ? sueldo * Math.pow(1 + aum / 100, Math.floor((meses - 1) / 12)) : sueldo;
    const pensionMensual = s / (cobro * 12);
    return {
      anios, meses, avisos, edadValida, retiroValido, cobroValido, mesInicio: mes0 + 1,
      sueldo, saldoInicial, voluntaria: vol, rendimiento: rend, comision: com, aumento: aum,
      densidad: dens, aniosCobro: cobro,
      hoy: aportacionMensual(sueldo, anioInicio),
      en2030: aportacionMensual(sueldo, 2030),
      saldoFinal: s, sinComision: sinCom, efectoComision: Math.max(0, sinCom - s),
      obligatorio, voluntario, rendimientos: s - saldoInicial - obligatorio - voluntario,
      pensionMensual, sueldoFinal, reemplazo: sueldoFinal > 0 ? pensionMensual / sueldoFinal : 0
    };
  }

  // Semanas que pide cada ley según el año en que se pide la pensión.
  // Sin año válido (vacío, texto o negativo) se usa el año en curso.
  function semanasRequeridas(regimen, anio = Calc.DATOS.anio) {
    if (regimen === "ley73") return DATOS.semanasLey73;
    return porAnio(DATOS.semanasLey97, Math.floor(num(anio)) || Calc.DATOS.anio);
  }

  // Cuántas semanas te faltan para el año elegido y si te da tiempo de juntarlas.
  // anioActual: año de hoy. restantesAnio: semanas que quedan de hoy al 31 de diciembre del año de hoy (0 a 52).
  // De hoy al 31 de diciembre del año y caben restantesAnio + 52 x (y - anioActual) semanas de trabajo continuo.
  // Si las que faltan no caben, se busca el primer año en que tienes + las que caben >= las que pide ese año
  // (en la Ley 97 el requisito sube 25 por año hasta 1,000 en 2031). Un año anterior al de hoy cuenta como el de hoy.
  function semanasFaltantes({ regimen = "ley97", semanas, anio, anioActual = Calc.DATOS.anio, restantesAnio = 0 }) {
    const porAnio52 = DATOS.semanasPorAnio;
    const tope = acotar(semanas, DATOS.maximos.semanas);
    const tienes = Math.floor(tope.valor);
    const hoy = Math.floor(num(anioActual)) || Calc.DATOS.anio;
    const elegido = Math.max(Math.floor(num(anio)) || hoy, hoy);
    const quedan = Math.min(Math.floor(num(restantesAnio)), porAnio52);
    const caben = y => quedan + porAnio52 * (y - hoy);
    const requeridas = semanasRequeridas(regimen, elegido);
    const faltan = Math.max(0, requeridas - tienes);
    const alcanza = faltan <= caben(elegido);
    let anioPosible = elegido;
    while (tienes + caben(anioPosible) < semanasRequeridas(regimen, anioPosible)) anioPosible++;
    const requeridasPosible = semanasRequeridas(regimen, anioPosible);
    const faltanPosible = Math.max(0, requeridasPosible - tienes);
    return {
      regimen, anio: elegido, requeridas, tienes, acotado: tope.acotado, faltan, cumple: faltan === 0,
      aniosTienes: tienes / porAnio52, aniosFaltan: faltan / porAnio52,
      sobran: Math.max(0, tienes - requeridas),
      caben: caben(elegido), alcanza, anioPosible, requeridasPosible, faltanPosible,
      aniosFaltanPosible: faltanPosible / porAnio52
    };
  }

  // Número de incrementos anuales del art. 167 LSS 1973.
  function incrementosLey73(semanas) {
    const exc = Math.max(0, Math.floor(num(semanas)) - DATOS.ley73.semanasBase);
    const completos = Math.floor(exc / DATOS.semanasPorAnio);
    const resto = exc - completos * DATOS.semanasPorAnio;
    const parte = resto > 26 ? 1 : resto >= 13 ? 0.5 : 0;
    return { excedentes: exc, completos, resto, parte, total: completos + parte };
  }

  // Pensión estimada de cesantía o vejez de la Ley 73 (arts. 164 a 171 LSS 1973 y el incremento de 11%).
  // salarioPromedio: salario diario promedio de las últimas 250 semanas cotizadas.
  function pensionLey73({ salarioPromedio, semanas, edad = 65, pareja = false, hijos = 0, padres = 0,
    salarioMinimo = Calc.DATOS.salarioMinimo.general }) {
    const cfg = DATOS.ley73;
    const max = DATOS.maximos;
    // Tope: 25 UMA, el salario base de cotización más alto que se registra en el IMSS (art. 28 LSS vigente).
    // Está en litigio para la Ley 73: la jurisprudencia 2a./J. 164/2019 de la SCJN (publicada el 24 ene 2020) dice
    // 10 salarios mínimos, y el Consejo Técnico del IMSS acordó el 6 feb 2020 seguir con 25 (IDC Online,
    // El Contribuyente, ADN40 y boletín 060/2020 del IMSS). Con el mínimo de 2026, 10 SM = 3,150.40 > 25 UMA.
    const topeSbc = Calc.DATOS.imss.topeUma * Calc.DATOS.uma;
    const spdCapturado = num(salarioPromedio);
    const spd = Math.min(spdCapturado, topeSbc);
    const sem = acotar(semanas, max.semanas);
    const semanasN = Math.floor(sem.valor);
    const edadN = Math.floor(Math.min(num(edad), max.edad));
    const nHijos = Math.floor(Math.min(num(hijos), max.hijos));
    const nPadres = Math.floor(Math.min(num(padres), max.padres));
    const sm = num(salarioMinimo) || Calc.DATOS.salarioMinimo.general;

    // Los grupos del art. 167 van con 2 decimales (1.01 a 1.25, 1.26 a 1.50...). Redondeamos las veces a 2 decimales
    // y con eso buscamos el grupo, igual que se muestra en la página (4.7504 -> 4.75 -> grupo 4.51 a 4.75).
    // Es nuestro criterio; el IMSS puede usar otro.
    const veces = spd / sm;
    const vecesGrupo = r2(veces);
    const fila = cfg.tabla.find(f => vecesGrupo <= f[0]);
    const [hasta, basica, incremento] = fila;
    const inc = incrementosLey73(semanasN);
    const porcentaje = basica + inc.total * incremento;
    const cuantia = spd * porcentaje / 100;

    const a = cfg.asignaciones;
    let asignacion = 0, ayuda = 0;
    if (pareja) asignacion += a.pareja;
    asignacion += nHijos * a.hijo;
    if (!pareja && nHijos === 0) {
      asignacion += nPadres * a.padre;
      if (nPadres === 0) ayuda = a.ayudaSinFamilia;
      else if (nPadres === 1) ayuda = a.ayudaUnPadre;
    }
    const conAsignaciones = cuantia * (1 + asignacion + ayuda);
    const conTope = Math.min(conAsignaciones, spd * cfg.topeSalarioPromedio);
    const factorEdad = edadN >= 65 ? 1 : (cfg.factorEdad[edadN] || 0);
    const diaria = conTope * factorEdad * cfg.incremento;
    const calculada = diaria * cfg.diasMes;
    const minima = sm * cfg.diasMes * cfg.incremento;

    const faltaEdad = edadN < 60;
    const faltanSemanas = semanasN < cfg.semanasBase;
    const derecho = !faltaEdad && !faltanSemanas && spd > 0;
    const usaMinima = derecho && calculada < minima;
    const mensual = derecho ? Math.max(calculada, minima) : 0;
    return {
      spd, topado: spdCapturado > topeSbc, topeSbc, semanas: semanasN, semanasAcotadas: sem.acotado, edad: edadN,
      salarioMinimo: sm, veces, vecesGrupo, grupoHasta: Number.isFinite(hasta) ? hasta : null, basica, incremento, incrementos: inc, porcentaje, cuantia,
      asignacion, ayuda, conAsignaciones, topadoCien: conAsignaciones > conTope, conTope, factorEdad,
      diaria, calculada, minima, derecho, faltaEdad, faltanSemanas, usaMinima, mensual, anual: mensual * 12,
      reemplazo: spd > 0 ? mensual / (spd * cfg.diasMes) : 0
    };
  }

  const api = {
    DATOS, sbcDiario, tasaCeavPatron, cuotaSocialDiaria, aportacionMensual, proyeccionAfore,
    semanasRequeridas, semanasFaltantes, incrementosLey73, pensionLey73, redondear: r2
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Retiro = api;
})(this);
