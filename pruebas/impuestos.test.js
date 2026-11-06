// Pruebas de impuestos (RESICO y declaración anual): node pruebas/impuestos.test.js
const assert = require("assert");
const I = require("../assets/impuestos.js");
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.006, `${msg}: ${a} != ${b}`);
const sinRaros = (obj, msg) => {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v) || v === Infinity && k === "limiteSuperior", `${msg}: ${k} = ${v}`);
    else if (v && typeof v === "object") sinRaros(v, `${msg}.${k}`);
  }
};

// UMA anual 2026: 3,566.22 x 12
cerca(I.umaAnual, 42794.64, "UMA anual");

// ---------- RESICO mensual (art. 113-E): la tasa del renglón se aplica a TODO lo cobrado ----------
let r = I.resicoMensual({ ingresos: 30000, cobradoAEmpresas: 10000 }); // valores de la página
assert.strictEqual(r.renglon, 2);
assert.strictEqual(r.tasa, 1.10);
cerca(r.isr, 330, "30,000 x 1.10%");
cerca(r.retencion, 125, "10,000 x 1.25%");
cerca(r.aPagar, 205, "330 - 125");
assert.strictEqual(r.saldoFavor, 0);
cerca(r.siguiente.desde, 50000.01, "siguiente límite");
assert.strictEqual(r.siguiente.tasa, 1.50);
cerca(r.siguiente.isr, 750, "50,000.01 x 1.50%");
cerca(r.anualSiSeRepite, 360000, "30,000 x 12");
assert.strictEqual(r.pasaTopeAnual, false);

const resico = (ing, renglon, tasa, isr) => {
  const x = I.resicoMensual({ ingresos: ing });
  assert.strictEqual(x.renglon, renglon, `renglón de ${ing}`);
  assert.strictEqual(x.tasa, tasa, `tasa de ${ing}`);
  cerca(x.isr, isr, `ISR RESICO de ${ing}`);
};
resico(25000, 1, 1.00, 250);          // 25,000 x 1% = 250
resico(25000.01, 2, 1.10, 275.00);    // 25,000.01 x 1.10% = 275.0001
resico(50000, 2, 1.10, 550);          // 50,000 x 1.10% = 550
resico(50000.01, 3, 1.50, 750.00);    // un centavo más: 50,000.01 x 1.50% = 750.0002 (salto de 200 pesos)
resico(83333.33, 3, 1.50, 1250.00);   // 83,333.33 x 1.50% = 1,249.99995
resico(100000, 4, 2.00, 2000);        // 100,000 x 2% = 2,000
resico(208333.34, 5, 2.50, 5208.33);  // 208,333.34 x 2.50% = 5,208.3335
resico(3500000, 5, 2.50, 87500);      // último peso dentro del régimen

// Más de 3.5 millones en un mes: fuera del régimen
r = I.resicoMensual({ ingresos: 3500000.01 });
assert.strictEqual(r.fueraDeRegimen, true);
assert.strictEqual(r.isr, 0);
assert.strictEqual(r.pasaTopeAnual, true);

// Todo cobrado a empresas en el primer renglón: la retención (1.25%) supera al ISR (1%)
r = I.resicoMensual({ ingresos: 20000, cobradoAEmpresas: 20000 });
cerca(r.isr, 200, "20,000 x 1%");
cerca(r.retencion, 250, "20,000 x 1.25%");
assert.strictEqual(r.aPagar, 0);
cerca(r.saldoFavor, 50, "saldo a favor RESICO");

// Segundo renglón todo cobrado a empresas: 1.10% también es menor que la retención de 1.25%
r = I.resicoMensual({ ingresos: 40000, cobradoAEmpresas: 40000 });
cerca(r.isr, 440, "40,000 x 1.10%");
cerca(r.retencion, 500, "40,000 x 1.25%");
cerca(r.saldoFavor, 60, "saldo a favor en el segundo renglón"); // 500 - 440
// Tercer renglón: 1.50% ya es mayor que 1.25%, no queda saldo a favor
r = I.resicoMensual({ ingresos: 60000, cobradoAEmpresas: 60000 });
cerca(r.aPagar, 150, "60,000 x 1.50% - 60,000 x 1.25% = 900 - 750");

