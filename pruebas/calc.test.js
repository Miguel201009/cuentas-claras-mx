// Pruebas de los cálculos: node pruebas/calc.test.js
const assert = require("assert");
const C = require("../assets/calc.js");
const f = C.fecha;
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);

// Vacaciones, art. 76 LFT
assert.deepStrictEqual([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 21, 26].map(C.diasVacaciones),
  [12, 14, 16, 18, 20, 22, 22, 24, 24, 26, 28, 30]);
assert.strictEqual(C.diasVacaciones(0), 0);

// Años completos
assert.strictEqual(C.aniosCompletos(f("2022-08-01"), f("2026-07-31")), 3);
assert.strictEqual(C.aniosCompletos(f("2022-08-01"), f("2026-08-01")), 4);

// Aguinaldo: año completo y proporcional
let a = C.aguinaldo({ salarioMensual: 12000, ingreso: f("2020-01-01") });
cerca(a.bruto, 6000, "aguinaldo completo");
a = C.aguinaldo({ salarioMensual: 12000, ingreso: f("2026-03-01") });
assert.strictEqual(a.trabajados, 306);
cerca(a.bruto, 400 * 15 * 306 / 365, "aguinaldo proporcional");
cerca(a.exento, 3519.3, "exento 30 UMA");

// Finiquito por renuncia con menos de 15 años: sin prima de antigüedad ni indemnización
let r = C.finiquito({ salarioMensual: 12000, ingreso: f("2022-08-01"), salida: f("2026-10-31") });
assert.strictEqual(r.anios, 4);
assert.strictEqual(r.aplicaPrimaAnt, false);
assert.strictEqual(r.conceptos.length, 5);
const vac = 20 * (92 / 365); // año 5 de servicio, 92 días del 1 ago al 31 oct contando el último día
cerca(r.diasVac, vac, "días de vacaciones");
cerca(r.conceptos[3].monto, 400 * vac * 0.25, "prima vacacional");

// Liquidación por despido: indemnización y prima de antigüedad con tope de 2 salarios mínimos
r = C.finiquito({ salarioMensual: 30000, ingreso: f("2022-08-01"), salida: f("2026-10-31"), motivo: "despido" });
assert.strictEqual(r.aplicaPrimaAnt, true);
const prima = r.conceptos.find(c => c.nombre === "Prima de antigüedad").monto;
cerca(prima, 12 * r.antiguedad * 2 * 315.04, "prima de antigüedad topada");
cerca(r.conceptos.find(c => c.nombre === "Indemnización de 3 meses").monto, 90000, "indemnización");

// La prima de antigüedad ahora tiene piso de 1 salario mínimo (art. 485 LFT): solo cambia cuando el
// salario diario es menor al mínimo. Despido con $6,000 al mes ($200 diarios), 5 años exactos
// (del 16 oct 2021 al 15 oct 2026: el último día trabajado cuenta).
r = C.finiquito({ salarioMensual: 6000, ingreso: f("2021-10-16"), salida: f("2026-10-15"), motivo: "despido" });
assert.strictEqual(r.anios, 5);
cerca(r.antiguedad, 5, "5 años exactos");
cerca(r.conceptos.find(c => c.nombre === "Prima de antigüedad").monto, 12 * 5 * 315.04, "prima con piso de salario mínimo");
r = C.finiquito({ salarioMensual: 12000, ingreso: f("2022-08-01"), salida: f("2026-10-31") });
// Aguinaldo 400 x 15 x 304 / 365 = 4,997.26; vacaciones 400 x 20 x 92 / 365 = 2,016.44; prima vacacional 504.11.
cerca(r.total, 7517.81, "finiquito por renuncia");

// Días negativos por error: cuentan como 0 (no restan ni suman dinero).
let rNeg = C.finiquito({ salarioMensual: 12000, ingreso: f("2022-08-01"), salida: f("2026-10-31"),
  diasSinPagar: -100, vacacionesTomadas: -100, vacacionesPendientes: -100 });
cerca(rNeg.total, 7517.81, "finiquito con días negativos");
rNeg = C.finiquito({ salarioMensual: 12000, ingreso: f("2022-08-01"), salida: f("2026-10-31"), motivo: "despido",
  diasSinPagar: -100, vacacionesTomadas: -100, vacacionesPendientes: -100 });
cerca(rNeg.total, C.finiquito({ salarioMensual: 12000, ingreso: f("2022-08-01"), salida: f("2026-10-31"), motivo: "despido" }).total, "liquidación con días negativos");
assert.ok(rNeg.conceptos.every(c => c.monto >= 0), "ningún concepto negativo");

