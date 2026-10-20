// Pruebas de la sección Dinero y ahorro: node pruebas/dinero.test.js
// Los valores esperados se calcularon a mano (con calculadora) a partir de las fórmulas de cada página.
const assert = require("assert");
const D = require("../assets/dinero.js");
const cerca = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} != ${b}`);
// Ningún número del resultado puede ser NaN o Infinity (revisa también objetos anidados y tablas).
const finito = (r, msg) => {
  const revisar = (v, ruta) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${ruta} = ${v}`);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => revisar(x, ruta + "." + k));
  };
  revisar(r, "r");
};

// ---------- Datos oficiales ----------
assert.strictEqual(D.DATOS.retencionIsr, 0.009, "retención 2026: 0.90% (LIF 2026; número de artículo por confirmar)");
// Límite exento del art. 93 fr. XX LISR: 5 UMA x 365 = 5 x 117.31 x 365 = 214,090.75.
assert.strictEqual(D.limiteExento(), 214090.75);
assert.strictEqual(D.DATOS.ipabUdis, 400000, "IPAB: 400 mil UDIS");
assert.strictEqual(D.DATOS.iva, 0.16, "IVA general 16%");
cerca(D.DATOS.ipabUdis * D.DATOS.udi.valor, 3544119.20, "IPAB en pesos con la UDI de referencia");

// ---------- Rendimiento y retención ----------
// $100,000 al 7.2% por 360 días: intereses 100,000 x 0.072 x 360/360 = 7,200.
// Retención: 100,000 x 0.009 x 360/365 = 887.67. Neto: 6,312.33.
let r = D.rendimiento({ monto: 100000, tasaAnual: 7.2, dias: 360 });
cerca(r.bruto, 7200, "intereses brutos");
cerca(r.isr, 887.67, "retención 0.90% proporcional a 360 días");
cerca(r.neto, 6312.33, "ganancia neta");
cerca(r.final, 106312.33, "total al final");
// Un año completo (365 días): la retención es exactamente 0.90% del capital.
r = D.rendimiento({ monto: 100000, tasaAnual: 7.2, dias: 365 });
cerca(r.isr, 900, "retención de un año = 900");
// Tasa menor que la retención: la retención no pasa de los intereses (no hay ganancia negativa).
// 100,000 x 0.005 x 365/360 = 506.94 de intereses; la retención sobre capital sería 900.
r = D.rendimiento({ monto: 100000, tasaAnual: 0.5, dias: 365 });
cerca(r.bruto, 506.94, "intereses con 0.5%");
cerca(r.isr, 506.94, "retención limitada a los intereses");
assert.strictEqual(r.neto, 0);
assert.strictEqual(r.retencionTopada, true);

// Inflación: $10,000 con 10% anual por 365 días pierden $1,000.
cerca(D.perdidaInflacion(10000, 10, 365), 1000, "pérdida por inflación de un año");
cerca(D.perdidaInflacion(10000, 0, 365), 0, "sin inflación no hay pérdida");

// Ejemplo de la página CETES vs. banco: $50,000 a 28 días, CETES 6%, banco 4%, inflación 3.5%.
// CETES: 50,000 x 0.06 x 28/360 = 233.33. Banco: 50,000 x 0.04 x 28/360 = 155.56.
// Retención: 50,000 x 0.009 x 28/365 = 34.52. Netos: 198.81 y 121.04 (diferencia 77.78).
// Inflación: 50,000 x (1.035^(28/365) - 1) = 132.12. Después de inflación: +66.69 y -11.09.
let c = D.compararAhorro({ monto: 50000, dias: 28, tasaCetes: 6, tasaBanco: 4, inflacion: 3.5 });
cerca(c.cetes.bruto, 233.33, "CETES brutos");
cerca(c.banco.bruto, 155.56, "banco brutos");
cerca(c.cetes.isr, 34.52, "retención CETES");
cerca(c.banco.isr, 34.52, "retención banco");
cerca(c.cetes.neto, 198.81, "CETES netos");
cerca(c.banco.neto, 121.04, "banco netos");
cerca(c.diferencia, 77.78, "diferencia");
assert.strictEqual(c.mejor, "cetes");
cerca(c.perdidaInflacion, 132.12, "inflación 28 días");
cerca(c.realCetes, 66.69, "CETES después de inflación");
cerca(c.realBanco, -11.09, "banco después de inflación");
assert.strictEqual(c.recortado, false);
assert.strictEqual(c.bajoMinimoCetes, false);
// El banco gana si su tasa es mayor
assert.strictEqual(D.compararAhorro({ monto: 50000, dias: 28, tasaCetes: 6, tasaBanco: 8, inflacion: 3.5 }).mejor, "banco");
assert.strictEqual(D.compararAhorro({ monto: 50000, dias: 28, tasaCetes: 6, tasaBanco: 6, inflacion: 3.5 }).mejor, "igual");
// Menos de $100: aviso del mínimo de cetesdirecto
assert.strictEqual(D.compararAhorro({ monto: 50, dias: 28, tasaCetes: 6, tasaBanco: 4, inflacion: 3.5 }).bajoMinimoCetes, true);