// ---------- RESICO: solo campo, ganadería, silvicultura o pesca (art. 113-E, 900,000 libres al año) ----------
r = I.resicoMensual({ ingresos: 30000, cobradoAEmpresas: 0, soloCampo: true });
assert.strictEqual(r.exentoCampo, true);
assert.strictEqual(r.isr, 0, "campo dentro de 900,000: ISR 0");
assert.strictEqual(r.aPagar, 0);
assert.strictEqual(r.siguiente, null, "sin aviso de salto de tasa para el campo");
cerca(r.exentoRestante, 870000, "900,000 - 30,000");
// Si una empresa sí le retuvo, la retención queda como saldo a favor
r = I.resicoMensual({ ingresos: 30000, cobradoAEmpresas: 10000, soloCampo: true });
cerca(r.saldoFavor, 125, "retención con ISR 0");
// Justo en 900,000 en el año: sigue libre
r = I.resicoMensual({ ingresos: 30000, soloCampo: true, cobradoAntes: 870000 });
assert.strictEqual(r.exentoCampo, true);
cerca(r.acumuladoAnio, 900000, "acumulado del año");
assert.strictEqual(r.exentoRestante, 0);
// Un peso más: ya no calculamos (paga solo por el excedente)
r = I.resicoMensual({ ingresos: 30000, soloCampo: true, cobradoAntes: 870001 });
assert.strictEqual(r.campoPasaExencion, true);
assert.strictEqual(r.calculado, false);
assert.strictEqual(r.aPagar, 0);
assert.strictEqual(r.saldoFavor, 0);
// Sin la casilla, el mismo ingreso paga la tabla completa
assert.strictEqual(I.resicoMensual({ ingresos: 30000, cobradoAntes: 870001 }).isr, 330);
// Acumulado arriba del tope de 3.5 millones
assert.strictEqual(I.resicoMensual({ ingresos: 30000, soloCampo: true, cobradoAntes: 3480000 }).acumuladoPasaTope, true);
// Sin ingresos del mes, aunque ya haya pasado de 900,000: ISR 0 sin aviso de excedente
r = I.resicoMensual({ ingresos: 0, soloCampo: true, cobradoAntes: 1000000 });
assert.strictEqual(r.campoPasaExencion, false);
assert.strictEqual(r.isr, 0);
for (const malo of ["", "abc", -5000, null, undefined, NaN, 1e20, Infinity]) {
  sinRaros(I.resicoMensual({ ingresos: malo, cobradoAEmpresas: malo, soloCampo: true, cobradoAntes: malo }), `campo con ${malo}`);
}

// Lo cobrado a empresas no puede ser mayor que el total
r = I.resicoMensual({ ingresos: 10000, cobradoAEmpresas: 50000 });
assert.strictEqual(r.cobradoAEmpresas, 10000);
assert.strictEqual(r.empresasAjustado, true);
cerca(r.retencion, 125, "retención topada al total");

// Si cada mes cobras 300,000, en el año pasas del tope
assert.strictEqual(I.resicoMensual({ ingresos: 300000 }).pasaTopeAnual, true);
assert.strictEqual(I.resicoMensual({ ingresos: 291666.66 }).pasaTopeAnual, false);

// Entradas raras: vacío, texto, negativo, enorme, Infinity
for (const malo of ["", "abc", -5000, null, undefined, NaN]) {
  const x = I.resicoMensual({ ingresos: malo, cobradoAEmpresas: malo });
  assert.strictEqual(x.isr, 0, `ISR con ${malo}`);
  assert.strictEqual(x.aPagar, 0);
  sinRaros(x, `RESICO con ${malo}`);
}
for (const enorme of [1e20, Infinity, "1e400"]) {
  const x = I.resicoMensual({ ingresos: enorme, cobradoAEmpresas: enorme });
  assert.strictEqual(x.fueraDeRegimen, true);
  assert.strictEqual(x.ingresos, I.MAXIMO);
  sinRaros(x, `RESICO con ${enorme}`);
}

// ---------- RESICO anual (art. 113-F) ----------
cerca(I.resicoAnual(360000).isr, 3960, "360,000 x 1.10%");
cerca(I.resicoAnual(300000).isr, 3000, "300,000 x 1%");
cerca(I.resicoAnual(2600000).isr, 65000, "2,600,000 x 2.50%");
assert.strictEqual(I.resicoAnual(3600000).fueraDeRegimen, true);