// ISR mensual, tarifa del art. 96 LISR 2026 (Anexo 8 RMF 2026). Cálculo a mano:
// (base - límite inferior) x % + cuota fija.
const isr = (base, renglon, esperado) => {
  const x = C.isrMensual(base);
  assert.strictEqual(x.renglon, renglon, `renglón de ${base}`);
  cerca(x.isr, esperado, `ISR de ${base}`);
};
isr(600, 1, 11.52);         // (600 - 0.01) x 1.92% = 11.52
isr(5000, 2, 282.17);       // (5,000 - 844.60) x 6.40% + 16.22 = 265.95 + 16.22
isr(10000, 3, 729.02);      // (10,000 - 7,168.52) x 10.88% + 420.95 = 308.07 + 420.95
isr(7168.52, 3, 420.95);    // justo en el límite inferior del renglón 3
isr(13000, 4, 1076.00);     // (13,000 - 12,598.03) x 16% + 1,011.68 = 64.3152 + 1,011.68 = 1,075.9952
isr(15000, 5, 1402.82);     // (15,000 - 14,644.65) x 17.92% + 1,339.14 = 63.68 + 1,339.14
isr(20000, 6, 2383.65);     // (20,000 - 17,533.65) x 21.36% + 1,856.84 = 526.81 + 1,856.84
isr(50000, 7, 9107.82);     // (50,000 - 35,362.84) x 23.52% + 5,665.16 = 3,442.66 + 5,665.16
isr(100000, 8, 23736.08);   // (100,000 - 55,736.69) x 30% + 10,457.09 = 13,278.99 + 10,457.09
isr(120000, 9, 30007.87);   // (120,000 - 106,410.51) x 32% + 25,659.23 = 4,348.64 + 25,659.23
isr(200000, 10, 56770.26);  // (200,000 - 141,880.67) x 34% + 37,009.69 = 19,760.57 + 37,009.69
isr(500000, 11, 159513.84); // (500,000 - 425,642) x 35% + 133,488.54 = 26,025.30 + 133,488.54
assert.strictEqual(C.isrMensual(0).isr, 0);

// Subsidio para el empleo 2026: 535.65 si la base no pasa de 11,492.66; arriba, 0 (sin reducción gradual).
assert.strictEqual(C.subsidioEmpleo(11492.66), 535.65);
assert.strictEqual(C.subsidioEmpleo(11492.67), 0);
assert.strictEqual(C.subsidioEmpleo(0), 0);

// Cuotas obreras del IMSS: SBC x 2.375% + (SBC - 3 UMA) x 0.40%, con SBC entre el mínimo y 25 UMA.
cerca(C.cuotasImssObrero(330.57).diario, 7.85, "IMSS diario SBC 330.57");            // 330.57 x 2.375%
cerca(C.cuotasImssObrero(500).diario, 12.47, "IMSS diario SBC 500");                 // 11.875 + 148.07 x 0.4%
cerca(C.cuotasImssObrero(1000).diario, 26.34, "IMSS diario SBC 1,000");              // 23.75 + 648.07 x 0.4%
let im = C.cuotasImssObrero(5000);
cerca(im.sbc, 2932.75, "tope 25 UMA");
cerca(im.diario, 79.98, "IMSS diario en el tope");                                    // 69.65 + 2,580.82 x 0.4%
cerca(im.mensual, 2431.27, "IMSS mensual en el tope");
cerca(C.cuotasImssObrero(100).sbc, 315.04, "SBC no baja del salario mínimo");

// Sueldo neto: con subsidio, $10,000 al mes.
let n = C.sueldoNeto({ salarioMensual: 10000 });
cerca(n.isrTarifa, 729.02, "ISR tarifa 10,000");
cerca(n.subsidioAplicado, 535.65, "subsidio 10,000");
cerca(n.isrRetenido, 193.37, "ISR retenido 10,000");                                 // 729.02 - 535.65
// IMSS: salario diario 10,000 / 30 = 333.33 (art. 89 LFT); SBC 333.33 x 1.0493 = 349.77 (menos de 3 UMA).
// Por ramo, x 30.4 días: 0.25% = 26.58, 0.375% = 39.87, 0.625% = 66.46, 1.125% = 119.62; total 252.53.
cerca(n.sd, 10000 / 30, "salario diario 10,000");
cerca(n.imssObrero, 252.53, "IMSS 10,000");
cerca(n.neto, 9554.10, "neto 10,000");
cerca(n.tasaEfectiva, 445.90 / 10000, "tasa efectiva 10,000");

