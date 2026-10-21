// Pruebas de la temporada de aguinaldo (pensionados, gobierno y fecha límite): node pruebas/aguinaldo-temporada.test.js
// Los valores esperados se calcularon a mano. También revisa que los ejemplos de las páginas digan lo mismo.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const T = require("../assets/trabajo.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);
const finito = (r, msg) => Object.entries(r).forEach(([k, v]) => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${k} = ${v}`);
});
const pagina = rel => fs.readFileSync(path.join(__dirname, "..", rel, "index.html"), "utf8");
const d = t => C.fecha(t);

// ---------- Pensionados ----------
// IMSS Ley 73 (vejez o cesantía): una mensualidad. $10,000 de pensión dan $10,000 de aguinaldo en noviembre.
let p = T.aguinaldoPension({ pensionMensual: 10000, tipo: "imss73" });
assert.strictEqual(p.derecho, true);
assert.strictEqual(p.dias, 30);
cerca(p.total, 10000, "IMSS Ley 73: una mensualidad");
assert.strictEqual(p.partes.length, 1);
cerca(p.partes[0].monto, 10000, "IMSS en un solo pago");
// ISSSTE: 40 días. 10,000 / 30 = 333.33; x 40 = 13,333.33; en dos partes de 6,666.67.
p = T.aguinaldoPension({ pensionMensual: 10000, tipo: "issste" });
assert.strictEqual(p.dias, 40);
cerca(p.diaria, 333.33, "pensión diaria");
cerca(p.total, 13333.33, "ISSSTE: 40 días");
assert.strictEqual(p.partes.length, 2);
cerca(p.partes[0].monto, 6666.67, "ISSSTE primera parte (noviembre)");
cerca(p.partes[1].monto, 6666.67, "ISSSTE segunda parte (enero)");
assert.ok(/noviembre/.test(p.partes[0].cuando) && /enero/.test(p.partes[1].cuando));
// Invalidez: al menos 30 días (art. 142 LSS). Riesgo de trabajo: 15 días (art. 58 fr. IV LSS).
p = T.aguinaldoPension({ pensionMensual: 10000, tipo: "imssInvalidez" });
cerca(p.total, 10000, "invalidez");
assert.strictEqual(p.minimo, true);
cerca(T.aguinaldoPension({ pensionMensual: 10000, tipo: "imssRiesgo" }).total, 5000, "riesgo de trabajo: 15 días");
// Sin aguinaldo: Ley 97 por vejez o cesantía y Pensión para el Bienestar
for (const tipo of ["imss97", "bienestar"]) {
  p = T.aguinaldoPension({ pensionMensual: 10000, tipo });
  assert.strictEqual(p.derecho, false, tipo);
  assert.strictEqual(p.total, 0, tipo);
  assert.strictEqual(p.partes.length, 0, tipo);
}
// Tipo desconocido: se usa la regla del IMSS Ley 73
assert.strictEqual(T.aguinaldoPension({ pensionMensual: 1, tipo: "toString" }).tipo, "imss73");
assert.strictEqual(T.aguinaldoPension({ pensionMensual: 1, tipo: "x" }).tipo, "imss73");
// Parte libre de ISR de una pensión: 15 UMA diarias = 15 x 3,566.22 al mes = 53,493.30
p = T.aguinaldoPension({ pensionMensual: 10000 });
cerca(p.exentoPensionMensual, 53493.30, "15 UMA al mes");
assert.strictEqual(p.pasaExento, false);
assert.strictEqual(T.aguinaldoPension({ pensionMensual: 60000 }).pasaExento, true);
// Entradas raras
[{}, { pensionMensual: "" }, { pensionMensual: -5 }, { pensionMensual: "abc" }, { pensionMensual: NaN },
  { pensionMensual: Infinity, tipo: "issste" }, { pensionMensual: 1e300, tipo: "imssRiesgo" }].forEach((e, i) => {
  const r = T.aguinaldoPension(e);
  finito(r, "pensión caso " + i);
  assert.ok(r.total >= 0, "pensión no negativa " + i);
  r.partes.forEach(x => assert.ok(Number.isFinite(x.monto)));
});
p = T.aguinaldoPension({ pensionMensual: 1e300 });
assert.strictEqual(p.recortado, true);
cerca(p.pension, 1e8, "pensión recortada");

// ---------- Gobierno y maestros ----------
// $15,000 al mes = $500 diarios; 40 días = $20,000: $10,000 antes del 15 de diciembre y $10,000 en enero.
let g = T.aguinaldoGobierno({ salarioMensual: 15000, ingreso: d("2020-01-16"), dias: 40, anio: 2026 });
cerca(g.sd, 500, "salario diario");
assert.strictEqual(g.trabajados, 365);
cerca(g.bruto, 20000, "40 días");
cerca(g.primera, 10000, "primera mitad");
cerca(g.segunda, 10000, "segunda mitad");
cerca(g.exento, 3519.30, "30 UMA");
cerca(g.gravado, 16480.70, "parte que paga ISR");
assert.strictEqual(g.menosDeLey, false);
// Entró el 1 de julio de 2026: 184 días; 40 x 184 / 365 = 20.16 días; x 500 = 10,082.19
g = T.aguinaldoGobierno({ salarioMensual: 15000, ingreso: d("2026-07-01"), dias: 40, anio: 2026 });
assert.strictEqual(g.trabajados, 184);
cerca(g.diasProp, 20.16, "días proporcionales");
cerca(g.bruto, 10082.19, "proporcional desde el 1 de julio");
cerca(g.primera + g.segunda, g.bruto, "las dos partes suman el total");
// 90 días (algunos maestros): 15,000 / 30 x 90 = 45,000
cerca(T.aguinaldoGobierno({ salarioMensual: 15000, dias: 90, anio: 2026 }).bruto, 45000, "90 días");
// Sin fecha: año completo; con los días por omisión: 40
g = T.aguinaldoGobierno({ salarioMensual: 15000 });
assert.strictEqual(g.dias, 40);
cerca(g.bruto, 20000, "por omisión 40 días y año completo");
// Menos de 40 días: se avisa. Más de 365: se recorta.
assert.strictEqual(T.aguinaldoGobierno({ salarioMensual: 15000, dias: 15 }).menosDeLey, true);
g = T.aguinaldoGobierno({ salarioMensual: 15000, dias: 1000 });
assert.strictEqual(g.diasAcotado, true);
assert.strictEqual(g.dias, 365);
// Entra después del año: no le toca nada de ese año
g = T.aguinaldoGobierno({ salarioMensual: 15000, ingreso: d("2027-02-01"), anio: 2026 });
assert.strictEqual(g.entraDespues, true);
assert.strictEqual(g.bruto, 0);
[{}, { salarioMensual: "", dias: "" }, { salarioMensual: -1, dias: -40, ingreso: "x" }, { salarioMensual: "abc", ingreso: new Date("nada") },
  { salarioMensual: 1e300, dias: 1e300, ingreso: d("1950-01-01") }].forEach((e, i) => {
  const r = T.aguinaldoGobierno(e);
  finito(r, "gobierno caso " + i);
  assert.ok(r.bruto >= 0, "gobierno no negativo " + i);
});
assert.strictEqual(T.aguinaldoGobierno({ salarioMensual: 1e300 }).recortado, true);

// ---------- Si renuncias o te despiden ----------
// $12,000 al mes ($400 diarios), último día el 30 de junio de 2026: 181 días; 15 x 181 / 365 x 400 = 2,975.34
let s = T.aguinaldoSalida({ salarioMensual: 12000, ingreso: d("2024-05-10"), salida: d("2026-06-30"), dias: 15 });
assert.strictEqual(s.trabajados, 181);
cerca(s.bruto, 2975.34, "proporcional al 30 de junio");
assert.strictEqual(s.anio, 2026);
cerca(s.exentoAplicado, 2975.34, "todo libre de ISR (menos de 30 UMA)");
assert.strictEqual(s.gravado, 0);
// Entró el 1 de marzo y salió el 31 de octubre de 2026: 245 días; 15 x 245 / 365 x 400 = 4,027.40
s = T.aguinaldoSalida({ salarioMensual: 12000, ingreso: d("2026-03-01"), salida: d("2026-10-31") });
assert.strictEqual(s.trabajados, 245);
cerca(s.bruto, 4027.40, "entrada y salida en el mismo año");
// Igual que el aguinaldo proporcional del finiquito
const f = C.finiquito({ salarioMensual: 12000, ingreso: d("2026-03-01"), salida: d("2026-10-31") });
cerca(f.conceptos.find(c => /Aguinaldo/.test(c.nombre)).monto, s.bruto, "coincide con el finiquito");
// Más días de la empresa
cerca(T.aguinaldoSalida({ salarioMensual: 12000, ingreso: d("2020-01-01"), salida: d("2026-12-31"), dias: 30 }).bruto, 12000, "30 días, año completo");
assert.strictEqual(T.aguinaldoSalida({ salarioMensual: 12000, ingreso: d("2020-01-01"), salida: d("2026-06-30"), dias: 10 }).menosDeLey, true);
[{}, { salarioMensual: "", ingreso: null, salida: null }, { salarioMensual: -1, dias: -1, ingreso: new Date("x"), salida: new Date("y") },
  { salarioMensual: 1e300, dias: 1e300, ingreso: d("2026-12-31"), salida: d("2026-01-01") }].forEach((e, i) => {
  const r = T.aguinaldoSalida(e);
  finito(r, "salida caso " + i);
  assert.ok(r.bruto >= 0, "salida no negativa " + i);
});

// ---------- Fechas y multas ----------
// 2026: el 20 de diciembre cae en domingo; el último día es el sábado 19 y el último día hábil, el viernes 18.
let k = T.calendarioAguinaldo(2026);
assert.strictEqual(k.diaVeinte, "domingo");
assert.strictEqual(k.limite.getDate(), 19);
assert.strictEqual(k.diaLimite, "sábado");
assert.strictEqual(k.ultimoHabil.getDate(), 18);
assert.strictEqual(k.diaHabil, "viernes");
assert.strictEqual(k.reclamarHasta.getFullYear(), 2027);
assert.strictEqual(k.reclamarHasta.getMonth(), 11);
assert.strictEqual(k.reclamarHasta.getDate(), 20);
cerca(k.multaMin, 5865.50, "50 UMA");
cerca(k.multaMax, 586550, "5,000 UMA");
// 2025: el 20 fue sábado; el último día, el viernes 19
k = T.calendarioAguinaldo(2025);
assert.strictEqual(k.diaVeinte, "sábado");
assert.strictEqual(k.diaLimite, "viernes");
assert.strictEqual(k.ultimoHabil.getDate(), 19);
// 2027: el 20 es lunes; el último día es el domingo 19 y el último hábil, el viernes 17
k = T.calendarioAguinaldo(2027);
assert.strictEqual(k.diaLimite, "domingo");
assert.strictEqual(k.ultimoHabil.getDate(), 17);
assert.strictEqual(T.calendarioAguinaldo().anio, C.DATOS.anio);
assert.strictEqual(T.calendarioAguinaldo("abc").anio, C.DATOS.anio);

// ---------- Lo que dicen las páginas ----------
const pen = pagina("trabajo/aguinaldo-pensionados");
for (const t of ["$13,333.33", "$6,666.67", "$53,493.30", "2 de noviembre de 2026"]) assert.ok(pen.includes(t), `pensionados: falta ${t}`);
assert.ok(pen.includes('src="../../assets/trabajo.js"'), "pensionados: carga trabajo.js");
const gob = pagina("trabajo/aguinaldo-gobierno");
for (const t of ["$20,000", "$10,000", "$10,082.19", "$3,519.30", "15 de diciembre", "15 de enero"]) assert.ok(gob.includes(t), `gobierno: falta ${t}`);
const cuando = pagina("trabajo/cuando-pagan-el-aguinaldo");
k = T.calendarioAguinaldo(2026);
for (const t of ["sábado 19 de diciembre de 2026", "viernes 18", "20 de diciembre de 2027", "$5,865.50", "$586,550", "$2,975.34", "$3,519.30", 'href="../aguinaldo/"'])
  assert.ok(cuando.includes(t), `cuándo pagan: falta ${t}`);
const ag = pagina("trabajo/aguinaldo");
for (const h of ["../aguinaldo-pensionados/", "../aguinaldo-gobierno/", "../cuando-pagan-el-aguinaldo/"]) assert.ok(ag.includes(`href="${h}"`), `aguinaldo: falta enlace a ${h}`);

console.log("OK: pruebas de la temporada de aguinaldo pasaron");