// ---------- Tarifa anual del art. 152 (Anexo 8 RMF 2026) ----------
const anual = (base, renglon, esperado) => {
  const x = I.isrAnual(base);
  assert.strictEqual(x.renglon, renglon, `renglón anual de ${base}`);
  cerca(x.isr, esperado, `ISR anual de ${base}`);
};
anual(10135.11, 1, 194.59);       // (10,135.11 - 0.01) x 1.92% = 194.5939
anual(50000, 2, 2745.94);         // (50,000 - 10,135.12) x 6.40% + 194.59 = 2,551.35 + 194.59
anual(100000, 3, 6572.16);        // (100,000 - 86,022.12) x 10.88% + 5,051.37 = 1,520.79 + 5,051.37
anual(280000, 6, 37147.91);       // (280,000 - 210,403.70) x 21.36% + 22,282.14 = 14,865.77 + 22,282.14
anual(300000, 6, 41419.91);       // (300,000 - 210,403.70) x 21.36% + 22,282.14 = 19,137.77 + 22,282.14
anual(6000000, 11, 1914166.08);   // (6,000,000 - 5,107,703.93) x 35% + 1,601,862.46
assert.strictEqual(I.isrAnual(0).isr, 0);
assert.strictEqual(I.isrAnual(-100).isr, 0);
sinRaros(I.isrAnual(1e30), "isrAnual enorme");

// Continuidad de la tarifa: la cuota fija de cada renglón es el ISR al final del renglón anterior
const t = I.DATOS.tarifaAnual;
for (let i = 1; i < t.length; i++) {
  const [li, ls, cf, p] = t[i - 1];
  // Tolerancia de 1.1 centavos. Renglones 3 y 10: brecha conocida de 1.3 y 1.4 centavos, igual que en la
  // tarifa oficial 2023 (renglón 3: 4,461.94 contra 4,461.93). Pendiente cotejar con el Anexo 8 RMF 2026.
  const tolerancia = i + 1 === 3 || i + 1 === 10 ? 0.015 : 0.011;
  assert.ok(Math.abs(cf + (ls - li) * p / 100 - t[i][2]) < tolerancia, `continuidad renglón ${i + 1}`);
  cerca(t[i][0], ls + 0.01, `límite inferior renglón ${i + 1}`);
}

// ---------- Tope de deducciones personales (art. 151) ----------
let tp = I.topeDeducciones(305000);
cerca(tp.porIngresos, 45750, "15% de 305,000");
cerca(tp.porUma, 213973.20, "5 UMA anuales");
cerca(tp.tope, 45750, "tope = el menor");
tp = I.topeDeducciones(2000000);
cerca(tp.tope, 213973.20, "con ingresos altos manda la UMA");
assert.strictEqual(tp.limitaUma, true);

// ---------- Declaración anual: valores de la página ----------
let d = I.declaracionAnual({ ingresosGravados: 300000, ingresosExentos: 5000, isrPagado: 41419.80, deducciones: 20000 });
cerca(d.tope.tope, 45750, "tope del ejemplo");
cerca(d.deduccionAplicada, 20000, "deducción completa");
cerca(d.base, 280000, "base del ejemplo");
cerca(d.impuesto, 37147.91, "ISR del año del ejemplo");
cerca(d.saldoFavor, 4271.89, "saldo a favor del ejemplo"); // 41,419.80 - 37,147.91
assert.strictEqual(d.aCargo, 0);
cerca(d.ahorroDeducciones, 4272.00, "ahorro por deducciones"); // 41,419.91 - 37,147.91

// Sin deducciones, lo retenido cada mes casi coincide con el ISR del año (diferencia de centavos)
d = I.declaracionAnual({ ingresosGravados: 300000, isrPagado: 41419.80 });
cerca(d.aCargo, 0.11, "a cargo por centavos");

// Deducciones arriba del tope: solo cuenta el 15%
d = I.declaracionAnual({ ingresosGravados: 300000, deducciones: 100000, isrPagado: 41419.80 });
cerca(d.deduccionAplicada, 45000, "15% de 300,000");
cerca(d.deduccionSinUsar, 55000, "lo que ya no cuenta");
cerca(d.impuesto, 31807.91, "ISR con tope"); // (255,000 - 210,403.70) x 21.36% + 22,282.14
cerca(d.saldoFavor, 9611.89, "saldo con tope");

