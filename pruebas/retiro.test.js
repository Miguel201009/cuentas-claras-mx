// Pruebas de la sección Retiro e IMSS (Afore, semanas cotizadas y pensión Ley 73): node pruebas/retiro.test.js
// Los valores esperados se calcularon a mano (las cuentas van en los comentarios).
const assert = require("assert");
const R = require("../assets/retiro.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} != ${b}`);
const finito = (r, msg) => Object.entries(r).forEach(([k, v]) => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${k} = ${v}`);
  else if (v && typeof v === "object" && !Array.isArray(v)) finito(v, `${msg}.${k}`);
});

// ---------- Datos ----------
// Cada columna de la tabla de cuota patronal tiene 7 rangos y sube cada año hasta 2030.
const anios = Object.keys(R.DATOS.ceavPatron.anios).map(Number);
assert.deepStrictEqual(anios, [2026, 2027, 2028, 2029, 2030]);
anios.forEach(a => assert.strictEqual(R.DATOS.ceavPatron.anios[a].length, 7));
for (let i = 1; i < anios.length; i++) {
  R.DATOS.ceavPatron.anios[anios[i]].forEach((t, j) => assert.ok(t > R.DATOS.ceavPatron.anios[anios[i - 1]][j], `sube ${anios[i]} rango ${j}`));
}
// La tabla de 2030 es la del art. 168 fr. II a): de 3.150% (2022) sube lo mismo cada año en 8 pasos.
// Ejemplo 4.01 UMA o más: (11.875 - 3.150) / 8 = 1.090625 por año; 2026 = 3.150 + 4 x 1.090625 = 7.5125.
R.DATOS.ceavPatron.anios[2030].forEach((fin, j) => {
  const paso = (fin - 3.150) / 8;
  [2026, 2027, 2028, 2029].forEach((a, k) => cerca(R.DATOS.ceavPatron.anios[a][j], 3.150 + (4 + k) * paso, `progresión rango ${j} en ${a}`, 0.0011));
});
assert.strictEqual(R.DATOS.ceavPatron.anios[2026][6], 7.513);
assert.strictEqual(R.DATOS.ceavPatron.anios[2030][6], 11.875);
assert.strictEqual(R.DATOS.ley73.tabla.length, 22);

// ---------- Salario base de cotización ----------
cerca(R.sbcDiario(12000), 419.72, "12,000 / 30 x 1.0493");
assert.strictEqual(R.sbcDiario(0), 0);
assert.strictEqual(R.sbcDiario(""), 0);
assert.strictEqual(R.sbcDiario(-5000), 0);
cerca(R.sbcDiario(5000), 315.04, "no baja del salario mínimo");
cerca(R.sbcDiario(1e8), 2932.75, "tope de 25 UMA (25 x 117.31)");

// ---------- Cuota patronal de cesantía y vejez ----------
assert.strictEqual(R.tasaCeavPatron(315.04, 2026), 3.150);           // 1 salario mínimo
assert.strictEqual(R.tasaCeavPatron(330, 2026), 6.026);              // 330 / 117.31 = 2.81 UMA
assert.strictEqual(R.tasaCeavPatron(330, 2030), 8.902);
assert.strictEqual(R.tasaCeavPatron(330, 2040), 8.902);              // después de 2030 se queda
assert.strictEqual(R.tasaCeavPatron(330, 2024), 6.026);              // antes de 2026 usa 2026
assert.strictEqual(R.tasaCeavPatron(400, 2026), 6.361);              // 3.41 UMA
assert.strictEqual(R.tasaCeavPatron(419.72, 2026), 6.613);           // 3.58 UMA
assert.strictEqual(R.tasaCeavPatron(469.24, 2026), 6.613);           // 4.00 UMA justas
assert.strictEqual(R.tasaCeavPatron(470, 2026), 7.513);              // 4.007 UMA
assert.strictEqual(R.tasaCeavPatron(2932.75, 2029), 10.784);

// ---------- Cuota social ----------
assert.strictEqual(R.cuotaSocialDiaria(315.04), 10.75);
assert.strictEqual(R.cuotaSocialDiaria(330), 7.75);
assert.strictEqual(R.cuotaSocialDiaria(400), 7.00);
assert.strictEqual(R.cuotaSocialDiaria(419.72), 6.25);
assert.strictEqual(R.cuotaSocialDiaria(469.24), 6.25);
assert.strictEqual(R.cuotaSocialDiaria(470), 0);
assert.strictEqual(R.cuotaSocialDiaria(0), 0);

// ---------- Aportación de un mes (ejemplo de la página: $12,000 al mes) ----------
// SBC mensual = 419.72 x 30.4 = 12,759.488
let a = R.aportacionMensual(12000, 2026);
cerca(a.sbcMensual, 12759.49, "SBC mensual");
cerca(a.retiro, 255.19, "retiro 2%");
cerca(a.ceavPatron, 843.78, "cesantía y vejez patrón 6.613%");
cerca(a.ceavTrabajador, 143.54, "cesantía y vejez trabajador 1.125%");
cerca(a.cuotaSocial, 190.00, "cuota social 6.25 x 30.4");
cerca(a.total, 1432.52, "total 2026");
cerca(a.tasaTotal, 9.738, "2 + 6.613 + 1.125", 0.0001);
a = R.aportacionMensual(12000, 2030);
cerca(a.ceavPatron, 1285.77, "patrón en 2030: 12,759.488 x 10.077%");
cerca(a.total, 1874.51, "total 2030");
assert.strictEqual(a.patronPagaTuParte, false);
cerca(a.trabajador, 143.54, "con $12,000 tú pones tu 1.125%");
a = R.aportacionMensual(0, 2026);
assert.strictEqual(a.total, 0);
assert.strictEqual(a.patronPagaTuParte, false);
finito(a, "aportación sin sueldo");
// Art. 36 LSS: quien gana el salario mínimo (9,451.20 = 315.04 x 30) no paga su parte; la paga el patrón.
// SBC = 315.04 x 1.0493 = 330.571472 (2.82 UMA, patrón 6.026%, cuota social 7.75). Mensual 10,049.3727:
// retiro 200.98745 + patrón 605.5752 + 1.125% 113.0554 + cuota social 235.60 = 1,155.2181 (el total no cambia).
a = R.aportacionMensual(9451.20, 2026);
assert.strictEqual(a.patronPagaTuParte, true);
assert.strictEqual(a.trabajador, 0);
cerca(a.ceavTrabajador, 113.06, "la cuota de 1.125% sigue entrando");
cerca(a.patron, 919.62, "el patrón paga 200.99 + 605.58 + 113.06");
cerca(a.total, 1155.22, "total con salario mínimo");
assert.strictEqual(R.aportacionMensual(9451.21, 2026).patronPagaTuParte, false);
assert.strictEqual(R.aportacionMensual(5000, 2026).patronPagaTuParte, true); // SBC = mínimo, patrón 3.150%
// Sueldo alto: sin cuota social y con tope de 25 UMA. 2,932.75 x 30.4 = 89,155.60; x (2 + 7.513 + 1.125)% = 9,484.37
a = R.aportacionMensual(500000, 2026);
assert.strictEqual(a.cuotaSocial, 0);
cerca(a.sbcMensual, 89155.60, "SBC mensual topado");
cerca(a.total, 89155.60 * 0.10638, "total con tope");

// ---------- Proyección de la Afore ----------
// Sin rendimiento ni comisión: 1,000 de saldo + 12 meses x 100 voluntarios = 2,200
let p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 0, saldo: 1000, voluntaria: 100, rendimiento: 0, comision: 0, aniosCobro: 1 });
assert.strictEqual(p.meses, 12);
cerca(p.saldoFinal, 2200, "saldo sin rendimiento");
cerca(p.voluntario, 1200, "voluntario");
assert.strictEqual(p.obligatorio, 0);
cerca(p.rendimientos, 0, "sin rendimientos");
cerca(p.pensionMensual, 2200 / 12, "repartido en 1 año");
// 10% anual compuesto por mes durante 12 meses: 1,000 x 1.10 = 1,100
p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 0, saldo: 1000, rendimiento: 10, comision: 0 });
cerca(p.saldoFinal, 1100, "10% en un año");
cerca(p.rendimientos, 100, "rendimiento ganado");
// Más de 10% se recorta a 10% y se avisa
p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 0, saldo: 1000, rendimiento: 12, comision: 0 });
cerca(p.saldoFinal, 1100, "rendimiento recortado a 10%");
assert.ok(p.avisos.includes("rendimiento"));
// Comisión igual al rendimiento: el saldo no crece; sin comisión habría 1,030
p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 0, saldo: 1000, rendimiento: 3, comision: 3 });
cerca(p.saldoFinal, 1000, "rendimiento neto 0");
cerca(p.sinComision, 1030, "sin comisión");
cerca(p.efectoComision, 30, "efecto de la comisión");
// Comisión mayor que el rendimiento: 1% - 3% = -2% al año -> 980
p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 0, saldo: 1000, rendimiento: 1, comision: 3 });
cerca(p.saldoFinal, 980, "rendimiento neto negativo");
// Un año de aportaciones obligatorias con $12,000: 12 x 1,432.51894 = 17,190.23
p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 12000, saldo: 0, rendimiento: 0, comision: 0 });
cerca(p.saldoFinal, 17190.23, "un año de aportaciones");
cerca(p.obligatorio, 17190.23, "obligatorio");
// Con 50% del tiempo con empleo formal, la mitad: 8,595.11
p = R.proyeccionAfore({ edad: 30, edadRetiro: 31, sueldoMensual: 12000, saldo: 0, rendimiento: 0, comision: 0, densidad: 50 });
cerca(p.saldoFinal, 8595.11, "densidad 50%");
// Dos años empezando en 2029: la cuota patronal pasa de 9.211% a 10.077%.
// 2029: 255.18976 + 12,759.488 x 9.211% (1,175.2764) + 143.54424 + 190 = 1,764.0104 al mes x 12 = 21,168.125
// 2030: 1,874.5076 x 12 = 22,494.091. Total 43,662.22
p = R.proyeccionAfore({ edad: 40, edadRetiro: 42, sueldoMensual: 12000, saldo: 0, rendimiento: 0, comision: 0, anioInicio: 2029 });
cerca(p.saldoFinal, 43662.22, "cambio de año en la tabla");
// Calendario: si empiezas en noviembre de 2029 (mesInicio 11), 3 meses: noviembre y diciembre con la cuota de 2029
// y enero de 2030 con la nueva. 2 x 1,764.0104 + 1,874.5076 = 5,402.5284
p = R.proyeccionAfore({ edad: 40, edadRetiro: 40.25, sueldoMensual: 12000, saldo: 0, rendimiento: 0, comision: 0, anioInicio: 2029, mesInicio: 11 });
assert.strictEqual(p.meses, 3);
cerca(p.saldoFinal, 5402.53, "el aumento de enero entra en enero");
// Mismo caso empezando en enero (mesInicio por omisión): los 3 meses con la cuota de 2029 = 5,292.03
p = R.proyeccionAfore({ edad: 40, edadRetiro: 40.25, sueldoMensual: 12000, saldo: 0, rendimiento: 0, comision: 0, anioInicio: 2029 });
cerca(p.saldoFinal, 5292.03, "enero a marzo de 2029");
// Mes fuera de rango: se acota a 1 a 12
assert.strictEqual(R.proyeccionAfore({ edad: 40, edadRetiro: 41, sueldoMensual: 0, mesInicio: 99 }).mesInicio, 12);
assert.strictEqual(R.proyeccionAfore({ edad: 40, edadRetiro: 41, sueldoMensual: 0, mesInicio: -3 }).mesInicio, 1);
// Aumento real de sueldo: el segundo año el sueldo sube 10%. Sin rendimiento:
// año 1 (2026) con $12,000: 1,432.51894 al mes. Año 2 (2027) con $13,200: SBC 461.692 (3.94 UMA, patrón 7.479%,
// cuota social 6.25). 461.692 x 30.4 = 14,035.4368; x (2 + 7.479 + 1.125)% = 1,488.3177; + 190 = 1,678.3177 al mes.
// 12 x (1,432.51894 + 1,678.3177) = 37,330.04
p = R.proyeccionAfore({ edad: 40, edadRetiro: 42, sueldoMensual: 12000, saldo: 0, rendimiento: 0, comision: 0, aumentoSueldo: 10, anioInicio: 2026 });
cerca(p.saldoFinal, 37330.04, "aumento de sueldo");
cerca(p.sueldoFinal, 13200, "sueldo del último año");

// Ejemplo de la página (valores por defecto, calculado en octubre de 2026): 35 a 65 años, $12,000, $100,000 de
// saldo, 4%, 0.54%, 20 años. Los primeros 3 meses (oct a dic 2026) van con la cuota de 2026 y cada enero sube.
p = R.proyeccionAfore({ edad: 35, edadRetiro: 65, sueldoMensual: 12000, saldo: 100000, voluntaria: 0, rendimiento: 4, comision: 0.54, aumentoSueldo: 0, densidad: 100, aniosCobro: 20, mesInicio: 10 });
assert.strictEqual(p.anios, 30);
assert.strictEqual(p.edadValida, true);
assert.strictEqual(p.cobroValido, true);
cerca(p.hoy.total, 1432.52, "aportación de hoy");
cerca(p.en2030.total, 1874.51, "aportación desde 2030");
assert.strictEqual(Math.round(p.saldoFinal), 1424546, "saldo del ejemplo");
assert.strictEqual(Math.round(p.efectoComision), 155685, "efecto de la comisión del ejemplo");
assert.strictEqual(Math.round(p.pensionMensual), 5936, "pensión del ejemplo");
assert.strictEqual(Math.round(p.reemplazo * 100), 49, "49% del sueldo");
cerca(p.pensionMensual, p.saldoFinal / 240, "saldo entre 240 meses");
cerca(p.saldoInicial + p.obligatorio + p.voluntario + p.rendimientos, p.saldoFinal, "las partes suman el total");
// Si empezara en enero, el aumento de cada enero entraría 9 meses antes de lo debido: sale menos (1,414,286).
assert.strictEqual(Math.round(R.proyeccionAfore({ edad: 35, edadRetiro: 65, sueldoMensual: 12000, saldo: 100000, rendimiento: 4, comision: 0.54, aniosCobro: 20, mesInicio: 1 }).saldoFinal), 1414286);
p = R.proyeccionAfore({ edad: 35, edadRetiro: 65, sueldoMensual: 12000, saldo: 100000, voluntaria: 500, rendimiento: 4, comision: 0.54, aniosCobro: 20, mesInicio: 10 });
assert.strictEqual(Math.round(p.saldoFinal), 1737101, "con $500 voluntarios");
assert.strictEqual(Math.round(p.pensionMensual), 7238, "pensión con $500 voluntarios");

// Edades y años de reparto inválidos: no se proyecta y se avisa.
p = R.proyeccionAfore({ edad: -5, edadRetiro: 65, sueldoMensual: 12000, saldo: 100000 });
assert.strictEqual(p.edadValida, false);
assert.strictEqual(p.anios, 0);
assert.ok(p.avisos.includes("edad"));
assert.strictEqual(p.saldoFinal, 100000);
p = R.proyeccionAfore({ edad: 14, edadRetiro: 65, sueldoMensual: 12000 });
assert.strictEqual(p.edadValida, false);
assert.strictEqual(p.anios, 0);
p = R.proyeccionAfore({ edad: 15, edadRetiro: 100, sueldoMensual: 0 });
assert.strictEqual(p.edadValida, true);
assert.strictEqual(p.retiroValido, true);
assert.strictEqual(p.anios, 70); // 85 años se recortan a 70
p = R.proyeccionAfore({ edad: 101, edadRetiro: 65 });
assert.strictEqual(p.edadValida, false);
p = R.proyeccionAfore({ edad: 35, edadRetiro: 101 });
assert.strictEqual(p.retiroValido, false);
assert.ok(p.avisos.includes("retiro"));
assert.strictEqual(p.anios, 0);
p = R.proyeccionAfore({ edad: 35, edadRetiro: 65, sueldoMensual: 12000, aniosCobro: 0 });
assert.strictEqual(p.cobroValido, false);
assert.ok(p.avisos.includes("cobroMin"));
assert.strictEqual(p.aniosCobro, 1);
assert.strictEqual(R.proyeccionAfore({ edad: 35, edadRetiro: 65, aniosCobro: 0.5 }).cobroValido, false);
assert.strictEqual(R.proyeccionAfore({ edad: 35, edadRetiro: 65, aniosCobro: 1 }).cobroValido, true);
// Rendimiento 0 con comisión: los "rendimientos" salen negativos (la página cambia la etiqueta).
p = R.proyeccionAfore({ edad: 35, edadRetiro: 65, sueldoMensual: 12000, saldo: 100000, rendimiento: 0, comision: 0.54, mesInicio: 10 });
assert.ok(p.rendimientos < 0, "rendimiento 0 menos comisión");
finito(p, "rendimiento 0");

// Entradas raras: sin NaN ni Infinity.
p = R.proyeccionAfore({ edad: 65, edadRetiro: 40, sueldoMensual: 12000, saldo: 5000 });
assert.strictEqual(p.anios, 0);
assert.strictEqual(p.saldoFinal, 5000);
finito(p, "retiro antes de hoy");
p = R.proyeccionAfore({ edad: "", edadRetiro: "", sueldoMensual: "", saldo: "", voluntaria: "", rendimiento: "", comision: "", aumentoSueldo: "", densidad: "", aniosCobro: "" });
assert.strictEqual(p.saldoFinal, 0);
assert.strictEqual(p.aniosCobro, 1);
finito(p, "todo vacío");
p = R.proyeccionAfore({ edad: -5, edadRetiro: -1, sueldoMensual: -12000, saldo: -100, voluntaria: -50, rendimiento: -4, comision: -1, densidad: -10, aniosCobro: -3 });
assert.strictEqual(p.saldoFinal, 0);
finito(p, "negativos");
p = R.proyeccionAfore({ edad: 0, edadRetiro: 1e9, sueldoMensual: 1e15 });
finito(p, "edad 0 y retiro enorme");
assert.ok(p.avisos.includes("edad") && p.avisos.includes("retiro"));
assert.strictEqual(p.anios, 0);
p = R.proyeccionAfore({ edad: 20, edadRetiro: 100, sueldoMensual: 1e15, saldo: 1e20, voluntaria: 1e12, rendimiento: 1e6, comision: 99, aumentoSueldo: 1e3, densidad: 1e3, aniosCobro: 1e6, mesInicio: 1e9 });
finito(p, "enormes");
["anios", "sueldo", "saldo", "voluntaria", "rendimiento", "comision", "aumento", "densidad", "cobro"].forEach(k => assert.ok(p.avisos.includes(k), "aviso " + k));
assert.strictEqual(p.anios, 70);
assert.strictEqual(p.rendimiento, 10);
assert.ok(p.saldoFinal < 1e14, "un resultado enorme pero acotado");
p = R.proyeccionAfore({ edad: "Infinity", edadRetiro: "NaN", sueldoMensual: "abc", saldo: Infinity });
finito(p, "texto e infinitos");

// ---------- Semanas cotizadas ----------
assert.strictEqual(R.semanasRequeridas("ley97", 2026), 875);
assert.strictEqual(R.semanasRequeridas("ley97", 2027), 900);
assert.strictEqual(R.semanasRequeridas("ley97", 2030), 975);
assert.strictEqual(R.semanasRequeridas("ley97", 2031), 1000);
assert.strictEqual(R.semanasRequeridas("ley97", 2050), 1000);
assert.strictEqual(R.semanasRequeridas("ley97", 2021), 750);
assert.strictEqual(R.semanasRequeridas("ley73", 2030), 500);
// 750 en 2021 y 25 más cada año
for (let y = 2021; y <= 2031; y++) assert.strictEqual(R.semanasRequeridas("ley97", y), 750 + 25 * (y - 2021));
// Ejemplo de la página (valores por defecto): Ley 97, 800 semanas, pensión en 2029, hoy 20 oct 2026 (quedan 10
// semanas del año: 72 días / 7). Piden 950; faltan 150 (2.88 años). Caben 10 + 52 x 3 = 166 -> sí da tiempo.
let s = R.semanasFaltantes({ regimen: "ley97", semanas: 800, anio: 2029, anioActual: 2026, restantesAnio: 10 });
assert.strictEqual(s.requeridas, 950);
assert.strictEqual(s.faltan, 150);
assert.strictEqual(s.caben, 166);
assert.strictEqual(s.alcanza, true);
assert.strictEqual(s.anioPosible, 2029);
assert.strictEqual(s.faltanPosible, 150);
cerca(s.aniosFaltanPosible, 2.88, "150 / 52");
cerca(s.aniosTienes, 15.38, "800 / 52");
// Caso de la página: 600 semanas y 2030. Piden 975 y faltan 375, pero solo caben 10 + 52 x 4 = 218.
// Con trabajo continuo: 2031: 600 + 270 = 870 < 1,000; 2032: 922; 2033: 974; 2034: 1,026 >= 1,000.
// Te faltan de verdad 1,000 - 600 = 400 semanas (7.69 años).
s = R.semanasFaltantes({ regimen: "ley97", semanas: 600, anio: 2030, anioActual: 2026, restantesAnio: 10 });
assert.strictEqual(s.requeridas, 975);
assert.strictEqual(s.faltan, 375);
assert.strictEqual(s.cumple, false);
assert.strictEqual(s.caben, 218);
assert.strictEqual(s.alcanza, false);
assert.strictEqual(s.anioPosible, 2034);
assert.strictEqual(s.requeridasPosible, 1000);
assert.strictEqual(s.faltanPosible, 400);
cerca(s.aniosFaltanPosible, 7.69, "400 / 52");
cerca(s.aniosTienes, 600 / 52, "años cotizados");
// Sin semanas restantes del año (por ejemplo, el 31 de diciembre): 2033: 600 + 364 = 964; 2034: 1,016 -> 2034
s = R.semanasFaltantes({ regimen: "ley97", semanas: 600, anio: 2030, anioActual: 2026, restantesAnio: 0 });
assert.strictEqual(s.anioPosible, 2034);
// El mismo año: con 870 y 10 semanas por delante sí llegas a las 875 de 2026; sin semanas por delante, no:
// en 2027 tendrías 870 + 52 = 922 >= 900 y te faltarían 30.
s = R.semanasFaltantes({ regimen: "ley97", semanas: 870, anio: 2026, anioActual: 2026, restantesAnio: 10 });
assert.strictEqual(s.alcanza, true);
assert.strictEqual(s.faltan, 5);
s = R.semanasFaltantes({ regimen: "ley97", semanas: 870, anio: 2026, anioActual: 2026, restantesAnio: 0 });
assert.strictEqual(s.alcanza, false);
assert.strictEqual(s.anioPosible, 2027);
assert.strictEqual(s.faltanPosible, 30);
// Sin semanas: 2045: 10 + 52 x 19 = 998 < 1,000; 2046: 1,050 -> 2046
s = R.semanasFaltantes({ regimen: "ley97", semanas: 0, anio: 2026, anioActual: 2026, restantesAnio: 10 });
assert.strictEqual(s.anioPosible, 2046);
assert.strictEqual(s.faltanPosible, 1000);
// Ley 73: 450 semanas en 2026 no caben (faltan 50, caben 10); en 2027: 450 + 62 = 512 >= 500
s = R.semanasFaltantes({ regimen: "ley73", semanas: 450, anio: 2026, anioActual: 2026, restantesAnio: 10 });
assert.strictEqual(s.alcanza, false);
assert.strictEqual(s.anioPosible, 2027);
assert.strictEqual(s.faltanPosible, 50);
s = R.semanasFaltantes({ regimen: "ley73", semanas: 600, anio: 2030 });
assert.strictEqual(s.cumple, true);
assert.strictEqual(s.alcanza, true);
assert.strictEqual(s.sobran, 100);
assert.strictEqual(s.faltan, 0);
// Un año anterior al de hoy cuenta como el de hoy
s = R.semanasFaltantes({ regimen: "ley97", semanas: 830, anio: 2024, anioActual: 2026, restantesAnio: 10 });
assert.strictEqual(s.anio, 2026);
assert.strictEqual(s.requeridas, 875);
// Semanas restantes fuera de rango: se acotan a 0 a 52
assert.strictEqual(R.semanasFaltantes({ semanas: 0, anio: 2026, anioActual: 2026, restantesAnio: 999 }).caben, 52);
assert.strictEqual(R.semanasFaltantes({ semanas: 0, anio: 2026, anioActual: 2026, restantesAnio: -5 }).caben, 0);
s = R.semanasFaltantes({ regimen: "ley97", semanas: "", anio: 2026 });
assert.strictEqual(s.faltan, 875);
s = R.semanasFaltantes({ regimen: "ley97", semanas: -40, anio: "" });
assert.strictEqual(s.tienes, 0);
assert.strictEqual(s.requeridas, 875);
s = R.semanasFaltantes({ regimen: "ley97", semanas: 1e9, anio: 1e9 });
assert.strictEqual(s.tienes, 5000);
assert.strictEqual(s.acotado, true);
assert.strictEqual(s.requeridas, 1000);
finito(s, "semanas enormes");
s = R.semanasFaltantes({ regimen: "ley97", semanas: 875.9, anio: 2026 });
assert.strictEqual(s.tienes, 875);
assert.strictEqual(s.cumple, true);

// ---------- Incrementos de la Ley 73 ----------
assert.strictEqual(R.incrementosLey73(500).total, 0);
assert.strictEqual(R.incrementosLey73(499).total, 0);
assert.strictEqual(R.incrementosLey73(512).total, 0);     // sobran 12
assert.strictEqual(R.incrementosLey73(513).total, 0.5);   // sobran 13
assert.strictEqual(R.incrementosLey73(526).total, 0.5);   // sobran 26
assert.strictEqual(R.incrementosLey73(527).total, 1);     // sobran 27
assert.strictEqual(R.incrementosLey73(552).total, 1);     // 52 justas
assert.strictEqual(R.incrementosLey73(1300).total, 15.5); // 800 = 15 x 52 + 20
assert.strictEqual(R.incrementosLey73("").total, 0);

// ---------- Pensión Ley 73 ----------
// Ejemplo de la página: $600 diarios, 1,300 semanas, 65 años, con pareja.
// 600 / 315.04 = 1.9045 -> grupo 1.76 a 2.00: 42.67% + 15.5 x 1.615% = 67.7025%
// 600 x 67.7025% = 406.215; x 1.15 = 467.14725; x 1.11 = 518.5334475; x 365 / 12 = 15,772.06
let l = R.pensionLey73({ salarioPromedio: 600, semanas: 1300, edad: 65, pareja: true });
cerca(l.veces, 1.9045, "grupo", 0.0001);
assert.strictEqual(l.vecesGrupo, 1.90);
assert.strictEqual(l.basica, 42.67);
assert.strictEqual(l.incremento, 1.615);
cerca(l.porcentaje, 67.7025, "porcentaje", 1e-9);
cerca(l.cuantia, 406.215, "cuantía diaria");
cerca(l.conAsignaciones, 467.14725, "con pareja");
cerca(l.diaria, 518.5334475, "con 11%");
cerca(l.mensual, 15772.06, "pensión mensual");
cerca(l.anual, 15772.059 * 12, "al año", 0.05);
cerca(l.minima, 10636.54, "pensión mínima 2026: 315.04 x 365 / 12 x 1.11");
assert.strictEqual(l.derecho, true);
assert.strictEqual(l.usaMinima, false);
// Mismo caso a los 60 años: 75% -> 11,829.04
l = R.pensionLey73({ salarioPromedio: 600, semanas: 1300, edad: 60, pareja: true });
cerca(l.mensual, 15772.059 * 0.75, "cesantía a los 60");
cerca(l.mensual, 11829.04, "cesantía a los 60 en pesos");
// Factores por edad
[[61, 0.80], [62, 0.85], [63, 0.90], [64, 0.95], [70, 1]].forEach(([e, f]) =>
  assert.strictEqual(R.pensionLey73({ salarioPromedio: 600, semanas: 1300, edad: e }).factorEdad, f));
// Salario bajo: $320 (1.0157 SM, grupo 1.01 a 1.25: 77.11%), 500 semanas, sin familia (ayuda 15%).
// 320 x 77.11% = 246.752; x 1.15 = 283.7648; x 1.11 = 314.978928; x 365 / 12 = 9,580.61 -> le toca la mínima
l = R.pensionLey73({ salarioPromedio: 320, semanas: 500, edad: 65, pareja: false });
cerca(l.calculada, 9580.61, "cálculo bajo");
assert.strictEqual(l.usaMinima, true);
cerca(l.mensual, 10636.54, "pensión mínima");
cerca(l.ayuda, 0.15, "ayuda asistencial");
// Un solo padre: $1,000, 1,000 semanas, 62 años. 1,000 / 315.04 = 3.174 -> 25.60% y 2.096%.
// Sobran 500 semanas = 9 x 52 + 32 -> 10 incrementos: 25.60 + 20.96 = 46.56% -> 465.60
// Asignación del padre 10% + ayuda 10% = 20% -> 558.72; x 0.85 = 474.912; x 1.11 = 527.15232; x 365 / 12 = 16,034.22
l = R.pensionLey73({ salarioPromedio: 1000, semanas: 1000, edad: 62, pareja: false, hijos: 0, padres: 1 });
cerca(l.porcentaje, 46.56, "porcentaje un padre", 1e-9);
cerca(l.asignacion + l.ayuda, 0.20, "padre + ayuda");
cerca(l.mensual, 16034.22, "pensión con un padre");
// Los padres solo cuentan si no hay pareja ni hijos
l = R.pensionLey73({ salarioPromedio: 1000, semanas: 1000, edad: 65, pareja: true, hijos: 2, padres: 2 });
cerca(l.asignacion, 0.35, "pareja + 2 hijos, sin padres");
assert.strictEqual(l.ayuda, 0);
// Tope del 100% del salario promedio: $300 (grupo hasta 1 SM: 80% y 0.563%), 2,500 semanas
// 2,000 sobran = 38 x 52 + 24 -> 38.5 incrementos -> 80 + 21.6755 = 101.6755%; con pareja y 5 hijos (65%) pasa de 300
// Se topa en 300; x 1.11 = 333 al día; x 365 / 12 = 10,128.75, menos que la mínima -> 10,636.54
l = R.pensionLey73({ salarioPromedio: 300, semanas: 2500, edad: 65, pareja: true, hijos: 5 });
cerca(l.porcentaje, 101.6755, "más de 100%", 1e-9);
assert.strictEqual(l.topadoCien, true);
cerca(l.conTope, 300, "tope 100%");
cerca(l.calculada, 10128.75, "calculada con tope");
cerca(l.mensual, 10636.54, "mínima");
// Bordes de grupo: las veces se redondean a 2 decimales antes de buscar el grupo (lo mismo que se muestra).
// 4.7504 SM -> 4.75 -> grupo 4.51 a 4.75 (17.30%); 4.756 SM -> 4.76 -> grupo 4.76 a 5.00 (16.41%).
l = R.pensionLey73({ salarioPromedio: 4.7504 * 315.04, semanas: 1300 });
assert.strictEqual(l.vecesGrupo, 4.75);
assert.strictEqual(l.basica, 17.30);
l = R.pensionLey73({ salarioPromedio: 4.756 * 315.04, semanas: 1300 });
assert.strictEqual(l.vecesGrupo, 4.76);
assert.strictEqual(l.basica, 16.41);
// 316 / 315.04 = 1.003 -> 1.00 -> grupo hasta 1.00 (80%)
assert.strictEqual(R.pensionLey73({ salarioPromedio: 316, semanas: 500 }).basica, 80.00);
// Sin derecho
l = R.pensionLey73({ salarioPromedio: 600, semanas: 499, edad: 65 });
assert.strictEqual(l.derecho, false);
assert.strictEqual(l.faltanSemanas, true);
assert.strictEqual(l.mensual, 0);
l = R.pensionLey73({ salarioPromedio: 600, semanas: 1300, edad: 59 });
assert.strictEqual(l.faltaEdad, true);
assert.strictEqual(l.mensual, 0);
// Salario enorme: se topa en 25 UMA (2,932.75 = 9.31 SM, grupo 6.01 o más: 13% y 2.45%)
l = R.pensionLey73({ salarioPromedio: 1e9, semanas: 1e9, edad: 65, hijos: 1e6, padres: 99 });
assert.strictEqual(l.topado, true);
assert.strictEqual(l.spd, 2932.75);
assert.strictEqual(l.basica, 13.00);
assert.strictEqual(l.semanas, 5000);
assert.strictEqual(l.semanasAcotadas, true);
finito(l, "Ley 73 enorme");
assert.ok(l.mensual <= 2932.75 * 1.11 * 365 / 12 + 0.01, "nunca más del 100% del salario más 11%");
// Todo vacío o negativo
l = R.pensionLey73({ salarioPromedio: "", semanas: "", edad: "", hijos: "", padres: "" });
assert.strictEqual(l.mensual, 0);
finito(l, "Ley 73 vacía");
l = R.pensionLey73({ salarioPromedio: -600, semanas: -1300, edad: -65, hijos: -2, padres: -1 });
assert.strictEqual(l.mensual, 0);
finito(l, "Ley 73 negativos");

// ---------- Aportaciones voluntarias ----------
// $1,000 al mes, 20 años, 4% - 0.54% de comisión: i = 1.0346^(1/12) - 1; saldo = 1,000 x ((1+i)^240 - 1) / i = 343,291.45.
// Ingresos de 300,000: tope 10% = 30,000 (5 UMA = 213,973.20). Se deducen los 12,000 del año.
// ISR sin deducción: (300,000 - 210,403.70) x 21.36% + 22,282.14 = 41,419.91; con: 288,000 -> 38,856.71. Ahorro 2,563.20.
{
  const v = R.aportacionesVoluntarias({ mensual: 1000, anios: 20, rendimiento: 4, comision: 0.54, ingresoAnual: 300000 });
  const i = Math.pow(1.0346, 1 / 12) - 1;
  cerca(v.saldoFinal, 1000 * (Math.pow(1 + i, 240) - 1) / i, "fórmula cerrada");
  cerca(v.saldoFinal, 343291.45, "saldo a 20 años");
  cerca(v.aportado, 240000, "aportado");
  cerca(v.rendimientos, 103291.45, "rendimientos");
  assert.strictEqual(v.porAnio.length, 20);
  cerca(v.porAnio[19].saldo, v.saldoFinal, "la tabla termina en el saldo final");
  cerca(v.topeUma, 213973.20, "5 UMA anuales");
  cerca(v.topeIngreso, 30000, "10% de los ingresos");
  cerca(v.deduccion, 12000, "deducción");
  cerca(v.isrSin, 41419.91, "ISR sin deducción");
  cerca(v.isrCon, 38856.71, "ISR con deducción");
  cerca(v.ahorroIsr, 2563.20, "ISR que te ahorras");
  cerca(v.costoNeto, 9436.80, "costo neto");
  assert.strictEqual(v.tasaMarginal, 21.36);
  // Tope de 10%: con 100,000 de ingresos solo se deducen 10,000 de los 12,000.
  const b = R.aportacionesVoluntarias({ mensual: 1000, anios: 1, ingresoAnual: 100000 });
  cerca(b.deduccion, 10000, "tope 10%");
  cerca(b.sinUsar, 2000, "lo que no se deduce");
  // Tope de 5 UMA: con 3,000,000 de ingresos y 360,000 al año se deducen 213,973.20, todo en el renglón de 34%.
  const c = R.aportacionesVoluntarias({ mensual: 30000, anios: 1, ingresoAnual: 3000000 });
  assert.ok(c.limitaUma);
  cerca(c.deduccion, 213973.20, "tope 5 UMA");
  cerca(c.ahorroIsr, 72750.89, "213,973.20 x 34%");
  // No deducible: no baja el ISR.
  const d = R.aportacionesVoluntarias({ mensual: 1000, anios: 5, ingresoAnual: 300000, deducible: false });
  assert.strictEqual(d.deduccion, 0);
  assert.strictEqual(d.ahorroIsr, 0);
  // Ingresos bajos: tope 10% de 5,000 = 500, al 1.92% del primer renglón regresa 9.60. Sin ingresos, nada.
  cerca(R.aportacionesVoluntarias({ mensual: 500, anios: 1, ingresoAnual: 5000 }).ahorroIsr, 9.60, "ingresos bajos");
  assert.strictEqual(R.aportacionesVoluntarias({ mensual: 500, anios: 1, ingresoAnual: 0 }).ahorroIsr, 0);
  // Sin rendimiento ni comisión: el saldo es lo aportado.
  cerca(R.aportacionesVoluntarias({ mensual: 500, anios: 10, rendimiento: 0, comision: 0 }).saldoFinal, 60000, "sin rendimiento");
  const raro = R.aportacionesVoluntarias({ mensual: 1e12, anios: 1e6, rendimiento: 1e3, comision: -1, ingresoAnual: "x" });
  assert.ok(raro.avisos.includes("mensual") && raro.avisos.includes("anios"));
  finito(raro, "aportaciones voluntarias con basura");
  const fs = require("fs"), path = require("path");
  const pag = fs.readFileSync(path.join(__dirname, "..", "retiro/aportaciones-voluntarias/index.html"), "utf8");
  for (const t of ["$343,291.45", "$103,291.45", "$213,973.20", "$2,563.20", "$9,436.80", "$41,419.91", "$38,856.71", 'href="../afore/"', "impuestos.js"])
    assert.ok(pag.includes(t), `aportaciones voluntarias: falta ${t}`);
}

console.log("retiro.test.js: todas las pruebas pasaron");