// Cuenta de ahorro, nómina o cheques con saldo menor a 5 UMA al año: intereses exentos, sin retención (art. 93 fr. XX LISR).
// Mismo ejemplo: el banco deja 155.56 completos. Diferencia con CETES: 198.81 - 155.56 = 43.26 (con decimales: 43.257).
// Después de inflación el banco gana 155.56 - 132.12 = 23.43.
c = D.compararAhorro({ monto: 50000, dias: 28, tasaCetes: 6, tasaBanco: 4, inflacion: 3.5, bancoExento: true });
assert.strictEqual(c.bancoExento, true);
assert.strictEqual(c.pasaLimiteExento, false);
assert.strictEqual(c.banco.isr, 0);
cerca(c.banco.neto, 155.56, "banco exento: sin retención");
cerca(c.cetes.isr, 34.52, "a CETES sí le retienen");
cerca(c.diferencia, 43.26, "diferencia con cuenta exenta");
cerca(c.realBanco, 23.43, "banco exento después de inflación");
assert.strictEqual(c.mejor, "cetes");
// Justo en el límite (214,090.75) sigue exento; un peso arriba ya no: 214,091.75 x 0.009 x 28/365 = 147.81.
assert.strictEqual(D.compararAhorro({ monto: 214090.75, dias: 28, tasaCetes: 6, tasaBanco: 4, inflacion: 3.5, bancoExento: true }).banco.isr, 0);
c = D.compararAhorro({ monto: 214091.75, dias: 28, tasaCetes: 6, tasaBanco: 4, inflacion: 3.5, bancoExento: true });
assert.strictEqual(c.bancoExento, false);
assert.strictEqual(c.pasaLimiteExento, true);
cerca(c.banco.isr, 147.81, "arriba del límite se calcula con retención");
// Sin marcar la casilla, todo sigue igual que antes; un texto "true" no cuenta como casilla marcada.
assert.strictEqual(D.compararAhorro({ monto: 50000, dias: 28, tasaCetes: 6, tasaBanco: 4, inflacion: 3.5, bancoExento: "true" }).bancoExento, false);

// Entradas raras: vacío, texto, negativas, infinitas y enormes
for (const malo of ["", "abc", -500, NaN, Infinity, -Infinity, null, undefined]) {
  c = D.compararAhorro({ monto: malo, dias: malo, tasaCetes: malo, tasaBanco: malo, inflacion: malo });
  finito(c, "ahorro con " + malo);
  assert.strictEqual(c.cetes.neto, 0);
}
c = D.compararAhorro({ monto: 1e15, dias: 1e9, tasaCetes: 1e9, tasaBanco: 5, inflacion: 1e9 });
finito(c, "ahorro enorme");
assert.strictEqual(c.recortado, true);
assert.strictEqual(c.cetes.monto, 1e9);
assert.strictEqual(c.cetes.tasa, 1);

// ---------- Meses sin intereses ----------
// Ejemplo de la página: $12,000 de contado o a 12 meses, tu dinero rinde 5% al año, inflación 3.5%.
// Pago: 1,000. i = 0.05/12. Valor de hoy: 1,000 x (1 - (1 + i)^-12) / i = 11,681.22.
// Ahorras hoy 12,000 - 11,681.22 = 318.78; al final te sobran 318.78 x (1 + i)^12 = 335.09.
// Por inflación (mensual = 1.035^(1/12) - 1) los pagos valen hoy 11,779.04.
let m = D.mesesSinIntereses({ precioContado: 12000, precioMeses: 12000, meses: 12, rendimiento: 5, inflacion: 3.5 });
cerca(m.pago, 1000, "mensualidad");
cerca(m.vp, 11681.22, "valor de hoy de las mensualidades");
cerca(m.ventajaHoy, 318.78, "ahorro en pesos de hoy");
cerca(m.alFinal, 335.09, "lo que sobra al final");
cerca(m.intereses, 335.09, "intereses ganados (mismo precio)");
cerca(m.vpInflacion, 11779.04, "pagos en pesos de hoy por inflación");
cerca(m.ahorroInflacion, 220.96, "ahorro por inflación");
assert.strictEqual(m.conviene, "meses");
assert.strictEqual(m.sobreprecio, 0);