// Colegiaturas: no entran al tope general
d = I.declaracionAnual({ ingresosGravados: 300000, deducciones: 45000, colegiaturas: 12900, isrPagado: 41419.80 });
cerca(d.base, 242100, "base con colegiatura"); // 300,000 - 45,000 - 12,900
cerca(d.impuesto, 29052.47, "ISR con colegiatura"); // (242,100 - 210,403.70) x 21.36% + 22,282.14 = 6,770.33 + 22,282.14

// Colegiaturas arriba del límite por alumno: solo cuenta el límite
let c = I.colegiaturasDeducibles({ pagado: 60000, nivel: "primaria", alumnos: 1 });
cerca(c.deducible, 12900, "primaria topada");
cerca(c.recortado, 47100, "lo que no cuenta");
c = I.colegiaturasDeducibles({ pagado: 40000, nivel: "bachillerato", alumnos: 2 });
cerca(c.limite, 49000, "2 x 24,500");
cerca(c.deducible, 40000, "abajo del límite");
c = I.colegiaturasDeducibles({ pagado: 100000, nivel: "varios", alumnos: 3 });
cerca(c.deducible, 73500, "varios niveles: 3 x 24,500");
assert.strictEqual(I.colegiaturasDeducibles({ pagado: 5000, nivel: "preescolar", alumnos: 0 }).alumnos, 1);
assert.strictEqual(I.colegiaturasDeducibles({ pagado: 5000, alumnos: 1e9 }).alumnos, I.DATOS.maxAlumnos);
assert.strictEqual(I.colegiaturasDeducibles({ pagado: 50000, nivel: "otro" }).limite, 12900);
d = I.declaracionAnual({ ingresosGravados: 300000, ingresosExentos: 5000, isrPagado: 41419.80, deducciones: 20000, colegiaturas: 60000, nivelColegiatura: "primaria", alumnos: 1 });
cerca(d.colegiaturas, 12900, "colegiatura topada en la anual");
cerca(d.base, 267100, "300,000 - 20,000 - 12,900");
cerca(d.impuesto, 34392.47, "ISR con colegiatura topada"); // (267,100 - 210,403.70) x 21.36% + 22,282.14 = 12,110.33 + 22,282.14
d = I.declaracionAnual({ ingresosGravados: 300000, colegiaturas: 1e9 });
cerca(d.base, 287100, "mil millones de colegiatura no dejan la base en 0");

// Devolución: e.firma con más de 10,000; automática hasta 150,000
assert.strictEqual(I.devolucion(10000).necesitaEfirma, false);
assert.strictEqual(I.devolucion(10000.01).necesitaEfirma, true);
d = I.declaracionAnual({ ingresosGravados: 100000, isrPagado: 16572.66 });
cerca(d.saldoFavor, 10000.50, "saldo de 10,000.50"); // 16,572.66 - 6,572.16
assert.strictEqual(I.devolucion(d.saldoFavor).necesitaEfirma, true);
assert.strictEqual(I.devolucion(150000).automatica, true);
assert.strictEqual(I.devolucion(150000.01).automatica, false);
assert.strictEqual(I.devolucion(0).automatica, false);
sinRaros(I.devolucion("abc"), "devolución rara");

// Subsidio para el empleo: reduce el ISR del año pero no genera saldo a favor
d = I.declaracionAnual({ ingresosGravados: 100000, subsidio: 6000, isrPagado: 500 });
cerca(d.isrTarifa, 6572.16, "ISR antes de subsidio");
cerca(d.impuesto, 572.16, "ISR después de subsidio");
cerca(d.aCargo, 72.16, "a cargo con subsidio");
d = I.declaracionAnual({ ingresosGravados: 50000, subsidio: 6000, isrPagado: 0 });
assert.strictEqual(d.impuesto, 0);
cerca(d.subsidioAplicado, 2745.94, "subsidio aplicado hasta el ISR");
assert.strictEqual(d.saldoFavor, 0);
assert.strictEqual(d.aCargo, 0);

