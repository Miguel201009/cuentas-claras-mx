// Pruebas de la sección Vivienda: node pruebas/vivienda.test.js
// Los valores esperados se calcularon a mano (con calculadora) a partir de las fórmulas de cada página.
const assert = require("assert");
const V = require("../assets/vivienda.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} != ${b}`);
// Ningún número del resultado puede ser NaN o Infinity (revisa también objetos anidados y listas).
const finito = (r, msg) => {
  const revisar = (v, ruta) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${ruta} = ${v}`);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => revisar(x, ruta + "." + k));
  };
  revisar(r, "r");
};
// Entradas base sin efectos: cada caso cambia solo lo que quiere probar.
const base = {
  anios: 1, renta: 0, aumentoRenta: 0, precio: 0, enganche: 100, gastosCompra: 0, tasa: 0, plazo: 20,
  plusvalia: 0, mantenimiento: 0, predial: 0, rendimiento: 0
};
const caso = cambios => V.rentarOComprar(Object.assign({}, base, cambios));

// ---------- Datos oficiales ----------
assert.strictEqual(V.DATOS.infonavit.aportacion, 0.05, "aportación patronal 5% (art. 29 fr. II Ley del Infonavit)");
assert.strictEqual(V.DATOS.infonavit.topeUma, 25, "tope de 25 UMA");
// Las tasas del crédito tradicional no se guardan como dato: no se pudieron confirmar con la tabla oficial.
assert.strictEqual(V.DATOS.infonavit.tasaMin, undefined, "sin tasa mínima sin confirmar");
assert.strictEqual(V.DATOS.infonavit.tasaMax, undefined, "sin tasa máxima sin confirmar");
assert.strictEqual(V.umaAPesos, undefined, "ya no se convierten cortes de UMA sin confirmar a pesos");
assert.strictEqual(V.DATOS.predial.tasaNuevoLeon, 2, "Nuevo León: 2 al millar al año para casa habitación");
assert.strictEqual(V.DATOS.predial.descuentoMonterrey, 15, "Monterrey 2026: 15% hasta el 5 de febrero");

// ---------- Pago mensual de un crédito ----------
cerca(V.pagoMensual(120000, 0, 12), 10000, "tasa 0: 120,000 / 12");
// 100,000 al 12% anual (1% al mes) en 12 meses: 1,000 / (1 - 1.01^-12) = 8,884.88.
cerca(V.pagoMensual(100000, 12, 12), 8884.88, "100 mil al 12% a 12 meses");
// Ejemplo de la página: 1,800,000 al 10% a 20 años. i = 0.008333; 1.008333^240 = 7.3281; 15,000 / (1 - 1/7.3281) = 17,370.39.
cerca(V.pagoMensual(1800000, 10, 240), 17370.39, "hipoteca del ejemplo");
assert.strictEqual(V.pagoMensual(0, 10, 240), 0);
assert.strictEqual(V.pagoMensual(100000, 10, 0), 0);
assert.strictEqual(V.pagoMensual("", "", ""), 0);

// ---------- Rentar o comprar ----------
// 1) Casa de contado (enganche 100%), sin gastos. Quien compra no paga nada al mes y ahorra lo que sería la renta.
// Compra: casa 1,200,000 + 12 x 10,000 ahorrados = 1,320,000. Renta: invierte 1,200,000 sin rendimiento.
let r = caso({ precio: 1200000, renta: 10000 });
cerca(r.patrimonioCompra, 1320000, "contado: patrimonio si compras");
cerca(r.patrimonioRenta, 1200000, "contado: patrimonio si rentas");
cerca(r.diferencia, 120000, "contado: diferencia");
cerca(r.totalRenta, 120000, "contado: total de renta");
assert.strictEqual(r.conviene, "comprar");
assert.strictEqual(r.credito, 0);
assert.strictEqual(r.pago, 0);
assert.strictEqual(r.interesesCredito, 0, "de contado no hay intereses");
finito(r, "contado");

// 2) Crédito al 0% con pago igual a la renta: 1,200,000 a 10 años = 10,000 al mes, renta de 10,000.
// Los dos gastan lo mismo. A los 2 años debes 1,200,000 - 240,000 = 960,000; tu parte de la casa vale 240,000.
r = caso({ anios: 2, precio: 1200000, enganche: 0, tasa: 0, plazo: 10, renta: 10000 });
cerca(r.pago, 10000, "pago al 0%");
cerca(r.interesesCredito, 0, "al 0% no hay intereses");
cerca(r.saldoFinal, 960000, "saldo a 2 años");
cerca(r.patrimonioCompra, 240000, "patrimonio comprando");
cerca(r.patrimonioRenta, 0, "patrimonio rentando");
assert.strictEqual(r.anioCruce, 1);

// 3) Intereses: 120,000 al 12% a 1 año = 10,661.85 al mes; intereses = 12 x 10,661.85 - 120,000 = 7,942.21.
// Sin renta, quien renta invierte cada pago (sin rendimiento): 127,942.21. Quien compra tiene la casa: 120,000.
r = caso({ precio: 120000, enganche: 0, tasa: 12, plazo: 1 });
cerca(r.pago, 10661.85, "pago al 12% a 12 meses");
cerca(r.totalIntereses, 7942.21, "intereses pagados", 0.05);
cerca(r.interesesCredito, 7942.21, "plazo y comparación de 1 año: intereses de todo el crédito iguales", 0.05);
cerca(r.saldoFinal, 0, "crédito liquidado");
cerca(r.patrimonioRenta, 127942.21, "rentando inviertes los pagos", 0.05);
cerca(r.diferencia, -7942.21, "rentar gana por los intereses", 0.05);
assert.strictEqual(r.conviene, "rentar");

// 4) Aumento de renta y plusvalía a 2 años, de contado. Renta: 12 x 1,000 + 12 x 1,100 = 25,200.
// Casa de 100,000 con 10% de gastos: quien renta invierte 110,000. Casa al final: 100,000 x 1.1^2 = 121,000.
r = caso({ anios: 2, precio: 100000, gastosCompra: 10, renta: 1000, aumentoRenta: 10, plusvalia: 10 });
cerca(r.totalRenta, 25200, "renta con aumento de 10%");
cerca(r.inicial, 110000, "enganche + gastos");
cerca(r.valorCasa, 121000, "plusvalía de 10% dos años");
cerca(r.patrimonioCompra, 146200, "casa + rentas ahorradas");
cerca(r.patrimonioRenta, 110000, "lo invertido al inicio");

// 5) Rendimiento: 100,000 de contado, sin renta, inversión al 12% anual (1% al mes): 100,000 x 1.01^12 = 112,682.50.
r = caso({ precio: 100000, rendimiento: 12 });
cerca(r.patrimonioRenta, 112682.50, "inversión al 1% mensual");
cerca(r.patrimonioCompra, 100000, "casa sin plusvalía");
assert.strictEqual(r.conviene, "rentar");

// 6) Mantenimiento y predial. Casa de 1,200,000: 1% al año = 1,000 al mes; predial 1,200 al año = 100 al mes.
// Renta de 1,100: los dos gastan lo mismo, empate.
r = caso({ precio: 1200000, mantenimiento: 1, predial: 1200, renta: 1100 });
cerca(r.primerMes.mantenimiento, 1000, "mantenimiento mensual");
cerca(r.primerMes.predial, 100, "predial mensual");
cerca(r.diferencia, 0, "empate");
assert.strictEqual(r.conviene, "empate");
// Con 10% de plusvalía, el segundo año mantenimiento y predial suben 10%: 1,100 + 110 al mes contra 1,100 de renta.
// Quien renta invierte 110 x 12 = 1,320. Casa: 1,200,000 x 1.21 = 1,452,000.
r = caso({ anios: 2, precio: 1200000, mantenimiento: 1, predial: 1200, renta: 1100, plusvalia: 10 });
cerca(r.totalMantenimiento, 25200, "mantenimiento de 2 años");
cerca(r.totalPredial, 2520, "predial de 2 años");
cerca(r.patrimonioRenta, 1201320, "rentando ahorras la diferencia");
cerca(r.patrimonioCompra, 1452000, "casa con plusvalía");

// 7) Ejemplo de la página (valores cargados en la calculadora). El pago se revisó a mano (caso de arriba);
// los totales a 10 años son de esta simulación mes a mes y deben coincidir con el texto de la página.
r = V.rentarOComprar({
  anios: 10, renta: 10000, aumentoRenta: 4, precio: 2000000, enganche: 10, gastosCompra: 5, tasa: 10, plazo: 20,
  plusvalia: 5, mantenimiento: 1, predial: 3000, rendimiento: 6
});
cerca(r.inicial, 300000, "enganche 200,000 + gastos 100,000");
cerca(r.credito, 1800000, "crédito");
cerca(r.primerMes.compra, 19287.06, "costo del primer mes: 17,370.39 + 1,666.67 + 250");
cerca(r.valorCasa, 3257789.25, "2,000,000 x 1.05^10");
cerca(r.saldoFinal, 1314437.59, "saldo a 10 años", 0.05);
cerca(r.patrimonioCompra, 1943351.66, "patrimonio si compras", 0.05);
cerca(r.patrimonioRenta, 1848245.71, "patrimonio si rentas", 0.05);
cerca(r.diferencia, 95105.95, "diferencia", 0.05);
assert.strictEqual(r.conviene, "comprar");
assert.strictEqual(r.anioCruce, 8);
finito(r, "ejemplo");
// El saldo a 10 años también sale de la fórmula del saldo: P(1+i)^120 - pago x ((1+i)^120 - 1) / i.
{
  const i = 0.1 / 12, f = Math.pow(1 + i, 120);
  cerca(r.saldoFinal, 1800000 * f - V.pagoMensual(1800000, 10, 240) * (f - 1) / i, "saldo con fórmula", 0.05);
}
// Intereses: en los 10 años de la comparación (texto de la página) y en los 20 años del crédito.
// Todo el crédito: 240 pagos de 17,370.39 = 4,168,893.6 - 1,800,000 = 2,368,893.6 (2,368,893.51 sin redondear el pago).
cerca(r.totalIntereses, 1598884.34, "intereses en 10 años", 0.05);
cerca(r.totalRenta, 1440732.85, "renta en 10 años", 0.05);
cerca(r.interesesCredito, 2368893.51, "intereses de todo el crédito (20 años)", 0.05);
cerca(r.interesesCredito, 240 * 17370.39 - 1800000, "intereses con el pago redondeado", 0.2);
{
  const ejemplo = {
    anios: 10, renta: 10000, aumentoRenta: 4, precio: 2000000, enganche: 10, gastosCompra: 5, tasa: 10, plazo: 20,
    plusvalia: 5, mantenimiento: 1, predial: 3000, rendimiento: 6
  };
  // Si la comparación dura más que el crédito, los intereses de la comparación son los de todo el crédito.
  const r25 = V.rentarOComprar(Object.assign({}, ejemplo, { anios: 25 }));
  cerca(r25.totalIntereses, r25.interesesCredito, "25 años de comparación cubren los 20 del crédito", 0.05);
  // Plusvalía de -5%: la casa vale 2,000,000 x 0.95^10 = 1,197,473.88 y aún debes 1,314,437.59.
  // Lo tuyo queda en negativo: -116,963.71 (la página explica que debes más de lo que vale la casa).
  const rn = V.rentarOComprar(Object.assign({}, ejemplo, { plusvalia: -5 }));
  cerca(rn.valorCasa, 1197473.88, "minusvalía de 5% a 10 años");
  cerca(rn.saldoFinal, 1314437.59, "el saldo no depende de la plusvalía", 0.05);
  cerca(rn.patrimonioCompra, -116963.71, "patrimonio negativo si compras", 0.05);
  // La página avisa "debes más de lo que vale la casa" cuando valorCasa < saldoFinal: 1,197,473.88 < 1,314,437.59.
  assert.ok(rn.valorCasa < rn.saldoFinal, "con -5% la casa vale menos de lo que debes");
  assert.ok(r.valorCasa > r.saldoFinal, "con +5% (valores cargados) no sale el aviso");
  assert.strictEqual(rn.conviene, "rentar");
  finito(rn, "minusvalía");
}

// 8) Entradas vacías, cero, negativas y enormes: sin NaN ni Infinity.
r = V.rentarOComprar({});
assert.strictEqual(r.conviene, "faltan");
assert.ok(r.sinPrecio && r.sinAnios);
finito(r, "vacío");
r = V.rentarOComprar({ anios: "", renta: "", precio: "", enganche: "", tasa: "", plazo: "", plusvalia: "", rendimiento: "" });
assert.strictEqual(r.conviene, "faltan");
finito(r, "textos vacíos");
r = caso({ precio: 1000000, enganche: 10, plazo: 0 });
assert.ok(r.sinPlazo, "con crédito y sin plazo no se calcula");
assert.strictEqual(r.conviene, "faltan");
r = V.rentarOComprar({
  anios: -5, renta: -100, aumentoRenta: -3, precio: -2000000, enganche: -10, gastosCompra: -5, tasa: -10, plazo: -20,
  plusvalia: -5, mantenimiento: -1, predial: -3000, rendimiento: -6
});
assert.strictEqual(r.conviene, "faltan", "negativos cuentan como 0");
finito(r, "negativos");
// La plusvalía sí puede ser negativa (la casa pierde valor), con un mínimo de -20% al año.
r = caso({ anios: 2, precio: 100000, plusvalia: -10 });
cerca(r.valorCasa, 81000, "minusvalía de 10%: 100,000 x 0.9^2");
r = caso({ precio: 100000, plusvalia: -80 });
assert.strictEqual(r.entradas.plusvalia, -20);
assert.ok(r.recortado);
r = V.rentarOComprar({
  anios: 1e9, renta: 1e20, aumentoRenta: 1e9, precio: 1e20, enganche: 1e9, gastosCompra: 1e9, tasa: 1e9, plazo: 1e9,
  plusvalia: 1e9, mantenimiento: 1e9, predial: 1e20, rendimiento: 1e9
});
assert.ok(r.recortado, "cifras enormes se recortan");
assert.strictEqual(r.entradas.anios, 40);
assert.strictEqual(r.entradas.plazo, 30);
assert.strictEqual(r.entradas.enganche, 100);
finito(r, "enormes");
r = V.rentarOComprar({ anios: 40, renta: 1e7, aumentoRenta: 30, precio: 1e9, enganche: 0, gastosCompra: 30, tasa: 40, plazo: 30, plusvalia: 30, mantenimiento: 10, predial: 1e7, rendimiento: 30 });
finito(r, "máximos");
r = V.rentarOComprar({ anios: "abc", renta: "x", precio: "1e3", enganche: "50", plazo: "5", tasa: "NaN" });
finito(r, "texto");
cerca(r.credito, 500, "precio en notación 1e3");

// ---------- Predial ----------
// Valor catastral 1,000,000 x 2 al millar = 2,000. Con 15%: ahorras 300 y pagas 1,700. Por bimestre: 333.33.
let p = V.predial({ modo: "valor", valorCatastral: 1000000, tasaMillar: 2, descuento: 15 });
cerca(p.anual, 2000, "predial anual con tasa al millar");
cerca(p.ahorro, 300, "descuento de 15%");
cerca(p.pagas, 1700, "total con descuento");
cerca(p.bimestre, 333.33, "por bimestre");
// Lo que dice la boleta: 2,400 con 8% = 192 de ahorro y 2,208 a pagar.
p = V.predial({ modo: "monto", montoAnual: 2400, descuento: 8 });
cerca(p.ahorro, 192, "8% de 2,400");
cerca(p.pagas, 2208, "2,400 - 192");
p = V.predial({ modo: "monto", montoAnual: 2400, valorCatastral: 9e9, descuento: 0 });
cerca(p.pagas, 2400, "en modo monto se ignora el valor catastral");
assert.strictEqual(p.recortado, false);
p = V.predial({});
assert.ok(p.sinDatos);
finito(p, "predial vacío");
p = V.predial({ valorCatastral: -500000, tasaMillar: -2, descuento: -10 });
assert.strictEqual(p.anual, 0);
finito(p, "predial negativo");
p = V.predial({ valorCatastral: 1e15, tasaMillar: 1e6, descuento: 150 });
assert.ok(p.recortado);
assert.strictEqual(p.descuento, 100);
cerca(p.pagas, 0, "descuento de 100% como máximo");
finito(p, "predial enorme");

// ---------- Aportación al Infonavit ----------
// Sueldo 12,000: diario 400; integrado 400 x 1.0493 = 419.72; al año 419.72 x 365 x 5% = 7,659.89.
let a = V.aportacionInfonavit({ sueldoMensual: 12000, anios: 5 });
cerca(a.sbc, 419.72, "salario integrado estimado");
cerca(a.anual, 7659.89, "aportación al año");
cerca(a.bimestral, 1276.65, "aportación por bimestre");
cerca(a.acumulado, 38299.45, "5 años");
assert.strictEqual(a.conPiso, false);
// Sueldo 8,000: 266.67 x 1.0493 = 279.81, menor al salario mínimo 315.04: se usa el mínimo. 315.04 x 365 x 5% = 5,749.48.
a = V.aportacionInfonavit({ sueldoMensual: 8000, anios: 1 });
assert.strictEqual(a.conPiso, true);
cerca(a.sbc, C.DATOS.salarioMinimo.general, "piso de salario mínimo");
cerca(a.anual, 5749.48, "aportación con salario mínimo");
assert.strictEqual(a.zona, "general", "zona general por omisión");
// Frontera norte: el piso es el mínimo de la zona libre, 440.87 al día. Con 12,000 al mes el integrado (419.72)
// queda abajo: se usa 440.87. 440.87 x 365 x 5% = 8,045.88 al año; por bimestre 1,340.98.
a = V.aportacionInfonavit({ sueldoMensual: 12000, anios: 1, zona: "frontera" });
assert.strictEqual(a.conPiso, true, "en la frontera 12,000 al mes queda abajo del mínimo");
cerca(a.sbc, 440.87, "piso de la frontera norte");
cerca(a.anual, 8045.88, "aportación mínima en la frontera");
cerca(a.bimestral, 1340.98, "por bimestre en la frontera");
assert.strictEqual(a.piso, C.DATOS.salarioMinimo.frontera);
// Arriba del mínimo de la frontera la zona no cambia nada: 20,000 al mes, 666.6667 x 1.0493 = 699.5333;
// 699.5333 x 365 x 5% (= x 18.25) = 12,766.48.
cerca(V.aportacionInfonavit({ sueldoMensual: 20000, zona: "frontera" }).anual, 12766.48, "frontera con sueldo alto");
cerca(V.aportacionInfonavit({ sueldoMensual: 20000 }).anual, 12766.48, "general con sueldo alto");
// Una zona desconocida cuenta como la general.
cerca(V.aportacionInfonavit({ sueldoMensual: 8000, zona: "otra" }).sbc, 315.04, "zona desconocida");
// Sueldo muy alto: tope de 25 UMA = 25 x 117.31 = 2,932.75 al día; 2,932.75 x 365 x 5% = 53,522.69.
a = V.aportacionInfonavit({ sueldoMensual: 500000 });
assert.strictEqual(a.topado, true);
cerca(a.sbc, 2932.75, "tope 25 UMA");
cerca(a.anual, 53522.69, "aportación con tope");
cerca(a.acumulado, 53522.69, "un año por omisión");
a = V.aportacionInfonavit({ sueldoMensual: "", anios: "" });
assert.ok(a.sinSueldo);
finito(a, "sueldo vacío");
a = V.aportacionInfonavit({ sueldoMensual: -12000, anios: -3 });
assert.ok(a.sinSueldo);
finito(a, "sueldo negativo");
a = V.aportacionInfonavit({ sueldoMensual: 1e20, anios: 1e9 });
assert.ok(a.recortado && a.topado);
assert.strictEqual(a.anios, 40);
finito(a, "sueldo enorme");

// ---------- Crédito hipotecario de un banco ----------
// Ejemplo de la página: casa de $2,500,000, 20% de enganche, 10% anual, 20 años, 5% de escrituración y 1% de comisión.
// Crédito 2,000,000; pago = 2,000,000 x 0.0083333 / (1 - 1.0083333^-240) = 19,300.43.
{
  const h = V.hipotecaBancaria({ valor: 2500000, enganche: 20, tasaAnual: 10, plazo: 20, gastos: 5, comision: 1 });
  cerca(h.credito, 2000000, "crédito");
  cerca(h.pago, 19300.43, "pago mensual");
  cerca(h.pago, V.pagoMensual(2000000, 10, 240), "mismo pago que rentar o comprar");
  cerca(h.totalPagado, 4632103.90, "total de pagos");
  cerca(h.totalIntereses, 2632103.90, "intereses");
  cerca(h.gastosMonto, 125000, "escrituración 5%");
  cerca(h.comisionMonto, 20000, "comisión 1% del crédito");
  cerca(h.ivaComision, 3200, "IVA de la comisión");
  cerca(h.alInicio, 648200, "al inicio");
  cerca(h.interesPrimerMes, 16666.67, "interés del primer mes");
  assert.strictEqual(h.tabla.length, 20);
  cerca(h.tabla[0].capital + h.tabla[0].interes, 19300.43 * 12, "un año de pagos", 0.1);
  cerca(h.tabla.reduce((s, f) => s + f.capital, 0), 2000000, "el capital suma el crédito", 0.01);
  assert.strictEqual(h.tabla[19].saldo, 0);
  const s = V.hipotecaBancaria({ valor: 2500000, enganche: 20, tasaAnual: 10, plazo: 20, seguroMensual: 900 });
  cerca(s.pagoConSeguros, 20200.43, "pago con seguros");
  cerca(s.totalSeguros, 216000, "seguros en 20 años");
  const cero = V.hipotecaBancaria({ valor: 1200000, enganche: 0, tasaAnual: 0, plazo: 10 });
  cerca(cero.pago, 10000, "tasa 0");
  assert.ok(V.hipotecaBancaria({ valor: 1000000, enganche: 100, tasaAnual: 10, plazo: 20 }).sinDatos);
  assert.ok(V.hipotecaBancaria({ valor: 1000000, enganche: 20, tasaAnual: 99, plazo: 20 }).recortado);
  finito(V.hipotecaBancaria({ valor: "x", enganche: -1, tasaAnual: 1e9, plazo: 1e9, gastos: 1e9, comision: 1e9, seguroMensual: 1e12 }), "basura");
  finito(V.hipotecaBancaria({ valor: 1e9, enganche: 0, tasaAnual: 40, plazo: 30 }), "máximos");
}

console.log("Pruebas de vivienda: todas pasaron.");