// Rendimiento de 12% (1% al mes): 1,000 x (1 - 1.01^-12) / 0.01 = 11,255.08; ahorras 744.92;
// al final 744.92 x 1.01^12 = 839.40.
m = D.mesesSinIntereses({ precioContado: 12000, precioMeses: 12000, meses: 12, rendimiento: 12, inflacion: 0 });
cerca(m.vp, 11255.08, "valor de hoy al 1% mensual");
cerca(m.ventajaHoy, 744.92, "ahorro al 1% mensual");
cerca(m.alFinal, 839.40, "sobrante al 1% mensual");
cerca(m.vpInflacion, 12000, "sin inflación los pagos valen lo mismo");

// Dinero que no rinde y mismo precio: da igual
m = D.mesesSinIntereses({ precioContado: 12000, precioMeses: 12000, meses: 12, rendimiento: 0, inflacion: 0 });
assert.strictEqual(m.conviene, "igual");
cerca(m.ventajaHoy, 0, "sin rendimiento no hay ventaja");
// Descuento de contado grande: conviene contado. 10,000 contra 12,000 a meses al 5%: 10,000 - 11,681.22 = -1,681.22
m = D.mesesSinIntereses({ precioContado: 10000, precioMeses: 12000, meses: 12, rendimiento: 5, inflacion: 3.5 });
assert.strictEqual(m.conviene, "contado");
cerca(m.ventajaHoy, -1681.22, "contado ahorra 1,681.22 en pesos de hoy");
cerca(m.sobreprecio, 2000, "a meses cuesta 2,000 más");
// Caso del descuento de la página: $10,800 de contado contra $12,000 a 12 meses: 10,800 - 11,681.22 = -881.22.
m = D.mesesSinIntereses({ precioContado: 10800, precioMeses: 12000, meses: 12, rendimiento: 5, inflacion: 3.5 });
assert.strictEqual(m.conviene, "contado");
cerca(m.ventajaHoy, -881.22, "con 10% de descuento conviene contado por 881.22");
// Sin meses: no truena
m = D.mesesSinIntereses({ precioContado: 12000, precioMeses: 12000, meses: 0, rendimiento: 5, inflacion: 3.5 });
assert.strictEqual(m.sinMeses, true);
assert.strictEqual(m.pago, 0);
assert.strictEqual(m.conviene, "faltan");
finito(m, "meses = 0");
// Falta un precio: no hay veredicto ni cifra de ahorro (antes decía "ahorras $12,000" o "$11,681.22").
for (const [pc, pm] of [[12000, ""], ["", 12000], [0, 12000], [12000, 0], [-5, 12000]]) {
  m = D.mesesSinIntereses({ precioContado: pc, precioMeses: pm, meses: 12, rendimiento: 5, inflacion: 3.5 });
  assert.strictEqual(m.faltanPrecios, true, `faltan precios con ${pc} y ${pm}`);
  assert.strictEqual(m.conviene, "faltan");
  assert.strictEqual(m.ventajaHoy, 0);
  assert.strictEqual(m.alFinal, 0);
  assert.strictEqual(m.sobreprecio, 0);
  finito(m, "msi sin un precio");
}
for (const malo of ["", "abc", -12, NaN, Infinity, null, undefined]) {
  finito(D.mesesSinIntereses({ precioContado: malo, precioMeses: malo, meses: malo, rendimiento: malo, inflacion: malo }), "msi con " + malo);
}
m = D.mesesSinIntereses({ precioContado: 1e15, precioMeses: 1e15, meses: 1e6, rendimiento: 1e6, inflacion: 1e6 });
finito(m, "msi enorme");
assert.strictEqual(m.recortado, true);
assert.strictEqual(m.meses, 480);

// ---------- Préstamo ----------
// $10,000 al 12% anual (1% al mes), 12 meses, sin IVA: pago = 100 / (1 - 1.01^-12) = 888.49.
// Intereses: 888.49 x 12 - 10,000 = 661.85. CAT = 1.01^12 - 1 = 12.68%.
let p = D.prestamo({ monto: 10000, tasaAnual: 12, meses: 12, conIva: false });
cerca(p.pago, 888.49, "pago sin IVA");
cerca(p.totalIntereses, 661.85, "intereses sin IVA");
cerca(p.totalIva, 0, "sin IVA");
cerca(p.cat, 0.126825, "CAT sin comisión = (1 + tasa/12)^12 - 1", 1e-5);
assert.strictEqual(p.tabla.length, 12);
cerca(p.tabla[0].interes, 100, "interés del primer mes");
cerca(p.tabla[0].capital, 788.49, "capital del primer mes");
cerca(p.tabla[11].saldo, 0, "saldo final");
cerca(p.tabla.reduce((s, f) => s + f.capital, 0), 10000, "la suma del capital es el préstamo");