// Deducciones mayores que el ingreso: base 0, te devuelven todo lo retenido
d = I.declaracionAnual({ ingresosGravados: 10000, deducciones: 5000, colegiaturas: 24500, isrPagado: 300 });
assert.strictEqual(d.base, 0);
cerca(d.saldoFavor, 300, "devuelven todo");

// Entradas raras
for (const malo of ["", "abc", -1, null, undefined, NaN]) {
  const x = I.declaracionAnual({ ingresosGravados: malo, ingresosExentos: malo, isrPagado: malo, subsidio: malo, deducciones: malo, colegiaturas: malo });
  assert.strictEqual(x.impuesto, 0);
  assert.strictEqual(x.saldoFavor, 0);
  assert.strictEqual(x.aCargo, 0);
  sinRaros(x, `anual con ${malo}`);
}
d = I.declaracionAnual({ ingresosGravados: Infinity, ingresosExentos: 1e40, isrPagado: "1e500", deducciones: 1e30, colegiaturas: 1e30 });
sinRaros(d, "anual enorme");
assert.ok(d.impuesto >= 0 && d.saldoFavor >= 0 && d.aCargo >= 0);
assert.strictEqual(I.declaracionAnual({ ingresosGravados: 1000, isrPagado: 5000 }).pagadoMayorQueIngresos, true);

// ---------- ISR del aguinaldo: método normal (art. 96 LISR) contra art. 174 RLISR ----------
let ag = I.isrAguinaldo({ sueldoMensual: 12000, aguinaldo: 6000 }); // ejemplo de la página (y de Siempre al Día)
cerca(ag.exento, 3519.30, "30 UMA");
cerca(ag.gravado, 2480.70, "6,000 - 3,519.30");
cerca(ag.normal, 366.29, "1,312.91 - 946.62 (la fuente redondea 946.61 y da 366.30)");
cerca(ag.proporcion, 206.61, "2,480.70 / 365 x 30.4");
cerca(ag.tasa, 10.88, "tasa del art. 174");
cerca(ag.art174, 269.90, "2,480.70 x 10.88%");
cerca(ag.neto174, 5730.10, "neto con art. 174");
assert.strictEqual(ag.mejor, "art174");
// Todo exento: aguinaldo menor a 30 UMA
ag = I.isrAguinaldo({ sueldoMensual: 9000, aguinaldo: 3000 });
assert.strictEqual(ag.todoExento, true);
assert.strictEqual(ag.normal, 0); assert.strictEqual(ag.art174, 0); assert.strictEqual(ag.mejor, "igual");
cerca(ag.exentoAplicado, 3000, "exento hasta lo que recibes");
// Mismo renglón de la tarifa: los dos métodos dan lo mismo
ag = I.isrAguinaldo({ sueldoMensual: 20000, aguinaldo: 10000 });
cerca(ag.normal, ag.art174, "mismo renglón");
// Sueldo alto: el art. 174 retiene menos
ag = I.isrAguinaldo({ sueldoMensual: 40000, aguinaldo: 20000 });
cerca(ag.normal, 3924.47, "normal 40,000");
cerca(ag.art174, 3876.26, "art. 174 40,000");
// Sin sueldo capturado
ag = I.isrAguinaldo({ sueldoMensual: "", aguinaldo: 10000 });
assert.strictEqual(ag.sinSueldo, true);
assert.ok(ag.art174 < ag.normal);
[{}, { sueldoMensual: -5, aguinaldo: "x" }, { sueldoMensual: 1e300, aguinaldo: 1e300 }, { sueldoMensual: NaN, aguinaldo: Infinity }]
  .forEach((e, i) => { const x = I.isrAguinaldo(e); sinRaros(x, "aguinaldo raro " + i); assert.ok(x.normal >= 0 && x.art174 >= 0); });

