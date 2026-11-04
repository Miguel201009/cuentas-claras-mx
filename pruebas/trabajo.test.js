// Pruebas de la sección Trabajo (PTU y horas extra): node pruebas/trabajo.test.js
// Los valores esperados se calcularon a mano.
const assert = require("assert");
const T = require("../assets/trabajo.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);
const finito = (r, msg) => Object.entries(r).forEach(([k, v]) => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${k} = ${v}`);
});

// ---------- PTU ----------
// Ejemplo de la página: empresa con renta gravable de $2,000,000, 20 personas con 365 días cada una
// (7,300 días) y $3,650,000 de salarios. Tú: $12,000 al mes (400 diarios) y 365 días.
const base = { rentaGravable: 2000000, diasTotales: 7300, salariosTotales: 3650000, salarioMensual: 12000, dias: 365 };
let p = T.ptu(base);
cerca(p.repartir, 200000, "10% de la renta gravable");
cerca(p.mitad, 100000, "mitad");
cerca(p.misSalarios, 146000, "tus salarios del año (400 x 365)");
cerca(p.parteDias, 5000, "parte por días: 100,000 / 7,300 x 365");
cerca(p.parteSalarios, 4000, "parte por salarios: 100,000 / 3,650,000 x 146,000");
cerca(p.total, 9000, "PTU total");
cerca(p.tresMeses, 36000, "tope de 3 meses");
assert.strictEqual(p.topado, false);
assert.strictEqual(p.derecho, true);
cerca(p.exento, 1759.65, "exento 15 UMA (15 x 117.31)");
cerca(p.gravado, 9000 - 1759.65, "parte gravada");

// Tope de 3 meses (art. 127 fr. VIII): con renta de $20,000,000 saldrían 50,000 + 40,000 = 90,000.
p = T.ptu(Object.assign({}, base, { rentaGravable: 20000000 }));
cerca(p.calculada, 90000, "PTU sin tope");
cerca(p.total, 36000, "PTU topada a 3 meses");
assert.strictEqual(p.topado, true);
assert.strictEqual(p.topeUsado, "tresMeses");
// Si el promedio de los últimos 3 años es mayor, ese es el tope.
p = T.ptu(Object.assign({}, base, { rentaGravable: 20000000, promedio3: 50000 }));
cerca(p.total, 50000, "tope por promedio de 3 años");
assert.strictEqual(p.topeUsado, "promedio");
p = T.ptu(Object.assign({}, base, { rentaGravable: 20000000, promedio3: 100000 }));
cerca(p.total, 90000, "promedio alto: no se topa");

// Quién no tiene derecho
assert.strictEqual(T.ptu(Object.assign({}, base, { caso: "directivo" })).total, 0);
assert.strictEqual(T.ptu(Object.assign({}, base, { caso: "hogar" })).total, 0);
p = T.ptu(Object.assign({}, base, { caso: "eventual", dias: 59 }));
assert.strictEqual(p.derecho, false);
assert.strictEqual(p.total, 0);
p = T.ptu(Object.assign({}, base, { caso: "eventual", dias: 60 }));
assert.strictEqual(p.derecho, true);
// 60 días: 100,000/7,300 x 60 + 100,000/3,650,000 x 24,000 = 821.92 + 657.53
cerca(p.total, 100000 / 7300 * 60 + 100000 / 3650000 * 24000, "eventual con 60 días");
// De planta con pocos días sí participa
assert.ok(T.ptu(Object.assign({}, base, { caso: "planta", dias: 30 })).total > 0);

// Confianza (art. 127 fr. II): $200,000 al mes; el de planta mejor pagado gana $20,000.
// Salario máximo para el reparto: 20,000 x 1.2 = 24,000 al mes = 800 diarios; 800 x 365 = 292,000.
// Parte por días 5,000; parte por salario 100,000 / 3,650,000 x 292,000 = 8,000. Total 13,000.
// Tope de 3 meses con el salario para el reparto: 3 x 30 x 800 = 72,000 (no se aplica).
const confianza = Object.assign({}, base, { caso: "confianza", salarioMensual: 200000 });
p = T.ptu(Object.assign({}, confianza, { salarioMaxPlanta: 20000 }));
assert.strictEqual(p.confianzaTopada, true);
assert.strictEqual(p.confianzaSinDato, false);
cerca(p.topeConfianzaMensual, 24000, "tope de confianza: planta + 20%");
cerca(p.sd, 800, "salario diario para el reparto");
cerca(p.sdReal, 200000 / 30, "salario diario real");
cerca(p.misSalarios, 292000, "salario del año para el reparto");
cerca(p.parteSalarios, 8000, "parte por salario con tope de confianza");
cerca(p.total, 13000, "PTU de confianza con tope");
cerca(p.tresMeses, 72000, "tope de 3 meses con el salario para el reparto");
// Sin el dato de planta no se aplica el límite y se avisa: 100,000 / 3,650,000 x (200,000 / 30 x 365) = 66,666.67
p = T.ptu(confianza);
assert.strictEqual(p.confianzaSinDato, true);
assert.strictEqual(p.confianzaTopada, false);
cerca(p.total, 5000 + 66666.67, "confianza sin dato de planta");
// Si el de confianza gana menos que planta + 20%, no cambia nada
p = T.ptu(Object.assign({}, confianza, { salarioMaxPlanta: 200000 }));
assert.strictEqual(p.confianzaTopada, false);
cerca(p.total, 5000 + 66666.67, "confianza por debajo del límite");
// El dato de planta no afecta a quien es de planta
cerca(T.ptu(Object.assign({}, base, { salarioMaxPlanta: 5000 })).total, 9000, "planta ignora el límite de confianza");

// Totales de la empresa menores que lo tuyo: se ajustan para no repartir más de la mitad
p = T.ptu(Object.assign({}, base, { diasTotales: 100, salariosTotales: 1000 }));
assert.strictEqual(p.ajustado, true);
cerca(p.parteDias, 100000, "parte por días con total ajustado (tus 365 días son el total)");
cerca(p.calculada, 200000, "sin tope serían las dos mitades completas");
cerca(p.total, 36000, "aun así respeta el tope");

// Entradas vacías, 0, negativas, texto y enormes: nunca NaN ni Infinity
[{}, { rentaGravable: "", diasTotales: "", salariosTotales: "", salarioMensual: "", dias: "" },
  { rentaGravable: 0, diasTotales: 0, salariosTotales: 0, salarioMensual: 0, dias: 0 },
  { rentaGravable: -5, diasTotales: -1, salariosTotales: -1, salarioMensual: -100, dias: -3, promedio3: -9 },
  { rentaGravable: "abc", diasTotales: NaN, salariosTotales: Infinity, salarioMensual: 1e300, dias: 1e9 },
  { rentaGravable: 1e300, diasTotales: 1e300, salariosTotales: 1e300, salarioMensual: 1e12, dias: 365, promedio3: 1e300 },
  { caso: "confianza", salarioMaxPlanta: -5, rentaGravable: 1e6, diasTotales: 10, salariosTotales: 10, salarioMensual: 1e4, dias: 30 },
  { caso: "confianza", salarioMaxPlanta: "", salarioMensual: "" },
  { caso: "confianza", salarioMaxPlanta: 1e300, salarioMensual: 1e300, rentaGravable: 1e300, dias: 366 }
].forEach((e, i) => {
  const r = T.ptu(e);
  finito(r, "ptu caso " + i);
  assert.ok(r.total >= 0, "ptu no negativa " + i);
  assert.ok(r.total <= r.mitad * 2 + 1e-6, "no reparte más de lo que hay " + i);
});
assert.strictEqual(T.ptu({}).total, 0);
// Cantidades absurdas se recortan a los máximos y se avisa
p = T.ptu({ rentaGravable: 1e308, diasTotales: 1, salariosTotales: 1, salarioMensual: 1e308, dias: 365, promedio3: 1e308 });
assert.strictEqual(p.recortado, true);
cerca(p.renta, 1e12, "renta recortada a un billón");
cerca(p.sd, 1e8 / 30, "sueldo recortado a cien millones");
cerca(p.total, 1e11, "nunca más que la mitad de lo repartible por cada parte");
assert.strictEqual(T.ptu(base).recortado, false);
assert.ok(T.ptu({ dias: 1e9, salarioMensual: 12000, rentaGravable: 1000, diasTotales: 10, salariosTotales: 10 }).misDias <= 366);

// ---------- Horas extra ----------
// Ejemplo de la página: $12,000 al mes, jornada de 8 horas, 12 horas extra en la semana, 2026.
let h = T.horasExtra({ salarioMensual: 12000, horasJornada: 8, horas: 12, anio: 2026 });
cerca(h.valorHora, 50, "valor de la hora: 400 / 8");
cerca(h.horaDoble, 100, "hora doble");
cerca(h.horaTriple, 150, "hora triple");
assert.strictEqual(h.limite, 9);
assert.strictEqual(h.maximo, 13);
assert.strictEqual(h.dobles, 9);
assert.strictEqual(h.triples, 3);
cerca(h.pagoDobles, 900, "9 horas dobles");
cerca(h.pagoTriples, 450, "3 horas triples");
cerca(h.total, 1350, "total de la semana");
assert.strictEqual(h.excede, false);
assert.strictEqual(h.jornadaSemanal, 48);
cerca(h.exentoTopeSemana, 586.55, "5 UMA por semana");
cerca(h.exentoTopeSemanaSalarioMinimo, 1575.20, "5 salarios mínimos por semana (315.04 x 5)");
// ISR del ejemplo: gana más del mínimo; libre la mitad de las horas dobles (900 / 2 = 450, menos que 586.55).
// Las 3 horas triples pagan ISR completo: 1,350 - 450 = 900.
assert.strictEqual(h.ganaMinimo, false);
cerca(h.exento, 450, "parte libre de ISR del ejemplo");
cerca(h.gravado, 900, "parte que paga ISR del ejemplo");
// Sueldo alto: $30,000 al mes = 1,000 diarios, hora de 125. Dobles 9 x 250 = 2,250 (la mitad, 1,125, pasa del tope).
// Triples 3 x 375 = 1,125. Libre: 586.55. Paga ISR: 3,375 - 586.55 = 2,788.45.
h = T.horasExtra({ salarioMensual: 30000, horasJornada: 8, horas: 12, anio: 2026 });
cerca(h.total, 3375, "total con sueldo alto");
cerca(h.exento, 586.55, "libre topado a 5 UMA");
cerca(h.gravado, 2788.45, "gravado con sueldo alto");
// Salario mínimo general: 315.04 x 30 = 9,451.20 al mes; hora 39.38; doble 78.76; triple 118.14.
// Las 9 dobles (708.84) no pagan ISR; las 3 triples (354.42) sí.
h = T.horasExtra({ salarioMensual: 9451.20, horasJornada: 8, horas: 12, anio: 2026 });
assert.strictEqual(h.ganaMinimo, true);
cerca(h.pagoDobles, 708.84, "dobles con salario mínimo");
cerca(h.exento, 708.84, "con salario mínimo las dobles no pagan ISR");
cerca(h.gravado, 354.42, "con salario mínimo las triples sí pagan ISR");
// Sin sueldo no hay nada libre ni gravado
h = T.horasExtra({ salarioMensual: 0, horasJornada: 8, horas: 12 });
assert.strictEqual(h.ganaMinimo, false);
assert.strictEqual(h.exento, 0);
assert.strictEqual(h.gravado, 0);

// Hasta 9 horas: todo al doble
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 8, horas: 9, anio: 2026 });
cerca(h.total, 900, "9 horas al doble");
assert.strictEqual(h.triples, 0);
// Más de 13 horas: pasa del máximo legal; el excedente se cuenta al triple
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 8, horas: 16, anio: 2026 });
assert.strictEqual(h.excede, true);
cerca(h.total, 9 * 100 + 7 * 150, "16 horas");

// Calendario del transitorio cuarto (DOF 1 may 2026)
assert.deepStrictEqual([2025, 2026, 2027, 2028, 2029, 2030, 2031].map(T.limiteDobles), [9, 9, 9, 10, 11, 12, 12]);
assert.deepStrictEqual([2026, 2027, 2028, 2029, 2030, 2035].map(T.jornadaSemanal), [48, 46, 44, 42, 40, 40]);
assert.strictEqual(T.limiteDobles("abc"), 9);
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 8, horas: 12, anio: 2028 });
cerca(h.total, 10 * 100 + 2 * 150, "2028: 10 dobles y 2 triples");
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 8, horas: 12, anio: 2030 });
cerca(h.total, 1200, "2030: 12 dobles");
assert.strictEqual(h.maximo, 16);

// Por omisión usa el año de calc.js
assert.strictEqual(T.horasExtra({ salarioMensual: 12000, horas: 1 }).limite, T.limiteDobles(C.DATOS.anio));

// Sueldo absurdo: se recorta a $100,000,000 al mes y se avisa
h = T.horasExtra({ salarioMensual: 1e308, horasJornada: 1, horas: 168 });
assert.strictEqual(h.recortado, true);
cerca(h.total, (1e8 / 30) * (9 * 2 + 159 * 3), "168 horas con sueldo recortado");
assert.strictEqual(T.horasExtra({ salarioMensual: 12000, horas: 1 }).recortado, false);

// Jornada de 0 horas o vacía: no divide entre cero
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 0, horas: 5 });
assert.strictEqual(h.sinJornada, true);
assert.strictEqual(h.total, 0);
assert.strictEqual(h.jornadaAcotada, false);
// Jornada de menos de 1 hora: se calcula con 1 hora y se avisa (no $800 por hora con media hora)
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 0.5, horas: 1 });
assert.strictEqual(h.jornadaAcotada, true);
assert.strictEqual(h.jornada, 1);
cerca(h.valorHora, 400, "jornada mínima de 1 hora: 400 / 1");
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 0.01, horas: 168 });
assert.strictEqual(h.jornada, 1);
cerca(h.total, 400 * (9 * 2 + 159 * 3), "168 horas con jornada acotada a 1 hora");
// Más de 24 horas: se usa 24 y se avisa
h = T.horasExtra({ salarioMensual: 12000, horasJornada: 30, horas: 1 });
assert.strictEqual(h.jornadaAcotada, true);
assert.strictEqual(h.jornada, 24);
// Jornadas normales no se tocan
assert.strictEqual(T.horasExtra({ salarioMensual: 12000, horasJornada: 7.5, horas: 1 }).jornadaAcotada, false);
assert.strictEqual(T.horasExtra({ salarioMensual: 12000, horasJornada: 7.75, horas: 1 }).jornada, 7.75);

// Entradas raras: nunca NaN ni Infinity
[{}, { salarioMensual: "", horasJornada: "", horas: "" },
  { salarioMensual: -1, horasJornada: -8, horas: -4, anio: -2026 },
  { salarioMensual: "x", horasJornada: NaN, horas: Infinity },
  { salarioMensual: 1e300, horasJornada: 1e300, horas: 1e300, anio: 1e300 }
].forEach((e, i) => {
  const r = T.horasExtra(e);
  finito(r, "horas extra caso " + i);
  assert.ok(r.total >= 0, "horas extra no negativas " + i);
  assert.ok(r.horas <= 168, "no más horas que las de una semana " + i);
});

// ---------- UMA: conversión y escenario 2027 ----------
assert.deepStrictEqual(T.valoresUma(117.31), { diaria: 117.31, mensual: 3566.22, anual: 42794.64 }, "UMA 2026");
assert.deepStrictEqual(T.valoresUma(113.14), { diaria: 113.14, mensual: 3439.46, anual: 41273.52 }, "UMA 2025");
cerca(T.convertirUma({ cantidad: 30 }).resultado, 3519.30, "30 UMA = aguinaldo exento");
cerca(T.convertirUma({ cantidad: 25 }).resultado, 2932.75, "tope IMSS 25 UMA");
cerca(T.convertirUma({ cantidad: 5, periodo: "anual" }).resultado, 213973.20, "5 UMA anuales");
cerca(T.convertirUma({ cantidad: 3566.22, de: "pesos", periodo: "mensual" }).resultado, 1, "una UMA mensual");
cerca(T.convertirUma({ cantidad: 10000, de: "pesos", periodo: "mensual" }).resultado, 2.8041, "10,000 en UMA mensuales");
assert.strictEqual(T.convertirUma({ cantidad: 1, periodo: "semanal" }).periodo, "diaria", "periodo desconocido = diaria");
let um = T.umaEstimada(3.62);
assert.strictEqual(um.estimada, true);
cerca(um.diaria, 121.56, "117.31 x 1.0362"); cerca(um.mensual, 3695.42, "x 30.4"); cerca(um.anual, 44345.04, "x 12");
cerca(T.umaEstimada(0).diaria, 117.31, "sin inflación");
assert.strictEqual(T.umaEstimada(500).acotada, true);
[{}, { cantidad: -3, de: "pesos" }, { cantidad: "x", periodo: "anual" }, { cantidad: 1e300 }, { cantidad: Infinity, uma: -1 }]
  .forEach((e, i) => { const x = T.convertirUma(e); assert.ok(Number.isFinite(x.resultado) && x.resultado >= 0, "uma rara " + i); });
[undefined, -1, "x", NaN, 1e300].forEach((v, i) => { const x = T.umaEstimada(v); assert.ok(Number.isFinite(x.anual), "estimada rara " + i); });

// ---------- Incapacidad del IMSS ----------
// $15,000 al mes: SBC 500 x 1.0493 = 524.65. Enfermedad general 7 días: 4 pagados (desde el 4o.) x 60% (314.79) = 1,259.16
let inc = T.incapacidadImss({ tipo: "enfermedad", monto: 15000, dias: 7, semanas: 20 });
cerca(inc.sbc, 524.65, "SBC estimado");
cerca(inc.pagoDiario, 314.79, "60% diario");
assert.strictEqual(inc.diasPagados, 4);
cerca(inc.recibes, 1259.16, "enfermedad 7 días");
cerca(inc.sueldoDias, 3500, "sueldo de 7 días");
cerca(inc.diferencia, 2240.84, "lo que dejas de recibir");
// Riesgo de trabajo 10 días: 100% desde el primer día = 5,246.50
inc = T.incapacidadImss({ tipo: "riesgo", monto: 15000, dias: 10 });
cerca(inc.recibes, 5246.5, "riesgo 10 días");
assert.strictEqual(inc.cumple, true);
// 3 días o menos de enfermedad: el IMSS no paga
assert.strictEqual(T.incapacidadImss({ monto: 15000, dias: 3, semanas: 10 }).recibes, 0);
// Sin 4 semanas: no hay subsidio; eventual pide 6
assert.strictEqual(T.incapacidadImss({ monto: 15000, dias: 10, semanas: 3 }).cumple, false);
assert.strictEqual(T.incapacidadImss({ monto: 15000, dias: 10, semanas: 3 }).recibes, 0);
assert.strictEqual(T.incapacidadImss({ monto: 15000, dias: 10, semanas: 5, eventual: true }).cumple, false);
assert.strictEqual(T.incapacidadImss({ monto: 15000, dias: 10, semanas: "" }).cumple, null);
// SBC directo, con tope de 25 UMA y piso del mínimo
cerca(T.incapacidadImss({ dato: "sbc", monto: 5000, dias: 4, semanas: 10 }).sbc, 2932.75, "tope 25 UMA");
cerca(T.incapacidadImss({ dato: "sbc", monto: 100, dias: 4, semanas: 10 }).sbc, 315.04, "piso salario mínimo");
cerca(T.incapacidadImss({ dato: "sbc", monto: 100, dias: 4, semanas: 10, zona: "frontera" }).sbc, 440.87, "piso frontera");
// Máximo: 78 semanas en enfermedad, 52 en riesgo
assert.strictEqual(T.incapacidadImss({ monto: 15000, dias: 9999, semanas: 10 }).dias, 546);
assert.strictEqual(T.incapacidadImss({ tipo: "riesgo", monto: 15000, dias: 9999 }).dias, 364);
cerca(T.incapacidadImss({ monto: 15000, dias: 1 }).cuentaBancaria, 2835.36, "9 salarios mínimos");
assert.strictEqual(T.incapacidadImss({ monto: 0, dias: 5 }).ok, false);
[{}, { monto: -1 }, { monto: "x", dias: "y" }, { monto: 1e300, dias: 1e300, semanas: 1e300 }, { monto: 5000, dias: NaN, semanas: -4 }]
  .forEach((e, i) => { const r = T.incapacidadImss(e); if (r.ok) finito(r, "incapacidad rara " + i); });
{
  const fs = require("fs"), path = require("path");
  const pag = fs.readFileSync(path.join(__dirname, "..", "trabajo/incapacidad-imss/index.html"), "utf8");
  for (const t of ["$1,259.16", "$5,246.50", "$524.65", "60%", 'href="../../familia/maternidad-y-paternidad/"', "trabajo.js"])
    assert.ok(pag.includes(t), `incapacidad: falta ${t}`);
}

// ---------- Liquidación por despido injustificado ----------
// $15,000 al mes (500 diarios), del 1 nov 2021 al 31 oct 2026: 5 años. Sexto año: 22 días de vacaciones.
// SDI = 500 x (1 + (15 + 22 x 0.25) / 365) = 528.08. 3 meses = 90 x 528.08 = 47,527.20. Prima = 12 x 5 x 500 = 30,000.
// 20 días = 100 x 528.08 = 52,808. Exento ISR = 90 x 117.31 x 5 = 52,789.50. Tasa: ISR(15,000) = 1,402.82 / 15,000.
let li = T.liquidacionDespido({ salarioMensual: 15000, ingreso: C.fecha("2021-11-01"), salida: C.fecha("2026-10-31") });
assert.strictEqual(li.ok, true);
assert.strictEqual(li.anios, 5); assert.strictEqual(li.diasVac, 22);
cerca(li.sdi, 528.08, "SDI estimado");
cerca(li.tresMeses, 47527.2, "3 meses");
cerca(li.primaMonto, 30000, "prima de antigüedad");
cerca(li.basico, 77527.2, "liquidación básica");
cerca(li.veinteDias, 52808, "20 días por año");
cerca(li.conVeinte, 130335.2, "con 20 días");
cerca(li.exentoTotal, 52789.5, "90 UMA x 5 años");
cerca(li.isrBasico.gravado, 24737.7, "gravado básica");
cerca(li.isrBasico.retencion, 2313.5, "ISR básica");
cerca(li.isrConVeinte.retencion, 7252.18, "ISR con 20 días");
// SDI del recibo: se usa tal cual
li = T.liquidacionDespido({ salarioMensual: 15000, ingreso: C.fecha("2021-11-01"), salida: C.fecha("2026-10-31"), sdi: 600 });
cerca(li.tresMeses, 54000, "3 meses con SDI 600"); assert.strictEqual(li.sdiEstimado, false);
// Tope de la prima: 2 salarios mínimos (630.08); más de 6 meses cuenta como año para el exento
li = T.liquidacionDespido({ salarioMensual: 60000, ingreso: C.fecha("2023-03-01"), salida: C.fecha("2026-10-31") });
assert.strictEqual(li.prima.topado, true);
assert.strictEqual(li.aniosExento, 4, "3 años y 8 meses = 4 para el exento");
// Menos de un año: exento proporcional; sueldo vacío no calcula
li = T.liquidacionDespido({ salarioMensual: 10000, ingreso: C.fecha("2026-05-01"), salida: C.fecha("2026-07-30") });
assert.ok(li.aniosExento > 0 && li.aniosExento < 0.5);
assert.strictEqual(T.liquidacionDespido({ salarioMensual: 0, ingreso: C.fecha("2020-01-01"), salida: C.fecha("2026-01-01") }).ok, false);
[{}, { salarioMensual: -1 }, { salarioMensual: "x", sdi: "y" }, { salarioMensual: 1e300, sdi: 1e300 }, { salarioMensual: 5000, sdi: NaN, diasAguinaldo: -3 }]
  .forEach((e, i) => {
    const r = T.liquidacionDespido(Object.assign({ ingreso: C.fecha("2020-01-01"), salida: C.fecha("2026-01-01") }, e));
    if (r.ok) { finito(r, "liquidación rara " + i); finito(r.isrConVeinte, "liquidación ISR rara " + i); }
  });

// ---------- Nómina semanal y quincenal ----------
// Tarifas del Anexo 8: semana de 2,333.33 (renglón 3) = 682.65 x 10.88% + 96.95 = 171.22; quincena de 5,000 = 366.91.
cerca(T.isrTarifa(T.DATOS.nomina.semanal, 2333.33), 171.22, "ISR semanal");
cerca(T.isrTarifa(T.DATOS.nomina.quincenal, 5000), 366.91, "ISR quincenal");
assert.strictEqual(T.isrTarifa(T.DATOS.nomina.semanal, 0), 0);
let nm = T.nominaPeriodos({ monto: 10000, periodo: "mensual" });
cerca(nm.semana.subsidio, 123.34, "subsidio semanal 535.65 / 30.4 x 7");
cerca(nm.quincena.subsidio, 264.3, "subsidio quincenal");
cerca(nm.semana.isrRetenido, 47.88, "ISR semana con subsidio");
cerca(nm.quincena.isrRetenido, 102.61, "ISR quincena con subsidio");
cerca(nm.mes.neto, 9554.1, "mismo neto mensual que sueldo neto");
// Ejemplo de la página: $3,500 a la semana
nm = T.nominaPeriodos({ monto: 3500, periodo: "semanal" });
cerca(nm.sd, 500, "salario diario");
cerca(nm.semana.isrTarifa, 331.27, "ISR semana 3,500");
assert.strictEqual(nm.conSubsidio, false, "15,200 al mes pasa del tope");
cerca(nm.semana.imssObrero, 92.06, "IMSS semana");
cerca(nm.semana.neto, 3076.67, "neto semana");
cerca(nm.quincena.bruto, 7500, "quincena bruta");
cerca(nm.quincena.isrTarifa, 709.86, "ISR quincena 7,500");
cerca(nm.quincena.neto, 6592.88, "neto quincena");
// Salario mínimo: sin ISR ni IMSS; la cifra mensual de la CONASAMI con la casilla
nm = T.nominaPeriodos({ monto: 315.04, periodo: "diario" });
assert.strictEqual(nm.soloMinimo, true); cerca(nm.semana.neto, 2205.28, "7 x 315.04");
assert.strictEqual(T.nominaPeriodos({ monto: 9582.47, ganaMinimo: true }).soloMinimo, true);
assert.strictEqual(T.nominaPeriodos({ monto: 9582.47 }).soloMinimo, false);
assert.strictEqual(T.nominaPeriodos({ monto: 20000, ganaMinimo: true }).ganaMinimoNoAplica, true);
assert.strictEqual(T.nominaPeriodos({ monto: 440.87, periodo: "diario", zona: "frontera" }).soloMinimo, true);
[{}, { monto: -1 }, { monto: "x", periodo: "raro" }, { monto: 1e300 }, { monto: Infinity, zona: "luna" }]
  .forEach((e, i) => { const r = T.nominaPeriodos(e); finito(r.semana, "nómina rara " + i); finito(r.quincena, "nómina rara q " + i); });
{
  const fs = require("fs"), path = require("path");
  const liq = fs.readFileSync(path.join(__dirname, "..", "trabajo/liquidacion-despido-injustificado/index.html"), "utf8");
  for (const t of ["$528.08", "$47,527.20", "$30,000.00", "$77,527.20", "$130,335.20", "$52,789.50", "$2,313.50", 'href="../finiquito/"', "trabajo.js"])
    assert.ok(liq.includes(t), `liquidación: falta ${t}`);
  const nom = fs.readFileSync(path.join(__dirname, "..", "trabajo/nomina-semanal-quincenal/index.html"), "utf8");
  for (const t of ["$331.27", "$92.06", "$3,076.67", "$6,592.88", "$709.86", "$123.34", "$264.30", "trabajo.js"])
    assert.ok(nom.includes(t), `nómina: falta ${t}`);
}

console.log("OK: pruebas de trabajo (PTU, horas extra, incapacidad, liquidación y nómina) pasaron");