// Con IVA: j = 0.01 x 1.16 = 0.0116; 1.0116^12 = 1.148434, así que pago = 116 / (1 - 1 / 1.148434) = 897.49.
// Primer mes: interés 100, IVA 16, capital 897.49 - 116 = 781.49.
p = D.prestamo({ monto: 10000, tasaAnual: 12, meses: 12, conIva: true });
cerca(p.pago, 897.49, "pago con IVA");
cerca(p.tabla[0].iva, 16, "IVA del primer mes");
cerca(p.tabla[0].capital, 781.49, "capital del primer mes con IVA");
cerca(p.totalIva, p.totalIntereses * 0.16, "IVA = 16% de los intereses");
cerca(p.totalPagado, 10000 + p.totalIntereses + p.totalIva, "total = préstamo + intereses + IVA");
cerca(p.totalPagado, p.pago * 12, "12 pagos iguales");
cerca(p.cat, 0.126825, "el CAT no incluye IVA", 1e-5);

// Ejemplo de la página: $50,000 al 30% anual, 24 meses, con IVA.
// i = 2.5%, j = 2.9%: pago = 50,000 x 0.029 / (1 - 1.029^-24) = 2,920.66.
// Primer mes: interés 1,250, IVA 200, capital 1,470.66. CAT = 1.025^12 - 1 = 34.49%.
p = D.prestamo({ monto: 50000, tasaAnual: 30, meses: 24, conIva: true, comision: 0 });
cerca(p.pago, 2920.66, "pago del ejemplo");
cerca(p.tabla[0].interes, 1250, "interés mes 1");
cerca(p.tabla[0].iva, 200, "IVA mes 1");
cerca(p.tabla[0].capital, 1470.66, "capital mes 1");
cerca(p.totalIntereses, 17323.96, "intereses del ejemplo");
cerca(p.totalIva, 2771.83, "IVA del ejemplo");
cerca(p.totalPagado, 70095.80, "total del ejemplo");
cerca(p.cat, 0.344889, "CAT del ejemplo", 1e-5);
assert.strictEqual(D.porcentaje(p.cat), "34.49%");
cerca(p.tasaConIva, 0.348, "tasa con IVA");
// Con 2% de comisión por apertura: 1,000 de comisión más 160 de IVA, recibes 50,000 - 1,160 = 48,840.
// El CAT se calcula sin IVA (contra 49,000) y sube a 37.38%.
p = D.prestamo({ monto: 50000, tasaAnual: 30, meses: 24, conIva: true, comision: 2 });
cerca(p.recibes, 48840, "recibes con comisión y su IVA");
cerca(p.comisionMonto, 1000, "comisión");
cerca(p.ivaComision, 160, "IVA de la comisión");
assert.strictEqual(D.porcentaje(p.cat), "37.38%");
cerca(p.costoTotal, 17323.96 + 2771.83 + 1000 + 160, "costo total con comisión y su IVA");
// La comisión paga IVA aunque los intereses no (crédito hipotecario): recibes 48,840 igual.
cerca(D.prestamo({ monto: 50000, tasaAnual: 30, meses: 24, conIva: false, comision: 2 }).recibes, 48840, "IVA de comisión sin IVA en intereses");

// Mismo ejemplo a 48 meses (pregunta frecuente): pago = 50,000 x 0.029 / (1 - 1.029^-48) = 1,942.53;
// intereses con IVA = 1,942.53 x 48 - 50,000 = 43,241.23 (a 24 meses eran 20,095.80).
p = D.prestamo({ monto: 50000, tasaAnual: 30, meses: 48, conIva: true });
cerca(p.pago, 1942.53, "pago a 48 meses");
cerca(p.totalIntereses + p.totalIva, 43241.23, "intereses con IVA a 48 meses");
// Tasa 0: pago = monto / n y CAT 0. Con comisión de 5%, el CAT ya no es 0 (recibes 9,500 y pagas 10,000):
// 9,500 = 833.33 x (1 - (1 + r)^-12) / r da r = 0.80% al mes (con r = 0.8% el factor es 11.399, casi 11.4), CAT de unos 10%.
p = D.prestamo({ monto: 10000, tasaAnual: 0, meses: 12 });
cerca(p.pago, 833.33, "tasa 0");
assert.strictEqual(p.cat, 0);
p = D.prestamo({ monto: 10000, tasaAnual: 0, meses: 12, comision: 5 });
assert.ok(p.cat > 0.099 && p.cat < 0.101, "CAT con comisión y tasa 0: " + p.cat);