// ---------- IVA: 16% general (art. 1 LIVA) y 8% región fronteriza ----------
let iv = I.calcularIva({ monto: 1000 });
cerca(iv.iva, 160, "16% de 1,000"); cerca(iv.total, 1160, "1,000 + IVA");
iv = I.calcularIva({ monto: 1160, modo: "quitar" });
cerca(iv.base, 1000, "1,160 / 1.16"); cerca(iv.iva, 160, "IVA incluido");
iv = I.calcularIva({ monto: 1080, tasa: 8, modo: "quitar" });
cerca(iv.base, 1000, "1,080 / 1.08"); cerca(iv.iva, 80, "IVA 8% incluido");
iv = I.calcularIva({ monto: 2500, tasa: "8" });
cerca(iv.total, 2700, "2,500 + 8%"); assert.strictEqual(iv.tasa, 8);
iv = I.calcularIva({ monto: 99.99, modo: "quitar" });
cerca(iv.base + iv.iva, 99.99, "base + IVA = total");
cerca(iv.base, 86.20, "99.99 / 1.16");
assert.strictEqual(I.calcularIva({ monto: 100, tasa: 10 }).tasa, 16, "tasa desconocida = 16%");
[{}, { monto: -1 }, { monto: "abc", modo: "quitar" }, { monto: 1e300 }, { monto: Infinity, tasa: 8 }]
  .forEach((e, i) => { const x = I.calcularIva(e); sinRaros(x, "iva raro " + i); assert.ok(x.total >= 0 && x.iva >= 0); });

// ---------- Honorarios: actividad profesional contra RESICO ----------
// $30,000 cobrados a empresas y $5,000 de gastos. General: utilidad 25,000 (renglón 6) = 7,466.35 x 21.36% + 1,856.84
// = 3,451.65; retención 10% = 3,000. RESICO: 1.1% = 330; retención 1.25% = 375. IVA: 4,800 - 3,200 - 800 = 800.
let ho = I.honorarios({ ingresos: 30000, gastos: 5000, cobradoAEmpresas: 30000 });
cerca(ho.general.utilidad, 25000, "utilidad");
cerca(ho.general.isr, 3451.65, "ISR actividad profesional");
cerca(ho.general.retencion, 3000, "retención 10%");
cerca(ho.general.aPagar, 451.65, "ISR a pagar general");
cerca(ho.resico.isr, 330, "ISR RESICO");
cerca(ho.resico.saldoFavor, 45, "RESICO a favor");
cerca(ho.iva.trasladado, 4800, "IVA 16%");
cerca(ho.iva.retenido, 3200, "2/3 del IVA");
cerca(ho.iva.acreditable, 800, "IVA de gastos");
cerca(ho.iva.aPagar, 800, "IVA a pagar");
cerca(ho.cobrasGeneral, 28600, "depósito general"); cerca(ho.cobrasResico, 31225, "depósito RESICO");
assert.strictEqual(ho.conviene, "resico"); cerca(ho.ahorro, 3121.65, "ahorro RESICO");
// Sin empresas: no hay retenciones
ho = I.honorarios({ ingresos: 20000, gastos: 0, cobradoAEmpresas: 0 });
assert.strictEqual(ho.general.retencion, 0); assert.strictEqual(ho.iva.retenido, 0); cerca(ho.iva.aPagar, 3200, "IVA sin retención");
// Retención de IVA: 10.6667% de lo cobrado
cerca(I.honorarios({ ingresos: 10000, cobradoAEmpresas: 10000 }).iva.retenido, 1066.67, "10.6667%");
// Gastos sin IVA, gastos mayores, empresas mayores que el total, fuera del RESICO
ho = I.honorarios({ ingresos: 10000, gastos: 20000, cobradoAEmpresas: 50000, gastosConIva: false });
assert.strictEqual(ho.general.isr, 0); assert.strictEqual(ho.gastosMayores, true); assert.strictEqual(ho.empresasAjustado, true);
assert.strictEqual(ho.iva.acreditable, 0); cerca(ho.general.saldoFavor, 1000, "retención sin ISR = a favor");
ho = I.honorarios({ ingresos: 4000000, cobradoAEmpresas: 0 });
assert.strictEqual(ho.resico.fueraDeRegimen, true); assert.strictEqual(ho.conviene, "igual");
// Gastos altos: conviene actividad profesional
assert.strictEqual(I.honorarios({ ingresos: 30000, gastos: 27000 }).conviene, "general");
[{}, { ingresos: -1, gastos: "x" }, { ingresos: 1e300, gastos: 1e300, cobradoAEmpresas: 1e300 }, { ingresos: NaN, cobradoAEmpresas: Infinity }]
  .forEach((e, i) => { const x = I.honorarios(e); sinRaros(x, "honorarios raro " + i); });
{
  const pag = require("fs").readFileSync(require("path").join(__dirname, "..", "impuestos/honorarios/index.html"), "utf8");
  for (const t of ["$3,451.65", "$451.65", "$330", "$800", "$3,121.65", "10.6667%", 'href="../resico/"', "impuestos.js"])
    assert.ok(pag.includes(t), `honorarios: falta ${t}`);
}

