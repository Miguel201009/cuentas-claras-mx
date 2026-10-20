// Pruebas de la sección Negocio propio: node pruebas/negocio.test.js
// Los valores esperados se calcularon a mano (con calculadora) a partir de las fórmulas de cada página.
const assert = require("assert");
const N = require("../assets/negocio.js");
const cerca = (a, b, msg, tol = 0.006) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} != ${b}`);
// Ningún número del resultado puede ser NaN o Infinity (revisa también objetos anidados).
const finito = (r, msg) => {
  const revisar = (v, ruta) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${ruta} = ${v}`);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => revisar(x, ruta + "." + k));
  };
  revisar(r, "r");
};

// ---------- Datos ----------
assert.strictEqual(N.DATOS.iva.general, 0.16, "IVA general 16% (art. 1 LIVA)");
assert.strictEqual(N.DATOS.iva.frontera, 0.08, "IVA región fronteriza 8% (decretos de estímulos)");
assert.strictEqual(N.DATOS.iva.cero, 0, "tasa 0% (art. 2-A LIVA)");
assert.strictEqual(N.DATOS.iva.exento, 0, "exento: no se cobra IVA");
const sm = N.salarioMinimo();
assert.strictEqual(sm.general, 315.04, "salario mínimo general 2026 (de calc.js)");
assert.strictEqual(sm.frontera, 440.87, "salario mínimo frontera norte 2026 (de calc.js)");

// ---------- Margen y markup ----------
// markup = margen / (1 - margen); margen = markup / (1 + markup)
cerca(N.margenAMarkup(35), 53.85, "35% de margen = 35/65 = 53.85% de markup");
cerca(N.margenAMarkup(20), 25, "20% de margen = 25% de markup");
cerca(N.margenAMarkup(25), 33.33, "25% de margen = 33.33% de markup");
cerca(N.margenAMarkup(50), 100, "50% de margen = 100% de markup");
cerca(N.markupAMargen(100), 50, "100% de markup = 50% de margen");
cerca(N.markupAMargen(25), 20, "25% de markup = 20% de margen");
cerca(N.markupAMargen(50), 33.33, "50% de markup = 33.33% de margen");
assert.strictEqual(N.margenAMarkup(""), 0);
assert.strictEqual(N.margenAMarkup(-10), 0);
cerca(N.margenAMarkup(1e20), 9900, "margen acotado a 99%: 99/1 = 9,900%");
assert.strictEqual(N.markupAMargen("abc"), 0);
assert.ok(N.markupAMargen(1e20) < 100, "markup enorme da un margen menor a 100%");

// ---------- Precio de venta: valores de la página ----------
// Costo 120, margen 35%, IVA 16%, comisión 3.5% (el IVA de la comisión se acredita, no es costo).
// Denominador: 1 - 0.35 - 0.035 x 1.16 = 0.6094. Precio sin IVA: 120 / 0.6094 = 196.915.
// Con IVA: 196.915 x 1.16 = 228.4214. IVA: 31.5064. Comisión: 0.035 x 228.4214 = 7.9947.
// Ganancia: 0.35 x 196.915 = 68.9203 (= 196.915 - 120 - 7.9947). Markup: 68.9203 / 127.9947 = 53.85%.
let p = N.precioVenta({ costo: 120, margen: 35, iva: "general", comision: 3.5 });
assert.strictEqual(p.posible, true);
cerca(p.sinIva, 196.91, "precio sin IVA");
cerca(p.precioFinal, 228.42, "precio al cliente con IVA");
cerca(p.iva, 31.51, "IVA que cobras");
cerca(p.comision, 7.99, "comisión de la terminal");
cerca(p.ganancia, 68.92, "ganancia por pieza");
cerca(p.markup, 53.85, "markup sobre costo + comisión");
cerca(p.sinTerminal, 214.15, "sin terminal: 120 / 0.65 x 1.16");
assert.strictEqual(p.redondeado, 229);
// Con $229: sin IVA 197.4138; comisión 0.035 x 229 = 8.015; ganancia 69.3988; margen 35.15%.
cerca(p.gananciaRedondeado, 69.40, "ganancia con precio redondeado");
cerca(p.margenRedondeado, 35.15, "margen con precio redondeado");
// Las partes suman el precio al cliente: costo + comisión + ganancia + IVA.
cerca(p.costo + p.comision + p.ganancia + p.iva, p.precioFinal, "las partes suman el precio", 0.02);
finito(p, "precio de la página");