// Justo en el tope del subsidio y un centavo arriba.
n = C.sueldoNeto({ salarioMensual: 11492.66 });
cerca(n.isrRetenido, 355.77, "ISR retenido en el tope");                             // 891.42 - 535.65
n = C.sueldoNeto({ salarioMensual: 11492.67 });
assert.strictEqual(n.subsidio, 0);
cerca(n.isrRetenido, 891.42, "ISR retenido arriba del tope");

// Arriba del tope del subsidio: $30,000 al mes (renglón 6).
n = C.sueldoNeto({ salarioMensual: 30000 });
cerca(n.isrRetenido, 4519.65, "ISR retenido 30,000");                                // 12,466.35 x 21.36% + 1,856.84
// IMSS: SBC 30,000 / 30 x 1.0493 = 1,049.30 diarios. Por ramo, x 30.4 días: 0.4% sobre lo que pasa de
// 351.93 = 84.80; 0.25% = 79.75; 0.375% = 119.62; 0.625% = 199.37; 1.125% = 358.86; total 842.40.
cerca(n.sbc, 1049.30, "SBC 30,000");
cerca(n.imssObrero, 842.40, "IMSS 30,000");
cerca(n.neto, 24637.95, "neto 30,000");

// Solo el salario mínimo (315.04 x 30 = 9,451.20, art. 89 LFT): sin ISR (art. 96 LISR) y el IMSS lo paga el
// patrón (art. 36 LSS).
n = C.sueldoNeto({ salarioMensual: 9451.20 });
assert.strictEqual(n.soloMinimo, true);
assert.strictEqual(n.debajoMinimo, false);
assert.strictEqual(n.isrRetenido, 0);
assert.strictEqual(n.imssObrero, 0);
cerca(n.neto, 9451.20, "neto salario mínimo");
n = C.sueldoNeto({ salarioMensual: 9451.21 });
assert.strictEqual(n.soloMinimo, false);
cerca(n.isrRetenido, 133.66, "un centavo arriba del mínimo: ISR");                  // (9,451.21 - 7,168.52) x 10.88% + 420.95 - 535.65
cerca(n.imssObrero, 238.68, "un centavo arriba del mínimo: IMSS");                 // SBC 330.57 x 2.375% x 30.4, por ramo
// $9,500: salario diario 316.67, arriba del mínimo. ISR 674.62 - 535.65 = 138.97; IMSS 239.90.
n = C.sueldoNeto({ salarioMensual: 9500 });
assert.strictEqual(n.soloMinimo, false);
cerca(n.neto, 9121.13, "neto 9,500");
// Quien gana exactamente el mínimo y escribe la cifra de la CONASAMI (9,582.47) o un mes de 31 días
// (315.04 x 31 = 9,766.24) marca la casilla: sin ISR ni IMSS.
n = C.sueldoNeto({ salarioMensual: 9582.47 });
cerca(n.isrRetenido, 147.94, "9,582.47 sin casilla");
for (const s of [9582.47, 9766.24]) {
  n = C.sueldoNeto({ salarioMensual: s, ganaMinimo: true });
  assert.strictEqual(n.soloMinimo, true, `casilla con ${s}`);
  assert.strictEqual(n.isrRetenido + n.imssObrero, 0);
}
n = C.sueldoNeto({ salarioMensual: 9766.25, ganaMinimo: true });                  // pasa de 31 días de mínimo
assert.strictEqual(n.soloMinimo, false);
assert.strictEqual(n.ganaMinimoNoAplica, true);
n = C.sueldoNeto({ salarioMensual: 13409.80, zona: "frontera", ganaMinimo: true }); // CONASAMI frontera
assert.strictEqual(n.soloMinimo, true);
// Menos del mínimo: se mantiene sin ISR ni IMSS, pero se marca para avisar.
n = C.sueldoNeto({ salarioMensual: 12000, zona: "frontera" });                      // 440.87 x 30 = 13,226.10
assert.strictEqual(n.soloMinimo, true);
assert.strictEqual(n.debajoMinimo, true);
assert.strictEqual(n.isrRetenido, 0);
n = C.sueldoNeto({ salarioMensual: 13226.11, zona: "frontera" });
assert.strictEqual(n.soloMinimo, false);
// Entradas raras: nunca NaN ni Infinity.
for (const s of ["", "abc", -5, Infinity, NaN]) {
  n = C.sueldoNeto({ salarioMensual: s });
  assert.strictEqual(n.neto, 0, `neto con ${s}`);
}
assert.ok(Number.isFinite(C.sueldoNeto({ salarioMensual: 1e8 }).neto));