// TIR: un pago de 110 por 100 recibidos = 10%
cerca(D.tirMensual([110], 100), 0.10, "TIR simple", 1e-9);

// Entradas raras
p = D.prestamo({ monto: -5, tasaAnual: 30, meses: 24 });
assert.strictEqual(p.sinMonto, true);
assert.strictEqual(p.pago, 0);
finito(p, "monto negativo");
p = D.prestamo({ monto: 50000, tasaAnual: 30, meses: 0 });
assert.strictEqual(p.sinMeses, true);
finito(p, "sin meses");
for (const malo of ["", "abc", -1, NaN, Infinity, null, undefined]) {
  finito(D.prestamo({ monto: malo, tasaAnual: malo, meses: malo, comision: malo }), "préstamo con " + malo);
}
p = D.prestamo({ monto: 1e15, tasaAnual: 1e6, meses: 1e6, comision: 1e6 });
finito(p, "préstamo enorme");
assert.strictEqual(p.recortado, true);
assert.strictEqual(p.meses, 480);
assert.strictEqual(p.tabla.length, 480);
assert.ok(p.cat > 0);
cerca(p.tabla[479].saldo, 0, "liquida aun con tasa enorme");

// Estabilidad con tasa alta y plazo largo: con pago fijo, el total debe ser pago x meses (tolerancia de centavos),
// ningún renglón negativo, cada pago igual al pago fijo y el capital debe sumar el préstamo.
// Antes, con 1,000,000 al 1000% a 480 meses salía un total de 9.6e130; con 50,000 al 90% a 480 meses el último pago
// salía en 54,350 en lugar de 4,350.
const sano = (p, msg) => {
  finito(p, msg);
  cerca(p.totalPagado, p.pago * p.meses, msg + ": total = pago x meses");
  cerca(p.tabla.reduce((s, f) => s + f.capital, 0), p.monto, msg + ": el capital suma el préstamo", Math.max(0.01, p.monto * 1e-12));
  for (const f of p.tabla) {
    assert.ok(f.pago >= 0 && f.capital >= 0 && f.interes >= 0 && f.iva >= 0 && f.saldo >= 0, `${msg}: renglón ${f.mes} negativo`);
    assert.ok(f.saldo <= p.monto + 0.01, `${msg}: saldo del mes ${f.mes} mayor que el préstamo`);
    cerca(f.pago, p.pago, `${msg}: pago del mes ${f.mes}`);
  }
  assert.strictEqual(p.tabla[p.meses - 1].saldo, 0, msg + ": termina en 0");
};
for (const [monto, tasa, meses] of [[1e9, 1000, 480], [1e6, 1000, 480], [50000, 90, 480], [50000, 120, 360],
  [50000, 300, 120], [50000, 30, 24], [10000, 0, 12], [10000, 1e-10, 12], [1, 1000, 1], [1e9, 0.01, 480]]) {
  for (const conIva of [true, false]) sano(D.prestamo({ monto, tasaAnual: tasa, meses, conIva }), `${monto} al ${tasa}% a ${meses} meses iva=${conIva}`);
}
// $50,000 al 90% a 480 meses con IVA: i = 7.5%, j = 8.7%; 1.087^-480 es casi 0, así que pago = 50,000 x 0.087 = 4,350.
p = D.prestamo({ monto: 50000, tasaAnual: 90, meses: 480, conIva: true });
cerca(p.pago, 4350, "pago al 90% a 480 meses");
cerca(p.tabla[479].pago, 4350, "el último pago también es 4,350");
cerca(p.totalPagado, 4350 * 480, "total al 90% a 480 meses");
// 1,000% anual sin la deformación: CAT = (1 + 10/12)^12 - 1 = 1,440.77 (144,077%).
p = D.prestamo({ monto: 1e6, tasaAnual: 1000, meses: 480, conIva: true });
cerca(p.cat, Math.pow(1 + 10 / 12, 12) - 1, "CAT al 1000%", 1e-6);

// Porcentajes
assert.strictEqual(D.porcentaje(0.009), "0.90%");
assert.strictEqual(D.porcentaje(NaN), "0.00%");

console.log("Todas las pruebas de dinero pasaron");