// Exento: no cobra IVA y el IVA de la comisión sí es costo: 3.5% x 1.16 = 4.06% del cobro.
// Denominador: 1 - 0.35 - 0.0406 = 0.6094 (mismo número que arriba). Precio: 196.915, sin IVA encima.
p = N.precioVenta({ costo: 120, margen: 35, iva: "exento", comision: 3.5 });
cerca(p.comisionEfectivaPct, 4.06, "comisión efectiva exento");
cerca(p.precioFinal, 196.91, "precio exento");
assert.strictEqual(p.iva, 0);
cerca(p.comision, 7.99, "0.0406 x 196.915");
cerca(p.sinTerminal, 184.62, "120 / 0.65");
assert.strictEqual(p.redondeado, 197);
cerca(p.gananciaRedondeado, 69.00, "197 - 120 - 0.0406 x 197");
cerca(p.margenRedondeado, 35.03, "69.0018 / 197");

// Frontera 8% sin terminal: 120 / 0.65 = 184.6154; x 1.08 = 199.3846.
p = N.precioVenta({ costo: 120, margen: 35, iva: "frontera", comision: 0 });
cerca(p.sinIva, 184.62, "sin IVA frontera");
cerca(p.precioFinal, 199.38, "con IVA 8%");
cerca(p.iva, 14.77, "IVA 8%");
assert.strictEqual(p.comision, 0);
assert.strictEqual(p.redondeado, 200);
cerca(p.margenRedondeado, 35.20, "con $200: (185.1852 - 120) / 185.1852");

// Tasa 0%: costo 100, margen 20% -> 125, sin IVA encima. Markup 25%.
p = N.precioVenta({ costo: 100, margen: 20, iva: "cero", comision: 0 });
cerca(p.precioFinal, 125, "tasa 0%");
assert.strictEqual(p.iva, 0);
cerca(p.markup, 25, "markup con 20% de margen");
assert.strictEqual(p.redondeado, 125, "precio exacto no se sube");

// Margen + comisión que se comen todo el precio: no hay precio posible.
// 1 - 0.96 - 0.035 x 1.16 = -0.0006
p = N.precioVenta({ costo: 120, margen: 96, iva: "general", comision: 3.5 });
assert.strictEqual(p.posible, false);
assert.strictEqual(p.precioFinal, 0);
finito(p, "precio imposible");

// Entradas raras: vacías, negativas, texto y enormes.
p = N.precioVenta({ costo: "", margen: "", iva: "otra", comision: -3 });
assert.strictEqual(p.ivaClave, "general", "tasa desconocida usa la general");
assert.strictEqual(p.precioFinal, 0);
assert.strictEqual(p.redondeado, 0);
finito(p, "precio vacío");
p = N.precioVenta({ costo: -50, margen: -10, comision: "abc" });
assert.strictEqual(p.costo, 0);
assert.strictEqual(p.margen, 0);
finito(p, "precio negativo");
p = N.precioVenta({ costo: 1e20, margen: 30, comision: 0 });
assert.strictEqual(p.acotado.costo, true);
cerca(p.sinIva, 1e9 / 0.7, "costo acotado a mil millones", 1);
finito(p, "costo enorme");
p = N.precioVenta({ costo: 1e20, margen: 1e20, comision: 1e20 });
assert.strictEqual(p.acotado.margen, true);
assert.strictEqual(p.acotado.comision, true);
assert.strictEqual(p.posible, false);
finito(p, "todo enorme");
p = N.precioVenta({ costo: Infinity, margen: NaN, comision: Infinity });
assert.strictEqual(p.costo, 0);
finito(p, "Infinity y NaN");

// Precio redondeado cuando el precio con IVA pasa de mil millones: no se debe recortar al revisar el redondeo.
// Costo 1,000,000,000, margen 35%, IVA 16%, comisión 3.5%: sin IVA = 1e9 / 0.6094 = 1,640,958,319.66;
// con IVA = 1,903,511,650.80 -> redondeado 1,903,511,651. Con ese precio: sin IVA 1,640,958,319.83;
// comisión 0.035 x 1,903,511,651 = 66,622,907.79; ganancia 1,640,958,319.83 - 1e9 - 66,622,907.79 = 574,335,412.04 (35%).
p = N.precioVenta({ costo: 1e9, margen: 35, iva: "general", comision: 3.5 });
assert.strictEqual(p.redondeado, 1903511651);
assert.ok(p.gananciaRedondeado > 0, "con el precio redondeado no hay pérdida falsa");
cerca(p.gananciaRedondeado, 574335412.04, "ganancia redondeada con costo de mil millones", 0.05);
cerca(p.margenRedondeado, 35, "margen redondeado con costo de mil millones", 0.01);
// Costo 600,000,000: ganancia 0.35 x 984,574,991.79 = 344,601,247.13; redondeado (1,142,106,991) suma 0.52 al cobro:
// + 0.52 / 1.16 - 0.035 x 0.52 = +0.43 -> 344,601,247.56.
p = N.precioVenta({ costo: 6e8, margen: 35, iva: "general", comision: 3.5 });
cerca(p.gananciaRedondeado, 344601247.56, "ganancia redondeada con costo de 600 millones", 0.05);
cerca(p.margenRedondeado, 35, "margen redondeado con costo de 600 millones", 0.01);
// Costo 1,000,000,000 y margen 99% sin terminal: sin IVA 1e11, con IVA 1.16e11; ganancia 99,000,000,000 (99%).
p = N.precioVenta({ costo: 1e9, margen: 99, iva: "general", comision: 0 });
cerca(p.margenRedondeado, 99, "margen 99% con costo enorme", 0.01);
cerca(p.gananciaRedondeado, 99e9, "ganancia con margen 99%", 1);
finito(p, "redondeo enorme");

