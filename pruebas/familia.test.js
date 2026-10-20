// Pruebas de Familia y becas (apoyos del Bienestar, maternidad y paternidad, gastos de los hijos):
// node pruebas/familia.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const F = require("../assets/familia.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.006, `${msg}: ${a} != ${b}`);
const sinRaros = (obj, msg) => {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${k} = ${v}`);
    else if (v && typeof v === "object") sinRaros(v, `${msg}.${k}`);
  }
};

// ---------- Datos de ley ----------
const M = F.DATOS.maternidad;
assert.strictEqual(M.diasAntes + M.diasDespues, 84); // art. 101 LSS: 42 + 42
assert.strictEqual(M.semanasMinimas, 30); // art. 102 fr. I LSS
assert.strictEqual(M.maxTransferibles, 28); // art. 170 fr. II LFT: hasta 4 semanas
assert.strictEqual(F.DATOS.paternidad.diasLaborables, 5); // art. 132 fr. XXVII Bis LFT

// ---------- Apoyos del Bienestar (montos de ejemplo) ----------
// Valores de la página: 1 adulta mayor, 2 en secundaria y 1 en bachillerato, con los montos de ejemplo.
let a = F.sumaApoyos({ personas: { adultos: 1, secundaria: 2, bachillerato: 1 } });
assert.strictEqual(a.bimestre, 10900); // 6,400 + (1,900 + 700) + 1,900
assert.strictEqual(a.mes, 5450);
assert.strictEqual(a.pensiones, 6400);
assert.strictEqual(a.becas, 4500);
assert.strictEqual(a.pensionesAnio, 38400); // 6,400 x 6 bimestres
assert.strictEqual(a.personas, 4);
assert.strictEqual(a.renglones.find(x => x.clave === "secundaria").monto, 2600);
assert.strictEqual(a.acotado, false);

// Mismo resultado escribiendo los montos como texto (así llegan de la página)
a = F.sumaApoyos({
  personas: { adultos: "1", mujeres: "0", discapacidad: "0", secundaria: "2", bachillerato: "1" },
  montos: { adultos: "6400", mujeres: "3100", discapacidad: "3300", secundaria: "1900", secundariaAdicional: "700", bachillerato: "1900" }
});
assert.strictEqual(a.bimestre, 10900);

// Beca de secundaria: por familia más un extra por cada estudiante adicional
assert.strictEqual(F.sumaApoyos({ personas: { secundaria: 1 } }).bimestre, 1900);
assert.strictEqual(F.sumaApoyos({ personas: { secundaria: 3 } }).bimestre, 3300); // 1,900 + 2 x 700
assert.strictEqual(F.sumaApoyos({ personas: { secundaria: 0 } }).bimestre, 0);

// Varias pensiones: 2 adultos mayores y 1 mujer de 60 a 64
a = F.sumaApoyos({ personas: { adultos: 2, mujeres: 1 } });
assert.strictEqual(a.bimestre, 15900); // 2 x 6,400 + 3,100
assert.strictEqual(a.pensionesAnio, 95400);
assert.strictEqual(a.becas, 0);

// Entradas raras: vacías, negativas, decimales, texto, enormes
a = F.sumaApoyos({});
assert.strictEqual(a.bimestre, 0);
assert.strictEqual(a.personas, 0);
a = F.sumaApoyos({ personas: { adultos: -3, mujeres: "", discapacidad: "abc", secundaria: 1.7, bachillerato: Infinity } });
assert.strictEqual(a.bimestre, 1900); // solo 1 en secundaria
a = F.sumaApoyos({ personas: { adultos: 1e9 } });
assert.strictEqual(a.renglones[0].personas, 20);
assert.strictEqual(a.bimestre, 128000);
assert.strictEqual(a.acotado, true);
a = F.sumaApoyos({ personas: { adultos: 1 }, montos: { adultos: 1e12 } });
assert.strictEqual(a.bimestre, 100000);
assert.strictEqual(a.acotado, true);
a = F.sumaApoyos({ personas: { adultos: 1 }, montos: { adultos: "" } }); // borró el monto
assert.strictEqual(a.bimestre, 0);
a = F.sumaApoyos({ personas: { adultos: 1 }, montos: { adultos: -500 } });
assert.strictEqual(a.bimestre, 0);
sinRaros(F.sumaApoyos({ personas: { adultos: NaN, secundaria: 1e300 }, montos: { secundaria: 1e300, secundariaAdicional: 1e300 } }), "apoyos raros");

// ---------- Maternidad ----------
// Valores de la página: sueldo de 15,000, 52 semanas, 42 días antes del parto.
// SBC estimado = 15,000 / 30 x 1.0493 = 524.65. Pago = 524.65 x 84 = 44,070.60.
let m = F.maternidad({ dato: "sueldo", monto: "15000", semanas: "52", diasAntes: "42" });
assert.ok(m.ok);
cerca(m.sbc, 524.65, "SBC estimado");
cerca(m.salarioDiario, 500, "salario diario");
cerca(m.pagoDiario, 524.65, "100% del SBC");
assert.strictEqual(m.diasAntes, 42);
assert.strictEqual(m.diasDespues, 42);
cerca(m.antes, 22035.30, "42 días antes");
cerca(m.despues, 22035.30, "42 días después");
cerca(m.imss, 44070.60, "84 días");
cerca(m.recibes, 44070.60, "recibes");
assert.strictEqual(m.cumple, true);
assert.strictEqual(m.quienPaga, "imss");
assert.deepStrictEqual(m.avisos, []);

// Pasar 4 semanas para después: 14 días antes y 70 después; el total no cambia.
m = F.maternidad({ monto: 15000, semanas: 52, diasAntes: 14 });
assert.strictEqual(m.diasAntes, 14);
assert.strictEqual(m.diasDespues, 70);
assert.strictEqual(m.transferidos, 28);
cerca(m.antes, 7345.10, "14 días");
cerca(m.despues, 36725.50, "70 días");
cerca(m.imss, 44070.60, "total igual");
// Días fuera de rango se ajustan a 14..42
assert.strictEqual(F.maternidad({ monto: 15000, diasAntes: 5 }).diasAntes, 14);
assert.strictEqual(F.maternidad({ monto: 15000, diasAntes: -10 }).diasAntes, 14);
assert.strictEqual(F.maternidad({ monto: 15000, diasAntes: 60 }).diasAntes, 42);
assert.strictEqual(F.maternidad({ monto: 15000, diasAntes: "" }).diasAntes, 42);
assert.strictEqual(F.maternidad({ monto: 15000, diasAntes: 5 }).avisos.length, 1);

// Semanas: 30 justas sí cumple; 29 no, y paga el patrón el salario íntegro (500 x 84 = 42,000)
assert.strictEqual(F.maternidad({ monto: 15000, semanas: 30 }).cumple, true);
m = F.maternidad({ monto: 15000, semanas: 29 });
assert.strictEqual(m.cumple, false);
assert.strictEqual(m.quienPaga, "patron");
cerca(m.patron, 42000, "salario íntegro");
cerca(m.recibes, 42000, "recibes del patrón");
// Sin semanas capturadas: no sabemos, pero se muestra lo del IMSS
m = F.maternidad({ monto: 15000, semanas: "" });
assert.strictEqual(m.cumple, null);
assert.strictEqual(m.semanas, null);
cerca(m.recibes, 44070.60, "sin semanas");
// Semanas negativas o enormes
assert.strictEqual(F.maternidad({ monto: 15000, semanas: -4 }).semanas, 0);
assert.strictEqual(F.maternidad({ monto: 15000, semanas: -4 }).cumple, false);
assert.strictEqual(F.maternidad({ monto: 15000, semanas: 1e9 }).semanas, 53);

// Piso del salario mínimo: 5,000 / 30 x 1.0493 = 174.88 < 315.04
m = F.maternidad({ monto: 5000, semanas: 40 });
assert.ok(m.conPiso);
cerca(m.sbc, C.DATOS.salarioMinimo.general, "piso");
cerca(m.imss, 315.04 * 84, "84 días de salario mínimo"); // 26,463.36
// Tope de 25 UMA: 25 x 117.31 = 2,932.75 diarios
m = F.maternidad({ monto: 200000, semanas: 52 });
assert.ok(m.topado);
cerca(m.tope, 2932.75, "tope");
cerca(m.imss, 246351, "84 días al tope");
assert.ok(m.avisos.some(t => t.includes("25 UMA")));

// Con el SBC del recibo: 600 diarios x 84 = 50,400
m = F.maternidad({ dato: "sbc", monto: "600", semanas: 52 });
cerca(m.sbc, 600, "SBC capturado");
cerca(m.imss, 50400, "SBC x 84");
cerca(m.salarioDiario, 571.81, "salario diario estimado"); // 600 / 1.0493
// Sin redondear el diario antes de multiplicar: 600 / 1.0493 x 84 = 48,032.0213 -> 48,032.02 (no 571.81 x 84)
cerca(F.maternidad({ dato: "sbc", monto: 600, semanas: 10 }).patron, 48032.02, "patrón con SBC");
// Patrón con sueldo de 8,000 y menos de 30 semanas: 8,000 / 30 x 84 = 22,400.00 exactos (no 266.67 x 84)
m = F.maternidad({ monto: 8000, semanas: 20 });
assert.strictEqual(m.quienPaga, "patron");
cerca(m.salarioDiario, 266.67, "diario mostrado");
assert.strictEqual(m.patron, 22400);
assert.strictEqual(m.recibes, 22400);

// Zona Libre de la Frontera Norte: el piso es el mínimo de esa zona, 440.87 (art. 28 LSS)
m = F.maternidad({ monto: 5000, semanas: 40, zona: "frontera" });
assert.strictEqual(m.zona, "frontera");
assert.ok(m.conPiso);
cerca(m.sbc, 440.87, "piso frontera");
cerca(m.imss, 37033.08, "84 días de mínimo de la frontera"); // 440.87 x 84
assert.ok(m.avisos.some(t => t.includes("Frontera Norte")));
// 10,000 al mes: SBC 10,000 / 30 x 1.0493 = 349.77. Pasa el mínimo general, pero no el de la frontera.
m = F.maternidad({ monto: 10000, semanas: 40 });
assert.ok(!m.conPiso);
cerca(m.imss, 29380.68, "349.77 x 84");
m = F.maternidad({ monto: 10000, semanas: 40, zona: "frontera" });
assert.ok(m.conPiso);
cerca(m.imss, 37033.08, "con piso de la frontera");
assert.strictEqual(F.maternidad({ monto: 10000, zona: "otra" }).zona, "general");

// Sin sueldo: no se calcula
for (const v of ["", 0, -100, "abc", null, undefined, NaN]) {
  assert.strictEqual(F.maternidad({ monto: v }).ok, false, `maternidad con ${v}`);
}
m = F.maternidad({ monto: 1e15, semanas: 52 });
assert.ok(m.ok && m.topado && m.avisos.length >= 2);
sinRaros(m, "maternidad enorme");
sinRaros(F.maternidad({ dato: "sbc", monto: 1e300, semanas: Infinity, diasAntes: NaN }), "maternidad rara");

// ---------- Paternidad ----------
// Valores de la página: 15,000 al mes, 5 días de permiso, trabaja 5 días a la semana.
// Sueldo de una semana = 15,000 / 30 x 7 = 3,500. 5 días laborables de una semana de 5 = una semana: 3,500.
let p = F.paternidad({ sueldoMensual: "15000", dias: "5", diasSemana: "5" });
assert.ok(p.ok);
cerca(p.sd, 500, "salario diario");
cerca(p.semanal, 3500, "sueldo de una semana");
cerca(p.porDia, 700, "sueldo por día trabajado"); // 3,500 / 5
assert.strictEqual(p.semanas, 1);
cerca(p.pago, 3500, "5 días");
assert.strictEqual(p.quienPaga, "patron");
assert.deepStrictEqual(p.avisos, []);
// Sin decir los días por semana se toman 5
cerca(F.paternidad({ sueldoMensual: 15000, dias: 5 }).pago, 3500, "5 días por omisión");
// Semana de 6 días: 5 días son 5/6 de la semana: 3,500 x 5 / 6 = 2,916.666 -> 2,916.67
cerca(F.paternidad({ sueldoMensual: 15000, dias: 5, diasSemana: 6 }).pago, 2916.67, "semana de 6 días");
cerca(F.paternidad({ sueldoMensual: 15000, dias: 10 }).pago, 7000, "10 días que da la empresa");
// Sin redondear el diario: 22,000 x 7 x 10 / (30 x 5) = 10,266.666 -> 10,266.67
cerca(F.paternidad({ sueldoMensual: 22000, dias: 10 }).pago, 10266.67, "22,000 y 10 días");
// 22,000 x 7 x 10 / (30 x 6) = 8,555.555 -> 8,555.56
cerca(F.paternidad({ sueldoMensual: 22000, dias: 10, diasSemana: 6 }).pago, 8555.56, "22,000, 10 días, semana de 6");
// Semana de 7 días: 22,000 / 30 x 10 = 7,333.333 -> 7,333.33 (redondeando antes el diario saldría 7,333.30)
cerca(F.paternidad({ sueldoMensual: 22000, dias: 10, diasSemana: 7 }).pago, 7333.33, "22,000, 10 días, semana de 7");
// Días por semana raros: vacío, 0 o negativo cuentan como 5; más de 7 se acota a 7
for (const v of ["", 0, -3, "abc", null]) assert.strictEqual(F.paternidad({ sueldoMensual: 15000, diasSemana: v }).diasSemana, 5);
assert.strictEqual(F.paternidad({ sueldoMensual: 15000, diasSemana: 9 }).diasSemana, 7);
// Menos de 5 días: se calcula con el mínimo de ley
p = F.paternidad({ sueldoMensual: 15000, dias: 3 });
assert.strictEqual(p.dias, 5);
assert.ok(p.alMinimo);
cerca(p.pago, 3500, "mínimo de ley");
assert.strictEqual(F.paternidad({ sueldoMensual: 15000, dias: "" }).dias, 5);
assert.strictEqual(F.paternidad({ sueldoMensual: 15000, dias: -2 }).dias, 5);
assert.strictEqual(F.paternidad({ sueldoMensual: 15000, dias: 1e9 }).dias, 365);
for (const v of ["", 0, -1, "x"]) assert.strictEqual(F.paternidad({ sueldoMensual: v }).ok, false);
sinRaros(F.paternidad({ sueldoMensual: 1e300, dias: 1e300, diasSemana: 1e300 }), "paternidad enorme");
sinRaros(F.paternidad({ sueldoMensual: 15000, dias: NaN, diasSemana: Infinity }), "paternidad rara");

// ---------- Gastos de los hijos (pensión alimenticia) ----------
// Valores de la página: gastos de 7,000 al mes; quien vive con los hijos gana 12,000 y la otra persona 18,000.
// La otra persona gana 18,000 / 30,000 = 60% del total: 7,000 x 60% = 4,200; quien vive con ellos, 2,800.
const gastosPagina = { comida: "3000", escuela: "800", salud: "400", ropa: "500", vivienda: "1500", transporte: "400", otros: "400" };
let g = F.gastosHijos({ gastos: gastosPagina, ingresoCon: "12000", ingresoOtro: "18000" });
assert.ok(g.ok);
assert.strictEqual(g.total, 7000);
cerca(g.parteOtro, 0.6, "parte de la otra persona");
cerca(g.aporteOtro, 4200, "aporte de la otra persona");
cerca(g.aporteCon, 2800, "aporte de quien vive con los hijos");
cerca(g.quincenaOtro, 2100, "por quincena");
cerca(g.quincenaOtro2, 2100, "segunda quincena");
cerca(g.delIngresoOtro, 4200 / 18000, "parte del ingreso"); // 23.33%
cerca(g.delIngresoCon, 2800 / 12000, "parte del ingreso de quien vive con ellos");
assert.strictEqual(g.rebasa, false);

// Solo una persona tiene ingresos
g = F.gastosHijos({ gastos: gastosPagina, ingresoCon: 12000, ingresoOtro: 0 });
assert.ok(g.ok);
assert.strictEqual(g.aporteOtro, 0);
assert.strictEqual(g.aporteCon, 7000);
assert.strictEqual(g.delIngresoOtro, 0);
g = F.gastosHijos({ gastos: gastosPagina, ingresoCon: "", ingresoOtro: 10000 });
assert.strictEqual(g.aporteOtro, 7000);

// Repartos con centavos: 1,000 entre ingresos de 1 y 2 -> 333.33 y 666.67, suman 1,000
g = F.gastosHijos({ gastos: { comida: 1000 }, ingresoCon: 1, ingresoOtro: 2 });
cerca(g.aporteOtro, 666.67, "dos tercios");
cerca(g.aporteCon, 333.33, "un tercio");
cerca(g.aporteOtro + g.aporteCon, 1000, "suma");
// Quincenas que suman exacto: gastos de 5,000; ingresos de 10,000 y 5,000 -> 1/3 = 1,666.67 al mes.
// Primera quincena 833.33 y segunda 833.34: suman 1,666.67 (no 833.34 x 2 = 1,666.68).
g = F.gastosHijos({ gastos: { comida: 5000 }, ingresoCon: 10000, ingresoOtro: 5000 });
assert.strictEqual(g.aporteOtro, 1666.67);
assert.strictEqual(g.aporteCon, 3333.33);
assert.strictEqual(g.quincenaOtro, 833.33);
assert.strictEqual(g.quincenaOtro2, 833.34);
cerca(g.quincenaOtro + g.quincenaOtro2, g.aporteOtro, "dos quincenas = mes");
// Aporte de 666.67 -> 333.33 y 333.34
g = F.gastosHijos({ gastos: { comida: 1000 }, ingresoCon: 1, ingresoOtro: 2 });
assert.strictEqual(g.quincenaOtro, 333.33);
assert.strictEqual(g.quincenaOtro2, 333.34);

// Gastos mayores que lo que ganan los dos
g = F.gastosHijos({ gastos: gastosPagina, ingresoCon: 3000, ingresoOtro: 2000 });
assert.ok(g.rebasa);
cerca(g.aporteOtro, 2800, "40% de 7,000");

// Sin gastos o sin ingresos
g = F.gastosHijos({ ingresoCon: 12000, ingresoOtro: 18000 });
assert.strictEqual(g.ok, false);
assert.strictEqual(g.motivo, "gastos");
assert.strictEqual(g.total, 0);
g = F.gastosHijos({ gastos: gastosPagina, ingresoCon: 0, ingresoOtro: -5 });
assert.strictEqual(g.ok, false);
assert.strictEqual(g.motivo, "ingresos");
assert.strictEqual(g.total, 7000);
assert.strictEqual(F.gastosHijos().ok, false);

// Negativos y enormes
g = F.gastosHijos({ gastos: { comida: -3000, escuela: 1000 }, ingresoCon: 1, ingresoOtro: 1 });
assert.strictEqual(g.total, 1000);
g = F.gastosHijos({ gastos: { comida: 1e20 }, ingresoCon: 1e20, ingresoOtro: 1e20 });
assert.ok(g.acotado);
assert.strictEqual(g.total, 1e7);
cerca(g.aporteOtro, 5e6, "mitad");
sinRaros(g, "gastos enormes");
sinRaros(F.gastosHijos({ gastos: { comida: Infinity, otros: NaN }, ingresoCon: Infinity, ingresoOtro: NaN }), "gastos raros");

// ---------- Páginas de la sección ----------
const raiz = path.join(__dirname, "..");
const paginas = ["familia/index.html", "familia/becas/index.html", "familia/maternidad-y-paternidad/index.html",
  "familia/pension-alimenticia/index.html"];
const titulos = new Set();
for (const rel of paginas) {
  const html = fs.readFileSync(path.join(raiz, rel), "utf8");
  const titulo = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  assert.ok(titulo && titulo.endsWith(" | Cuentas Claras MX") && titulo.includes("2026"), `${rel}: título`);
  assert.ok(!titulos.has(titulo), `${rel}: título repetido`);
  titulos.add(titulo);
  const desc = (html.match(/<meta name="description" content="([^"]+)">/) || [])[1];
  assert.ok(desc && desc.length <= 160, `${rel}: descripción de ${desc && desc.length} caracteres`);
  assert.ok(!html.includes("—"), `${rel}: sin guiones largos`);
  assert.ok(/sitio independiente/i.test(html) && html.includes("aviso-legal/"), `${rel}: pie con aviso`);
  assert.ok(/No guardamos tus datos/.test(html), `${rel}: no guardamos tus datos`);
  assert.ok(!/<input[^>]+(curp|rfc|password)/i.test(html), `${rel}: no pide datos personales`);
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|#|mailto:)/.test(url)) continue;
    assert.ok(!url.startsWith("/"), `${rel}: ruta absoluta ${url}`);
    const destino = path.join(raiz, path.dirname(rel), url);
    const existe = url.endsWith("/") ? fs.existsSync(path.join(destino, "index.html")) : fs.existsSync(destino);
    assert.ok(existe, `${rel}: no existe ${url}`);
  }
}
// El índice enlaza las tres páginas
const indice = fs.readFileSync(path.join(raiz, "familia/index.html"), "utf8");
for (const s of ["becas/", "maternidad-y-paternidad/", "pension-alimenticia/"]) assert.ok(indice.includes(`href="${s}"`), `índice: ${s}`);

// Los ejemplos de cada guía coinciden con los valores cargados en su calculadora
const valor = (html, id) => (html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`)) || [])[1];
const bec = fs.readFileSync(path.join(raiz, "familia/becas/index.html"), "utf8");
const claves = ["adultos", "mujeres", "discapacidad", "secundaria", "bachillerato"];
const per = {}, mon = {};
for (const k of claves) { per[k] = valor(bec, "p-" + k); mon[k] = valor(bec, "m-" + k); }
mon.secundariaAdicional = valor(bec, "m-secundariaAdicional");
for (const k of claves) assert.strictEqual(+mon[k], F.DATOS.apoyos[k].ejemplo, `monto de ejemplo en la página: ${k}`);
assert.strictEqual(+mon.secundariaAdicional, F.DATOS.apoyos.secundaria.adicional);
assert.strictEqual(F.sumaApoyos({ personas: per, montos: mon }).bimestre, 10900);
for (const t of ["$10,900", "$5,450", "$38,400", "$2,600"]) assert.ok(bec.includes(t), `ejemplo de becas: ${t}`);

