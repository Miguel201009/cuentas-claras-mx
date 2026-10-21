// Pruebas de la temporada de fin de año: Buen Fin, salario mínimo 2027 y días de descanso obligatorio.
// Correr: node pruebas/temporada-fin-de-anio.test.js. Los valores esperados se calcularon a mano.
const assert = require("assert");
const T = require("../assets/trabajo.js");
const D = require("../assets/dinero.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} != ${b}`);
const finito = (r, msg) => Object.entries(r).forEach(([k, v]) => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${k} = ${v}`);
});

// ---------- Buen Fin ----------
assert.strictEqual(D.DATOS.buenFin.inicio, "2026-11-13");
assert.strictEqual(D.DATOS.buenFin.fin, "2026-11-17");
assert.strictEqual(new Date(2026, 10, 13).getDay(), 5, "el Buen Fin empieza en viernes");
assert.strictEqual(new Date(2026, 10, 17).getDay(), 2, "y termina en martes");

// Ejemplo de la página: antes $10,000, oferta $7,000, en octubre la viste en $8,000.
// Anunciado: 1 - 7,000/10,000 = 30%. Real: 1 - 7,000/8,000 = 12.5%. Ahorro real: $1,000.
let r = D.descuentoReal({ precioAntes: 10000, precioOferta: 7000, precioPrevio: 8000 });
cerca(r.anunciado, 0.30, "descuento anunciado");
cerca(r.real, 0.125, "descuento real contra el precio que viste");
cerca(r.ahorroAnunciado, 3000, "ahorro anunciado");
cerca(r.ahorroReal, 1000, "ahorro real");
assert.strictEqual(r.veredicto, "inflado");
// Sin precio previo, la referencia es el precio "antes".
r = D.descuentoReal({ precioAntes: 10000, precioOferta: 7000 });
cerca(r.real, 0.30, "sin precio previo, real = anunciado");
assert.strictEqual(r.veredicto, "real");
// Descuento adicional de 10% sobre la oferta: 7,000 x 0.9 = 6,300; total 37%.
r = D.descuentoReal({ precioAntes: 10000, precioOferta: 7000, extra: 10 });
cerca(r.final, 6300, "precio final con descuento extra");
cerca(r.total, 0.37, "descuento total");
// La "oferta" cuesta más que lo que viste antes: no es oferta.
r = D.descuentoReal({ precioAntes: 10000, precioOferta: 8000, precioPrevio: 7500 });
assert.strictEqual(r.veredicto, "noEsOferta");
cerca(r.ahorroReal, -500, "pagas 500 más");
// Datos vacíos o absurdos: sin NaN ni Infinity.
for (const e of [{}, { precioAntes: "", precioOferta: "x" }, { precioAntes: 0, precioOferta: 100 }, { precioAntes: 1e20, precioOferta: -5, precioPrevio: NaN, extra: 500 }]) {
  r = D.descuentoReal(e);
  finito(r, "descuentoReal " + JSON.stringify(e));
}
assert.strictEqual(D.descuentoReal({}).veredicto, "faltan");
assert.strictEqual(D.descuentoReal({ precioAntes: 1e20, precioOferta: 5 }).recortado, true);

// ---------- Salario mínimo ----------
assert.deepStrictEqual(C.DATOS.salarioMinimo, { general: 315.04, frontera: 440.87 }, "salario mínimo 2026");
assert.strictEqual(T.DATOS.salarioMinimo.publicado2027, false, "el de 2027 aún no se anuncia (21 oct 2026)");
r = T.salarioMinimoPeriodos({});
assert.strictEqual(r.diario, 315.04);
cerca(r.semana, 2205.28, "315.04 x 7");
cerca(r.quincena, 4725.60, "315.04 x 15");
cerca(r.mes30, 9451.20, "315.04 x 30");
cerca(r.mesPromedio, 9582.47, "315.04 x 365 / 12 (cifra de EY y la prensa)");
r = T.salarioMinimoPeriodos({ zona: "frontera" });
cerca(r.mesPromedio, 13409.80, "440.87 x 365 / 12");
// Escenarios de Fox Sports: 12% -> 352.84 y 493.77; 13% -> 356.00 y 498.18.
cerca(T.salarioMinimoPeriodos({ aumento: 12 }).diario, 352.84, "general +12%");
cerca(T.salarioMinimoPeriodos({ zona: "frontera", aumento: 12 }).diario, 493.77, "frontera +12%");
cerca(T.salarioMinimoPeriodos({ aumento: 13 }).diario, 356.00, "general +13%");
cerca(T.salarioMinimoPeriodos({ zona: "frontera", aumento: 13 }).diario, 498.18, "frontera +13%");
cerca(T.salarioMinimoPeriodos({ aumento: 13 }).alza, 40.96, "alza diaria con 13%");
assert.strictEqual(T.salarioMinimoPeriodos({ aumento: 500 }).aumentoAcotado, true);
for (const e of [{ aumento: "x" }, { aumento: -3 }, { zona: "otra" }, { diario: NaN }]) finito(T.salarioMinimoPeriodos(e), "salario mínimo " + JSON.stringify(e));
const h = T.historialSalarioMinimo();
assert.strictEqual(h.length, 8);
cerca(h.find(x => x.anio === 2026).aumento, 0.13, "2026: 13%");
cerca(h.find(x => x.anio === 2025).aumento, 0.12, "2025: 12%");
cerca(h.find(x => x.anio === 2021).aumento, 0.15, "2021: 15%");
const hf = T.historialSalarioMinimo(T.DATOS.salarioMinimo.historialFrontera);
cerca(hf.find(x => x.anio === 2026).aumento, 0.05, "frontera 2026: 5%");

// ---------- Días de descanso obligatorio ----------
const textos = a => T.diasDescanso(a).map(x => x.texto);
assert.deepStrictEqual(textos(2026), [
  "jueves 1 de enero de 2026", "lunes 2 de febrero de 2026", "lunes 16 de marzo de 2026", "viernes 1 de mayo de 2026",
  "miércoles 16 de septiembre de 2026", "lunes 16 de noviembre de 2026", "viernes 25 de diciembre de 2026"
], "2026 según Expansión");
assert.deepStrictEqual(textos(2027), [
  "viernes 1 de enero de 2027", "lunes 1 de febrero de 2027", "lunes 15 de marzo de 2027", "sábado 1 de mayo de 2027",
  "domingo 6 de junio de 2027", "jueves 16 de septiembre de 2027", "lunes 15 de noviembre de 2027", "sábado 25 de diciembre de 2027"
], "2027 con la jornada electoral");
assert.ok(textos(2030).includes("martes 1 de octubre de 2030"), "cambio de Presidente en 2030");
assert.ok(!textos(2027).some(t => t.includes("octubre")), "en 2027 no hay 1 de octubre");
assert.strictEqual(T.diasDescanso(2027).filter(x => x.domingo).length, 1, "solo la elección cae en domingo");
assert.deepStrictEqual(T.diasDescansoPendientes(new Date(2026, 9, 21)).map(x => x.texto),
  ["lunes 16 de noviembre de 2026", "viernes 25 de diciembre de 2026"], "los que faltan de 2026");
assert.strictEqual(T.diasDescansoPendientes(new Date(2026, 11, 25)).length, 1, "el mismo día cuenta");

// Pago: salario mínimo, 1 día: 315.04 + 2 x 315.04 = 945.12 (triple).
r = T.pagoDiaFestivo({ monto: 315.04 });
cerca(r.adicional, 630.08, "salario doble adicional");
cerca(r.total, 945.12, "pago triple");
// $12,000 al mes = $400 diarios; 2 días, en domingo: normal 800, doble 1,600, prima 25% = 200; total 2,600.
r = T.pagoDiaFestivo({ monto: 12000, periodo: "mensual", dias: 2, domingo: true });
cerca(r.sd, 400, "mensual entre 30");
cerca(r.prima, 200, "prima dominical");
cerca(r.extra, 1800, "lo que te deben aparte de tu sueldo");
cerca(r.total, 2600, "total");
cerca(T.pagoDiaFestivo({ monto: 2800, periodo: "semanal" }).sd, 400, "semanal entre 7");
cerca(T.pagoDiaFestivo({ monto: 6000, periodo: "quincenal" }).sd, 400, "quincenal entre 15");
for (const e of [{}, { monto: "x", dias: "y" }, { monto: 1e20, dias: 1e9, periodo: "raro" }, { monto: -5, dias: -1 }]) {
  finito(T.pagoDiaFestivo(e), "pagoDiaFestivo " + JSON.stringify(e));
}
assert.strictEqual(T.pagoDiaFestivo({ monto: 1e20 }).recortado, true);
assert.strictEqual(T.pagoDiaFestivo({ monto: 100, dias: 1000 }).diasAcotado, true);

console.log("OK: pruebas de temporada de fin de año (Buen Fin, salario mínimo y días de descanso) pasaron");
