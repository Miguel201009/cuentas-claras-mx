// Familia y becas de Cuentas Claras MX: suma de los apoyos del Bienestar de un hogar, pago de la licencia
// de maternidad (subsidio del IMSS) y del permiso de paternidad, y reparto de los gastos de los hijos para
// hablar de pensión alimenticia. Funciones puras, sin datos personales: todo se calcula en el navegador.
// En el navegador carga antes ../../assets/calc.js (UMA, salario mínimo y factor de integración vienen de
// Calc.DATOS; de ahí sale también mxn()). En Node se lee con require.
//
// Nota de fuentes (20 oct 2026): desde la red de trabajo no se pudo abrir ningún portal oficial (DOF,
// Cámara de Diputados, IMSS, gob.mx) ni hacer búsquedas. Los días y porcentajes de ley vienen del texto de
// la LFT y de la LSS en los artículos citados y quedan pendientes de cotejar con el texto vigente.
// Los montos de los programas del Bienestar NO están confirmados: la página los muestra como ejemplos que
// la persona puede cambiar.
(function (raiz) {
  const enNode = typeof module !== "undefined" && module.exports;
  const Calc = enNode ? require("./calc.js") : raiz.Calc;

  const DATOS = {
    anio: 2026,
    revisado: "octubre de 2026",

    maternidad: {
      // Art. 101 LSS: subsidio en dinero igual al 100% del último salario diario de cotización, durante
      // 42 días antes del parto y 42 días después. Art. 170 fr. II LFT: 6 semanas antes y 6 después.
      diasAntes: 42,
      diasDespues: 42,
      porcentaje: 1,
      // Art. 170 fr. II LFT: a petición de la trabajadora y con autorización escrita del médico, se pueden
      // pasar hasta 4 de las 6 semanas previas al parto para después. Antes del parto quedan al menos 14 días.
      maxTransferibles: 28,
      // Art. 102 fr. I LSS: al menos 30 cotizaciones semanales en los 12 meses anteriores a la fecha en que
      // empieza el pago. Si no se cumplen, el patrón paga el salario íntegro (art. 103 LSS).
      semanasMinimas: 30,
      // En 12 meses caben 52.14 semanas: lo que se escriba arriba de 53 se acota.
      semanasMaximas: 53
    },

    paternidad: {
      // Art. 132 fr. XXVII Bis LFT: permiso de 5 días laborables con goce de sueldo por el nacimiento de un
      // hijo o por la adopción de un infante. Lo paga el patrón, no el IMSS.
      // Pendiente confirmar en el texto vigente si en 2026 hubo una reforma que lo amplíe.
      diasLaborables: 5,
      maxDias: 365,
      // Para estimar el sueldo de esos días: el sueldo mensual cubre 30 días (art. 89 LFT), así que una
      // semana son 7 días de sueldo, descansos incluidos. Cada día laborable vale la semana entre los días
      // que se trabajan: si trabajas 5 días a la semana, 5 días laborables son una semana completa.
      diasSemana: 5
    },

    // Programas del Bienestar. Montos por bimestre: EJEMPLOS SIN CONFIRMAR en fuente oficial (no se pudo
    // abrir gob.mx/bienestar ni gob.mx/becasbenitojuarez). La página los muestra en campos editables.
    // tipo "pension" se paga los 6 bimestres del año; "beca" solo en los bimestres del ciclo escolar.
    apoyos: {
      adultos: { nombre: "Pensión para Adultos Mayores", tipo: "pension", ejemplo: 6400 },
      mujeres: { nombre: "Pensión Mujeres Bienestar", tipo: "pension", ejemplo: 3100 },
      discapacidad: { nombre: "Pensión para Personas con Discapacidad", tipo: "pension", ejemplo: 3300 },
      // La Beca Rita Cetina de secundaria se ha pagado por familia, con un monto extra por cada estudiante
      // adicional. Regla y montos pendientes de confirmar para 2026.
      secundaria: { nombre: "Beca Rita Cetina (secundaria)", tipo: "beca", ejemplo: 1900, adicional: 700 },
      bachillerato: { nombre: "Beca Benito Juárez (bachillerato)", tipo: "beca", ejemplo: 1900 }
    },
    maxPersonas: 20,
    maxMonto: 100000,
    bimestresPorAnio: 6,

    // Pensión alimenticia: no hay un porcentaje legal único. El art. 311 del Código Civil Federal (y los
    // códigos de los estados) dice que los alimentos se fijan según las necesidades de quien los recibe y
    // las posibilidades de quien los da. Aquí solo se suman gastos y se reparten según lo que gana cada uno.
    gastos: [
      { clave: "comida", nombre: "Comida" },
      { clave: "escuela", nombre: "Escuela, útiles y uniformes" },
      { clave: "salud", nombre: "Salud y medicinas" },
      { clave: "ropa", nombre: "Ropa y zapatos" },
      { clave: "vivienda", nombre: "Vivienda y servicios" },
      { clave: "transporte", nombre: "Transporte" },
      { clave: "otros", nombre: "Diversión y otros" }
    ],
    maxGasto: 1e7,
    maxIngreso: 1e8
  };

  const r2 = Calc.redondear;

  // Número válido o null. Vacío, texto, NaN o infinito no cuentan.
  function numero(x) {
    if (x === "" || x === null || x === undefined || typeof x === "boolean") return null;
    const n = +x;
    return Number.isFinite(n) ? n : null;
  }

  // Cantidad de dinero: vacío, texto o negativo cuenta como 0; lo que pase del máximo se acota.
  function cantidad(x, max) {
    const n = numero(x);
    if (n === null || n <= 0) return { valor: 0, acotado: false };
    if (n > max) return { valor: max, acotado: true };
    return { valor: n, acotado: false };
  }

  // Número entero de personas, días o semanas, con las mismas reglas.
  function entero(x, max) {
    const c = cantidad(x, max);
    return { valor: Math.floor(c.valor), acotado: c.acotado };
  }

  // ------------------------------------------------------------- Apoyos del Bienestar

  // Suma lo que recibe un hogar por bimestre. personas: cuántas personas reciben cada apoyo.
  // montos: monto por bimestre de cada apoyo (si falta la clave se usa el ejemplo; vacío cuenta como 0).
  // En la beca de secundaria, montos.secundaria es por familia y montos.secundariaAdicional por cada
  // estudiante después del primero.
  function sumaApoyos({ personas = {}, montos = {} } = {}) {
    let acotado = false;
    const leerMonto = (clave, ejemplo) => {
      const m = cantidad(clave in montos ? montos[clave] : ejemplo, DATOS.maxMonto);
      acotado = acotado || m.acotado;
      return m.valor;
    };
    const renglones = Object.keys(DATOS.apoyos).map(clave => {
      const a = DATOS.apoyos[clave];
      const p = entero(personas[clave], DATOS.maxPersonas);
      acotado = acotado || p.acotado;
      const unitario = leerMonto(clave, a.ejemplo);
      let monto;
      let adicional = 0;
      if (clave === "secundaria") {
        adicional = leerMonto("secundariaAdicional", a.adicional);
        monto = p.valor > 0 ? unitario + (p.valor - 1) * adicional : 0;
      } else {
        monto = p.valor * unitario;
      }
      return { clave, nombre: a.nombre, tipo: a.tipo, personas: p.valor, unitario, adicional, monto: r2(monto) };
    });
    const bimestre = r2(renglones.reduce((s, x) => s + x.monto, 0));
    const pensiones = r2(renglones.filter(x => x.tipo === "pension").reduce((s, x) => s + x.monto, 0));
    const becas = r2(bimestre - pensiones);
    return {
      renglones, bimestre, mes: r2(bimestre / 2), pensiones, becas,
      pensionesAnio: r2(pensiones * DATOS.bimestresPorAnio),
      personas: renglones.reduce((s, x) => s + x.personas, 0),
      acotado
    };
  }

  // ------------------------------------------------------------- Maternidad y paternidad

  // Subsidio por maternidad del IMSS. dato: "sueldo" (sueldo mensual bruto; el SBC se estima con el factor de
  // integración mínimo de ley) o "sbc" (salario base de cotización diario, como viene en el recibo).
  // semanas: semanas cotizadas en los últimos 12 meses (vacío = no sabe). diasAntes: días de descanso antes
  // del parto (42 si no se transfieren semanas; mínimo 14). zona: "general" o "frontera" (Zona Libre de la
  // Frontera Norte): el SBC no puede ser menor al salario mínimo del área geográfica (art. 28 LSS).
  function maternidad({ dato = "sueldo", monto, semanas, diasAntes = DATOS.maternidad.diasAntes, zona = "general" } = {}) {
    const m = DATOS.maternidad;
    const esSbc = dato === "sbc";
    const capt = cantidad(monto, esSbc ? 1e6 : 1e8);
    if (!capt.valor) {
      return { ok: false, error: esSbc ? "Escribe tu salario base de cotización diario para calcular." : "Escribe tu sueldo mensual para calcular." };
    }
    const avisos = [];
    if (capt.acotado) avisos.push(esSbc ? "Revisa tu SBC: calculamos con un máximo de un millón de pesos diarios." : "Revisa tu sueldo: calculamos con un máximo de 100 millones al mes.");

    const fi = Calc.DATOS.factorIntegracion;
    const zonaUsada = zona === "frontera" ? "frontera" : "general";
    const salarioMinimo = Calc.salarioMinimoZona(zonaUsada);
    const tope = r2(Calc.DATOS.imss.topeUma * Calc.DATOS.uma);
    // Salario diario sin redondear: se redondea solo el resultado final (sueldo / 30 x 84, no 0.01 x 84).
    const diarioExacto = esSbc ? capt.valor / fi : capt.valor / 30;
    const salarioDiario = r2(diarioExacto);
    // El SBC se registra en el IMSS con centavos: el subsidio se calcula con ese SBC ya redondeado.
    const sbcCapturado = r2(esSbc ? capt.valor : capt.valor / 30 * fi);
    const sbc = Math.min(Math.max(sbcCapturado, salarioMinimo), tope);
    const conPiso = sbcCapturado < salarioMinimo;
    const topado = sbcCapturado > tope;
    if (conPiso) avisos.push("Ningún salario de cotización puede ser menor al salario mínimo: usamos el mínimo " +
      (zonaUsada === "frontera" ? "de la Zona Libre de la Frontera Norte" : "general") + " de " + Calc.DATOS.anio + ".");
    if (topado) avisos.push("El IMSS solo paga hasta el tope de 25 UMA diarias. La ley laboral dice que en tu licencia recibes tu salario íntegro: pregunta en tu empresa por la diferencia.");

    const total = m.diasAntes + m.diasDespues;
    const minAntes = m.diasAntes - m.maxTransferibles;
    const da = numero(diasAntes);
    const antesDias = da === null ? m.diasAntes : Math.min(m.diasAntes, Math.max(minAntes, Math.round(da)));
    if (da !== null && Math.round(da) !== antesDias) avisos.push(`Antes del parto pueden ser de ${minAntes} a ${m.diasAntes} días: usamos ${antesDias}.`);
    const despuesDias = total - antesDias;

    const pagoDiario = r2(sbc * m.porcentaje);
    const antes = r2(pagoDiario * antesDias);
    const despues = r2(pagoDiario * despuesDias);
    const imss = r2(antes + despues);

    const s = numero(semanas);
    const semanasLeidas = s === null ? null : Math.min(m.semanasMaximas, Math.max(0, Math.floor(s)));
    if (s !== null && s > m.semanasMaximas) avisos.push(`En 12 meses caben unas 52 semanas: tomamos ${m.semanasMaximas}.`);
    const cumple = semanasLeidas === null ? null : semanasLeidas >= m.semanasMinimas;
    // Sin las 30 semanas, el patrón paga el salario íntegro de esos días (art. 103 LSS y 170 fr. V LFT).
    const patron = r2(diarioExacto * total);

    return {
      ok: true, dato: esSbc ? "sbc" : "sueldo", zona: zonaUsada, sbcCapturado, sbc, conPiso, topado, tope, salarioMinimo,
      salarioDiario, dias: total, diasAntes: antesDias, diasDespues: despuesDias, transferidos: m.diasAntes - antesDias,
      pagoDiario, antes, despues, imss, semanas: semanasLeidas, cumple,
      quienPaga: cumple === false ? "patron" : "imss",
      recibes: cumple === false ? patron : imss,
      patron: cumple === false ? patron : 0,
      avisos
    };
  }

  // Permiso de paternidad: el sueldo aproximado de los días de permiso, que paga el patrón. Si la empresa da
  // menos de lo que marca la ley, se calcula con el mínimo de ley. diasSemana: días que trabaja a la semana
  // (1 a 7; 5 si no se indica). Sueldo de los días = sueldo mensual / 30 x 7 x días / diasSemana.
  function paternidad({ sueldoMensual, dias = DATOS.paternidad.diasLaborables, diasSemana = DATOS.paternidad.diasSemana } = {}) {
    const p = DATOS.paternidad;
    const sueldo = cantidad(sueldoMensual, 1e8);
    if (!sueldo.valor) return { ok: false, error: "Escribe tu sueldo mensual para calcular." };
    const avisos = [];
    if (sueldo.acotado) avisos.push("Revisa tu sueldo: calculamos con un máximo de 100 millones al mes.");
    const d = entero(dias, p.maxDias);
    let diasUsados = d.valor;
    const alMinimo = diasUsados < p.diasLaborables;
    if (alMinimo) {
      diasUsados = p.diasLaborables;
      avisos.push(`La ley marca al menos ${p.diasLaborables} días laborables: calculamos con ${p.diasLaborables}.`);
    }
    if (d.acotado) avisos.push(`Revisa los días: tomamos como máximo ${p.maxDias}.`);
    const ds = entero(diasSemana, 7);
    const semana = ds.valor >= 1 ? ds.valor : p.diasSemana;
    // Sin redondear antes de multiplicar: se redondea solo cada resultado.
    const semanalExacto = sueldo.valor / 30 * 7;
    return {
      ok: true, sd: r2(sueldo.valor / 30), semanal: r2(semanalExacto), diasSemana: semana,
      porDia: r2(semanalExacto / semana), semanas: diasUsados / semana,
      dias: diasUsados, alMinimo, pago: r2(semanalExacto * diasUsados / semana), quienPaga: "patron", avisos
    };
  }

  // ------------------------------------------------------------- Pensión alimenticia

  // Suma los gastos mensuales de los hijos y los reparte entre las dos personas según lo que gana cada una.
  // No es lo que fijaría un juez: es una referencia para ordenar cuentas o platicar un acuerdo.
  function gastosHijos({ gastos = {}, ingresoCon, ingresoOtro } = {}) {
    let acotado = false;
    const renglones = DATOS.gastos.map(g => {
      const c = cantidad(gastos[g.clave], DATOS.maxGasto);
      acotado = acotado || c.acotado;
      return { clave: g.clave, nombre: g.nombre, monto: r2(c.valor) };
    });
    const total = r2(renglones.reduce((s, x) => s + x.monto, 0));
    const ic = cantidad(ingresoCon, DATOS.maxIngreso);
    const io = cantidad(ingresoOtro, DATOS.maxIngreso);
    acotado = acotado || ic.acotado || io.acotado;
    const base = { renglones, total, ingresoCon: ic.valor, ingresoOtro: io.valor, acotado };
    if (!total) return Object.assign(base, { ok: false, motivo: "gastos", error: "Escribe al menos un gasto para calcular." });
    const suma = ic.valor + io.valor;
    if (!suma) return Object.assign(base, { ok: false, motivo: "ingresos", error: "Escribe lo que gana al menos una de las dos personas para repartir los gastos." });
    const parteOtro = io.valor / suma;
    const aporteOtro = r2(total * parteOtro);
    const aporteCon = r2(total - aporteOtro);
    // Dos quincenas que suman exacto el aporte del mes: la primera se redondea hacia abajo al centavo y la
    // segunda lleva el centavo que sobre (1,666.67 = 833.33 + 833.34).
    const centavos = Math.round(aporteOtro * 100);
    const quincena1 = Math.floor(centavos / 2) / 100;
    const quincena2 = (centavos - Math.floor(centavos / 2)) / 100;
    return Object.assign(base, {
      ok: true, parteOtro, parteCon: 1 - parteOtro, aporteOtro, aporteCon,
      quincenaOtro: quincena1, quincenaOtro2: quincena2,
      delIngresoOtro: io.valor ? aporteOtro / io.valor : 0,
      delIngresoCon: ic.valor ? aporteCon / ic.valor : 0,
      rebasa: total > suma
    });
  }

  const api = { DATOS, numero, cantidad, entero, sumaApoyos, maternidad, paternidad, gastosHijos };
  if (enNode) module.exports = api;
  else raiz.Familia = api;
})(this);