const mat = fs.readFileSync(path.join(raiz, "familia/maternidad-y-paternidad/index.html"), "utf8");
assert.strictEqual(valor(mat, "monto"), "15000");
assert.strictEqual(valor(mat, "semanas"), "52");
assert.strictEqual(valor(mat, "sueldo-p"), "15000");
assert.strictEqual(valor(mat, "dias-p"), "5");
assert.ok(mat.includes('<option value="42" selected>'));
assert.ok(mat.includes('<option value="general" selected>'), "zona por omisión: resto del país");
assert.ok(mat.includes('<option value="5" selected>'), "semana de 5 días por omisión");
for (const t of ["$524.65", "$44,070.60", "$22,035.30", "$7,345.10", "$36,725.50", "$3,500", "$2,916.67", "$2,932.75", "$42,000",
  "$315.04", "$440.87"]) {
  assert.ok(mat.includes(t), `ejemplo de maternidad: ${t}`);
}
// Art. 140 Bis LSS: hijos "de hasta dieciséis años"
assert.ok(mat.includes("de hasta 16 años") && !mat.includes("menores de 16"), "140 Bis: de hasta 16 años");

const pen = fs.readFileSync(path.join(raiz, "familia/pension-alimenticia/index.html"), "utf8");
const gp = {};
for (const gg of F.DATOS.gastos) gp[gg.clave] = valor(pen, "g-" + gg.clave);
assert.deepStrictEqual(gp, gastosPagina);
assert.strictEqual(valor(pen, "ing-con"), "12000");
assert.strictEqual(valor(pen, "ing-otro"), "18000");
for (const t of ["$7,000", "$4,200", "$2,800", "$2,100", "23.3%", "60%"]) assert.ok(pen.includes(t), `ejemplo de pensión: ${t}`);
// La guía no inventa un porcentaje legal único
assert.ok(/no hay un porcentaje único/i.test(pen));
// Art. 308 del Código Civil Federal: educación primaria, no "la escuela" en general
assert.ok(pen.includes("educación primaria"), "308 CCF: educación primaria");

// Requisitos de becas: nacionalidad y edad de Hijos de Madres Trabajadoras
assert.ok(bec.includes("Personas mexicanas de 65 años o más"), "adultos mayores: mexicanas");
assert.ok(bec.includes("Mujeres mexicanas de 60 a 64 años"), "mujeres bienestar: mexicanas");
assert.ok(bec.includes("menores de 4 años") && !bec.includes("de 1 a 4 años"), "madres trabajadoras: menores de 4");

// Sin datos, las páginas muestran $0.00 con mxn() y no la cadena "$0"
for (const [nombre, html] of [["becas", bec], ["maternidad", mat], ["pensión", pen]]) {
  assert.ok(!/"\$0"/.test(html), `${nombre}: usa mxn(0), no "$0"`);
}

console.log("familia.test.js: todas las pruebas pasaron");