// ---------- Plataformas digitales (art. 113-A LISR, LIF 2026 art. 25 y art. 18-J LIVA) ----------
// Conductor con $20,000 sin IVA: ISR 2.1% = 420; IVA 3,200, retienen la mitad = 1,600; depósito 20,000 + 3,200 - 420 - 1,600.
let pl = I.plataformasDigitales({ ingresos: 20000 });
assert.strictEqual(pl.tasaIsr, 2.1);
cerca(pl.isrRetenido, 420, "2.1%"); cerca(pl.iva, 3200, "IVA 16%"); cerca(pl.ivaRetenido, 1600, "50% del IVA");
cerca(pl.deposito, 21180, "depósito"); cerca(pl.anual, 240000, "anual");
assert.strictEqual(pl.puedeDefinitivo, true, "hasta 300,000 al año: pago definitivo");
assert.strictEqual(I.plataformasDigitales({ ingresos: 10000, actividad: "hospedaje" }).tasaIsr, 4, "hospedaje 4%");
pl = I.plataformasDigitales({ ingresos: 15000, actividad: "ventas" });
cerca(pl.isrRetenido, 375, "ventas 2.5% (LIF 2026)"); cerca(pl.deposito, 15825, "depósito ventas");
// Sin RFC: 20% de ISR y todo el IVA
pl = I.plataformasDigitales({ ingresos: 10000, actividad: "hospedaje", conRfc: false });
cerca(pl.isrRetenido, 2000, "20% sin RFC"); cerca(pl.ivaRetenido, 1600, "100% del IVA"); cerca(pl.ivaPendiente, 0, "nada pendiente");
assert.strictEqual(pl.puedeDefinitivo, false);
// IVA 0%, tope de 300,000 y otros ingresos
pl = I.plataformasDigitales({ ingresos: 10000, actividad: "ventas", ivaCero: true });
assert.strictEqual(pl.iva, 0); assert.strictEqual(pl.ivaRetenido, 0); cerca(pl.deposito, 9750, "sin IVA");
assert.strictEqual(I.plataformasDigitales({ ingresos: 25000 }).puedeDefinitivo, true, "300,000 exactos");
assert.strictEqual(I.plataformasDigitales({ ingresos: 25000.01 }).pasaTope, true);
assert.strictEqual(I.plataformasDigitales({ ingresos: 10000, soloPlataformas: false }).puedeDefinitivo, false);
assert.strictEqual(I.plataformasDigitales({ ingresos: 1, actividad: "otra" }).actividad, "transporte", "actividad desconocida");
[{}, { ingresos: -5 }, { ingresos: "abc", conRfc: false }, { ingresos: 1e300 }, { ingresos: Infinity, actividad: "ventas" }]
  .forEach((e, i) => sinRaros(I.plataformasDigitales(e), "plataformas raro " + i));

// ---------- Deducciones personales (art. 151 LISR) ----------
// Valores de la página: $360,000 de sueldo, $54,235.80 retenidos, médicos 15,000, lentes 3,000 (cuentan 2,500),
// seguro 12,000, colegiatura de primaria 20,000 (cuentan 12,900). Tope 15% = 54,000. Base 317,600.
// ISR sin deducciones: (360,000 - 210,403.70) x 21.36% + 22,282.14 = 54,235.91. Con: (317,600 - 210,403.70) x 21.36%
// + 22,282.14 = 45,179.27. Ahorro 9,056.64 (42,400 x 21.36%); saldo a favor 54,235.80 - 45,179.27 = 9,056.53.
let dp = I.deduccionesPersonales({ ingresosGravados: 360000, isrRetenido: 54235.80, medicos: 15000, lentes: 3000, personasLentes: 1,
  seguro: 12000, colegiaturas: 20000, nivelColegiatura: "primaria", alumnos: 1 });