// Prima de antigüedad, art. 162 LFT.
let p = C.primaAntiguedad({ salarioMensual: 12000, ingreso: f("2012-01-01"), salida: f("2026-10-31"), motivo: "renuncia" });
assert.strictEqual(p.anios, 14);                                                     // 14 años y 10 meses: no aplica
assert.strictEqual(p.aplica, false);
assert.strictEqual(p.prima, 0);
// El último día de trabajo cuenta: del 16 oct 2006 al 15 oct 2026 son 20 años exactos.
p = C.primaAntiguedad({ salarioMensual: 15000, ingreso: f("2006-10-16"), salida: f("2026-10-15"), motivo: "renuncia" });
assert.strictEqual(p.aplica, true);
cerca(p.antiguedad, 20, "20 años exactos");
cerca(p.prima, 120000, "renuncia con 20 años");                                      // 12 x 20 x 500
// Entró el 16 oct 2011 y su último día fue el 15 oct 2026: 15 años cumplidos, sí le toca al renunciar.
p = C.primaAntiguedad({ salarioMensual: 12000, ingreso: f("2011-10-16"), salida: f("2026-10-15"), motivo: "renuncia" });
assert.strictEqual(p.anios, 15);
assert.strictEqual(p.aplica, true);
cerca(p.prima, 72000, "renuncia con 15 años justos");                                // 12 x 15 x 400
p = C.primaAntiguedad({ salarioMensual: 12000, ingreso: f("2011-10-16"), salida: f("2026-10-14"), motivo: "renuncia" });
assert.strictEqual(p.aplica, false);                                                 // un día antes: 14 años
p = C.primaAntiguedad({ salarioMensual: 30000, ingreso: f("2006-10-16"), salida: f("2026-10-15"), motivo: "renuncia", zona: "frontera" });
cerca(p.prima, 211617.60, "renuncia con 20 años en la frontera, topada");            // 12 x 20 x 881.74
p = C.primaAntiguedad({ salarioMensual: 24000, ingreso: f("2016-10-16"), salida: f("2026-10-15"), motivo: "despido" });
assert.strictEqual(p.topado, true);
cerca(p.prima, 75609.60, "despido con salario sobre el tope");                       // 12 x 10 x 630.08
// Del 1 abr 2016 al 30 sep 2026: 10 años y 183 días (1 abr al 30 sep, contando los dos).
p = C.primaAntiguedad({ salarioMensual: 24000, ingreso: f("2016-04-01"), salida: f("2026-09-30"), motivo: "despido" });
cerca(p.antiguedad, 10 + 183 / 365, "antigüedad con fracción");
cerca(p.prima, 12 * (10 + 183 / 365) * 630.08, "despido con fracción de año");
p = C.primaAntiguedad({ salarioMensual: 9000, ingreso: f("2025-10-16"), salida: f("2026-04-15"), motivo: "justificado" });
cerca(p.prima, 12 * (182 / 365) * 315.04, "despido justificado, medio año, con piso");
// Fechas que escribe la persona.
assert.ok(C.validarFechas("", "2026-10-15").error);
assert.ok(C.validarFechas("0001-01-01", "2026-10-15").error);
assert.ok(C.validarFechas("2006-10-16", "2045-01-01").error);
assert.ok(C.validarFechas("2026-10-16", "2026-10-15").error);
assert.ok(!C.validarFechas("2006-10-16", "2026-10-15").error);
assert.ok(!C.validarFechas("2026-10-15", "2026-10-15").error);                     // un solo día
// Sin sueldo capturado no se calcula (antes daba 12 x 20 x 315.04 por el piso del salario mínimo).
for (const s of ["", 0, -100]) {
  p = C.primaAntiguedad({ salarioMensual: s, ingreso: f("2006-10-16"), salida: f("2026-10-15"), motivo: "despido" });
  assert.strictEqual(p.sinSueldo, true);
  assert.strictEqual(p.total, 0, `prima sin sueldo (${s})`);
}
p = C.primaAntiguedad({ salarioMensual: 12000, ingreso: f("2023-10-16"), salida: f("2026-10-15"), motivo: "incapacidad" });
cerca(p.prima, 14400, "incapacidad: prima");                                         // 12 x 3 x 400
cerca(p.total, 26400, "incapacidad: prima más un mes");

console.log("Todas las pruebas pasaron");

