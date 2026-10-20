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

console.log("OK: pruebas de trabajo (PTU y horas extra) pasaron");