cerca(dp.sumaDentro, 29500, "dentro del tope"); cerca(dp.tope.tope, 54000, "tope 15%"); cerca(dp.dentroAplicado, 29500, "aplicado");
cerca(dp.colegiaturas.deducible, 12900, "colegiatura"); cerca(dp.total, 42400, "total");
cerca(dp.base, 317600, "base"); cerca(dp.isrSinDeducciones, 54235.91, "ISR sin"); cerca(dp.isrConDeducciones, 45179.27, "ISR con");
cerca(dp.ahorro, 9056.64, "ahorro"); cerca(dp.saldoFavor, 9056.53, "saldo a favor"); assert.strictEqual(dp.tasaMarginal, 21.36);
assert.strictEqual(dp.devolucion.necesitaEfirma, false);
// Tope por UMA: con ingresos altos manda 5 UMA anuales (213,973.20)
dp = I.deduccionesPersonales({ ingresosGravados: 2000000, medicos: 300000 });
cerca(dp.tope.tope, 213973.2, "5 UMA"); assert.strictEqual(dp.tope.limitaUma, true); cerca(dp.sinUsar, 86026.8, "sobra");
assert.strictEqual(dp.hayRetenido, false); assert.strictEqual(dp.saldoFavor, 0);
// Lentes por persona y funerales hasta 1 UMA anual
dp = I.deduccionesPersonales({ ingresosGravados: 1000000, lentes: 9000, personasLentes: 3, funerales: 50000 });
cerca(dp.dentro.find(x => x.clave === "lentes").deducible, 7500, "3 x 2,500");
cerca(dp.dentro.find(x => x.clave === "funerales").deducible, 42794.64, "1 UMA anual");
// Donativos (7%) y retiro (10% y 5 UMA, de retiro.js) fuera del tope
dp = I.deduccionesPersonales({ ingresosGravados: 300000, medicos: 100000, donativos: 50000, retiro: 50000 });
cerca(dp.dentroAplicado, 45000, "tope 15% de 300,000"); cerca(dp.donativos.deducible, 21000, "7%"); cerca(dp.retiro.deducible, 30000, "10%");
cerca(dp.total, 96000, "fuera del tope se suman");
cerca(I.deduccionesPersonales({ ingresosGravados: 5000000, retiro: 1e6 }).retiro.deducible, 213973.2, "retiro: 5 UMA");
// Exentos cuentan para el 15%; retenido vacío; a cargo
cerca(I.deduccionesPersonales({ ingresosGravados: 100000, ingresosExentos: 20000 }).tope.tope, 18000, "15% con exentos");
assert.strictEqual(I.deduccionesPersonales({ ingresosGravados: 100000, isrRetenido: "" }).hayRetenido, false);
dp = I.deduccionesPersonales({ ingresosGravados: 360000, isrRetenido: 0 });
assert.ok(dp.aCargo > 0 && dp.saldoFavor === 0, "sin retenciones te toca pagar");
[{}, { ingresosGravados: -1, medicos: "x" }, { ingresosGravados: 1e300, medicos: 1e300, donativos: 1e300, retiro: 1e300, personasLentes: 1e300 },
  { ingresosGravados: NaN, isrRetenido: Infinity, alumnos: -3, nivelColegiatura: "zzz" }]
  .forEach((e, i) => sinRaros(I.deduccionesPersonales(e), "deducciones raro " + i));
{
  const leerPag = r => require("fs").readFileSync(require("path").join(__dirname, "..", r), "utf8");
  const pp = leerPag("impuestos/plataformas-digitales/index.html");
  for (const t of ["$420", "$1,600", "$21,180", "$240,000", "2.1%", "2.5%", "113-A", "impuestos.js"]) assert.ok(pp.includes(t), `plataformas: falta ${t}`);
  const pd = leerPag("impuestos/deducciones-personales/index.html");
  for (const t of ["$213,973.20", "$54,000", "$12,900", "$45,179.27", "$9,056.64", "$9,056.53", "$2,500", "retiro.js", "Dato en disputa"])
    assert.ok(pd.includes(t), `deducciones: falta ${t}`);
}

console.log("impuestos.test.js: todas las pruebas pasaron");