// ---------- Revisar un precio que ya tienes ----------
// $116 con IVA 16%: 100 sin IVA, 16 de IVA; costo 60 -> ganancia 40, margen 40%.
let a = N.analizarPrecio({ precioFinal: 116, costo: 60, iva: "general", comision: 0 });
cerca(a.sinIva, 100, "116 / 1.16");
cerca(a.iva, 16, "IVA de 116");
cerca(a.ganancia, 40, "100 - 60");
cerca(a.margen, 40, "40 / 100");
assert.strictEqual(a.pierdes, false);
// Vender abajo del costo: pierdes.
a = N.analizarPrecio({ precioFinal: 100, costo: 120, iva: "general", comision: 3.5 });
assert.strictEqual(a.pierdes, true);
cerca(a.ganancia, 100 / 1.16 - 120 - 3.5, "86.2069 - 120 - 3.5");
a = N.analizarPrecio({ precioFinal: "", costo: "" });
assert.strictEqual(a.margen, 0);
finito(a, "analizar vacío");

// ---------- Punto de equilibrio: valores de la página ----------
// Gastos fijos 5,000 + 10,000 + 1,500 + 1,500 = 18,000. Precio 45, costo variable 20: contribución 25 (55.56%).
// Equilibrio: 18,000 / 25 = 720 piezas = $32,400. En 26 días: 27.69 al día (28).
// Meta de $5,000: 23,000 / 25 = 920 piezas = $41,400. Con 900 ventas: 900 x 25 - 18,000 = $4,500 de ganancia.
// Margen de seguridad: (900 - 720) / 900 = 20%.
let e = N.puntoEquilibrio({ gastosFijos: [5000, 10000, 1500, 1500], precio: 45, costoVariable: 20, dias: 26, gananciaDeseada: 5000, ventasActuales: 900 });
assert.strictEqual(e.alcanzable, true);
cerca(e.gastosFijos, 18000, "gastos fijos");
cerca(e.contribucion, 25, "contribución por pieza");
cerca(e.razonContribucion, 55.56, "25 / 45");
cerca(e.unidades, 720, "piezas de equilibrio");
assert.strictEqual(e.unidadesRedondeadas, 720);
cerca(e.pesos, 32400, "ventas de equilibrio en pesos");
cerca(e.porDia, 27.69, "720 / 26");
assert.strictEqual(e.porDiaRedondeado, 28);
cerca(e.unidadesMeta, 920, "piezas para ganar 5,000");
cerca(e.pesosMeta, 41400, "920 x 45");
cerca(e.resultadoActual, 4500, "ganancia con 900 piezas");
cerca(e.margenSeguridad, 20, "margen de seguridad");
finito(e, "equilibrio de la página");

// Con decimales y pérdida: 10,000 / (50 - 35) = 666.67 -> 667 piezas; $33,333.33. En 30 días: 22.22 (23).
// Meta 3,000: 13,000 / 15 = 866.67 -> 867. Con 500 ventas: 500 x 15 - 10,000 = -2,500. Margen de seguridad -33.33%.
e = N.puntoEquilibrio({ gastosFijos: 10000, precio: 50, costoVariable: 35, dias: 30, gananciaDeseada: 3000, ventasActuales: 500 });
cerca(e.unidades, 666.67, "10,000 / 15");
assert.strictEqual(e.unidadesRedondeadas, 667);
cerca(e.pesos, 33333.33, "666.67 x 50");
cerca(e.porDia, 22.22, "666.67 / 30");
assert.strictEqual(e.porDiaRedondeado, 23);
assert.strictEqual(e.unidadesMetaRedondeadas, 867);
cerca(e.pesosMeta, 43333.33, "866.67 x 50");
cerca(e.resultadoActual, -2500, "pérdida con 500 piezas");
cerca(e.margenSeguridad, -33.33, "(500 - 666.67) / 500");
assert.strictEqual(e.debajoDelEquilibrio, true, "500 piezas está debajo de 666.67");

// Muy por debajo del equilibrio (datos de la página con 10 ventas): (10 - 720) / 10 = -7,100% no se muestra.
// Se marca debajoDelEquilibrio y la cifra se topa en -100. Resultado: 10 x 25 - 18,000 = -17,750.
const pagina = v => N.puntoEquilibrio({ gastosFijos: [5000, 10000, 1500, 1500], precio: 45, costoVariable: 20, dias: 26, gananciaDeseada: 5000, ventasActuales: v });
e = pagina(10);
assert.strictEqual(e.debajoDelEquilibrio, true);
assert.strictEqual(e.margenSeguridad, -100, "margen de seguridad topado en -100");
cerca(e.resultadoActual, -17750, "10 x 25 - 18,000");
e = pagina(1);
assert.strictEqual(e.margenSeguridad, -100);
// Justo en el equilibrio (720): no ganas ni pierdes; no está debajo.
e = pagina(720);
assert.strictEqual(e.debajoDelEquilibrio, false);
assert.strictEqual(e.margenSeguridad, 0);
cerca(e.resultadoActual, 0, "720 x 25 - 18,000");
// 719 piezas: pierdes 25 y estás debajo.
e = pagina(719);
assert.strictEqual(e.debajoDelEquilibrio, true);
cerca(e.resultadoActual, -25, "719 x 25 - 18,000");
e = pagina(900);
assert.strictEqual(e.debajoDelEquilibrio, false);

// Ventas con decimales: se redondean a piezas enteras para que la etiqueta y el cálculo coincidan.
// 900.5 -> 901: 901 x 25 - 18,000 = 4,525; margen (901 - 720) / 901 = 20.09%. 900.4 -> 900: 4,500.
e = pagina(900.5);
assert.strictEqual(e.ventasActuales, 901);
cerca(e.resultadoActual, 4525, "901 x 25 - 18,000");
cerca(e.margenSeguridad, 20.09, "(901 - 720) / 901");
e = pagina(900.4);
assert.strictEqual(e.ventasActuales, 900);
cerca(e.resultadoActual, 4500, "900 x 25 - 18,000");

// Precio menor o igual al costo variable: nunca llegas al equilibrio.
e = N.puntoEquilibrio({ gastosFijos: 18000, precio: 20, costoVariable: 25, dias: 26, ventasActuales: 100 });
assert.strictEqual(e.alcanzable, false);
assert.strictEqual(e.sinPrecio, false);
assert.strictEqual(e.unidades, 0);
cerca(e.resultadoActual, -18500, "100 x (20 - 25) - 18,000");
assert.strictEqual(e.debajoDelEquilibrio, false, "sin equilibrio la fila dice No aplica");
finito(e, "no alcanzable");
e = N.puntoEquilibrio({ gastosFijos: 18000, precio: 25, costoVariable: 25 });
assert.strictEqual(e.alcanzable, false, "contribución de 0");

// Sin gastos fijos: equilibrio en 0 piezas.
e = N.puntoEquilibrio({ gastosFijos: [0, "", -5, "abc"], precio: 10, costoVariable: 5, dias: 0 });
assert.strictEqual(e.alcanzable, true);
assert.strictEqual(e.unidades, 0);
assert.strictEqual(e.porDia, 0);
assert.strictEqual(e.porDiaRedondeado, 0);
finito(e, "sin gastos fijos");

// Todo vacío: sin precio, sin NaN.
e = N.puntoEquilibrio({ gastosFijos: ["", "", "", ""], precio: "", costoVariable: "", dias: "", gananciaDeseada: "", ventasActuales: "" });
assert.strictEqual(e.alcanzable, false);
assert.strictEqual(e.sinPrecio, true);
finito(e, "todo vacío");

// Todo enorme: se acota y no hay Infinity.
e = N.puntoEquilibrio({ gastosFijos: [1e20, 1e20, 1e20, 1e20], precio: 1e20, costoVariable: 0, dias: 1e20, gananciaDeseada: 1e20, ventasActuales: 1e20 });
assert.strictEqual(e.acotado, true);
assert.strictEqual(e.dias, 31);
cerca(e.unidades, 4, "4,000 millones / 1,000 millones");
finito(e, "todo enorme");
e = N.puntoEquilibrio({ gastosFijos: Infinity, precio: Infinity, costoVariable: NaN });
assert.strictEqual(e.sinPrecio, true);
finito(e, "Infinity");

console.log("Pruebas de negocio: todo bien");
