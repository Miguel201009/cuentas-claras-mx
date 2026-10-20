// Pruebas de la sección Casa y servicios: node pruebas/casa.test.js
// Los valores esperados se calcularon a mano (con calculadora) a partir de las fórmulas de cada página.
const assert = require("assert");
const K = require("../assets/casa.js");
const cerca = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} != ${b}`);
// Ningún número del resultado puede ser NaN o Infinity (revisa también objetos anidados y listas).
const finito = (r, msg) => {
  const revisar = (v, ruta) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${ruta} = ${v}`);
    else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => revisar(x, ruta + "." + k));
  };
  revisar(r, "r");
};
let n = 0;
const prueba = (nombre, fn) => { fn(); n++; };

// ---------- Datos de referencia ----------
prueba("tarifas y límites DAC", () => {
  const T = K.DATOS.tarifas;
  assert.deepStrictEqual(Object.keys(T), ["1", "1A", "1B", "1C", "1D", "1E", "1F"]);
  assert.deepStrictEqual(Object.values(T).map(t => t.dac), [250, 300, 400, 850, 1000, 2000, 2500], "límites de alto consumo");
  assert.deepStrictEqual(Object.values(T).map(t => t.clima), [null, 25, 28, 30, 31, 32, 33], "temperatura media mínima en verano");
  const hasta = b => b.map(x => x.hasta);
  assert.deepStrictEqual(hasta(T["1"].todoElAnio), [75, 140, Infinity]);
  assert.deepStrictEqual(hasta(T["1A"].verano), [100, 150, Infinity]);
  assert.deepStrictEqual(hasta(T["1A"].fuera), [75, 150, Infinity]);
  assert.deepStrictEqual(hasta(T["1B"].verano), [125, 225, Infinity]);
  assert.deepStrictEqual(hasta(T["1B"].fuera), [75, 175, Infinity]);
  assert.deepStrictEqual(hasta(T["1C"].verano), [150, 300, 450, Infinity]);
  assert.deepStrictEqual(hasta(T["1D"].verano), [175, 400, 600, Infinity]);
  assert.deepStrictEqual(hasta(T["1E"].verano), [300, 750, 900, Infinity]);
  assert.deepStrictEqual(hasta(T["1F"].verano), [300, 1200, 2500, Infinity]);
  ["1C", "1D", "1E", "1F"].forEach(t => assert.strictEqual(T[t].fuera.length, 3));
  assert.deepStrictEqual(hasta(T["1D"].fuera), [75, 200, Infinity]);
  assert.strictEqual(K.DATOS.iva, 0.16, "IVA 16%");
  assert.strictEqual(K.DATOS.ivaFrontera, 0.08, "IVA de 8% con el estímulo de la región fronteriza");
  assert.strictEqual(K.DATOS.gas.densidad, 0.54, "densidad de referencia del gas LP");
});

// ---------- Recibo de luz ----------
const ejemplo = K.DATOS.preciosEjemplo; // 1.10, 1.35, 1.70, 3.90

prueba("ejemplo de la página: tarifa 1, bimestral, 300 kWh", () => {
  // Rangos bimestrales: básico 1-150, intermedio 151-280, excedente desde 281.
  // 150 × 1.10 = 165.00; 130 × 1.35 = 175.50; 20 × 3.90 = 78.00. Energía 418.50; IVA 66.96; total 485.46.
  const r = K.reciboLuz({ tarifa: "1", meses: 2, kwh: 300, precios: ejemplo });
  assert.deepStrictEqual(r.filas.map(f => f.kwh), [150, 130, 20]);
  assert.deepStrictEqual(r.filas.map(f => f.subtotal), [165, 175.5, 78]);
  assert.deepStrictEqual(r.filas.map(f => f.desde), [1, 151, 281]);
  assert.deepStrictEqual(r.filas.map(f => f.hasta), [150, 280, null]);
  cerca(r.energia, 418.50, "energía");
  cerca(r.iva, 66.96, "IVA");
  cerca(r.total, 485.46, "total");
  cerca(r.precioPromedio, 1.6182, "precio promedio", 0.0001);
  cerca(r.promedioMensual, 150, "promedio mensual");
  assert.strictEqual(r.limiteDac, 250);
  cerca(r.margenDac, 100, "margen DAC");
  assert.strictEqual(r.estadoDac, "dentro");
  assert.strictEqual(r.conTemporada, false);
  assert.strictEqual(r.temporada, "todo");
  finito(r, "ejemplo");
});

prueba("IVA de 8% (región fronteriza) y tasas no válidas", () => {
  // Mismo ejemplo: energía 418.50. IVA 8%: 418.50 × 0.08 = 33.48. Total 451.98.
  let r = K.reciboLuz({ tarifa: "1", meses: 2, kwh: 300, precios: ejemplo, tasaIva: 0.08 });
  assert.strictEqual(r.tasaIva, 0.08);
  cerca(r.energia, 418.50, "energía igual");
  cerca(r.iva, 33.48, "IVA 8%");
  cerca(r.total, 451.98, "total con IVA 8%");
  cerca(r.precioPromedio, 1.5066, "precio promedio con IVA 8%", 0.0001);
  // El valor del selector llega como texto.
  r = K.reciboLuz({ tarifa: "1", meses: 2, kwh: 300, precios: ejemplo, tasaIva: "0.08" });
  cerca(r.total, 451.98, "tasa como texto");
  // Sin tasa, o con una tasa que no existe, se usa 16%.
  for (const t of [undefined, "", 0, 0.5, -1, "abc", 8, 1e9]) {
    r = K.reciboLuz({ tarifa: "1", meses: 2, kwh: 300, precios: ejemplo, tasaIva: t });
    assert.strictEqual(r.tasaIva, 0.16, `tasa=${t}`);
    cerca(r.total, 485.46, `tasa=${t} usa 16%`);
    finito(r, `tasa=${t}`);
  }
  r = K.reciboLuz({ tarifa: "1", meses: 2, kwh: 300, precios: ejemplo, tasaIva: "0.16" });
  cerca(r.total, 485.46, "16% como texto");
});

prueba("tarifa 1 mensual, 100 kWh", () => {
  // 75 × 1.10 = 82.50; 25 × 1.35 = 33.75; energía 116.25; IVA 18.60; total 134.85.
  const r = K.reciboLuz({ tarifa: "1", meses: 1, kwh: 100, precios: ejemplo });
  assert.deepStrictEqual(r.filas.map(f => f.kwh), [75, 25, 0]);
  cerca(r.energia, 116.25, "energía");
  cerca(r.iva, 18.60, "IVA");
  cerca(r.total, 134.85, "total");
});

prueba("tarifa 1C en verano, mensual, 500 kWh con 4 bloques", () => {
  // Básico 150 × 1 = 150; intermedio bajo 150 × 2 = 300; intermedio alto 150 × 3 = 450; excedente 50 × 4 = 200.
  const r = K.reciboLuz({ tarifa: "1C", temporada: "verano", meses: 1, kwh: 500, precios: { basico: 1, intermedio: 2, intermedioAlto: 3, excedente: 4 } });
  assert.deepStrictEqual(r.filas.map(f => f.clave), ["basico", "intermedio", "intermedioAlto", "excedente"]);
  assert.deepStrictEqual(r.filas.map(f => f.kwh), [150, 150, 150, 50]);
  cerca(r.energia, 1100, "energía");
  cerca(r.iva, 176, "IVA");
  cerca(r.total, 1276, "total");
  assert.strictEqual(r.estadoDac, "dentro", "500 está debajo de 80% de 850 (680)");
});

prueba("tarifa 1C fuera de verano, bimestral, 400 kWh", () => {
  // Rangos bimestrales: básico 1-150, intermedio 151-350, excedente desde 351. 150 × 1 + 200 × 2 + 50 × 4 = 750.
  const r = K.reciboLuz({ tarifa: "1C", temporada: "fuera", meses: 2, kwh: 400, precios: { basico: 1, intermedio: 2, intermedioAlto: 3, excedente: 4 } });
  assert.deepStrictEqual(r.filas.map(f => f.kwh), [150, 200, 50]);
  cerca(r.energia, 750, "energía");
  assert.strictEqual(r.temporada, "fuera");
});

prueba("tarifa 1F en verano, bimestral, 6,000 kWh", () => {
  // Rangos bimestrales: 600, 2,400, 5,000. Bloques: 600, 1,800, 2,600 y 1,000 de excedente.
  const r = K.reciboLuz({ tarifa: "1F", temporada: "verano", meses: 2, kwh: 6000, precios: { basico: 1, intermedio: 1, intermedioAlto: 1, excedente: 1 } });
  assert.deepStrictEqual(r.filas.map(f => f.kwh), [600, 1800, 2600, 1000]);
  cerca(r.energia, 6000, "energía con precio 1");
  // Promedio 3,000 al mes contra límite de 2,500: pasa.
  assert.strictEqual(r.estadoDac, "pasa");
  cerca(r.margenDac, -500, "margen negativo");
});

prueba("revisión de la DAC", () => {
  // Con el consumo del año: 3,600 kWh ÷ 12 = 300 al mes, arriba de 250.
  let r = K.reciboLuz({ tarifa: "1", kwh: 300, precios: ejemplo, kwhAnual: 3600 });
  assert.strictEqual(r.usaAnual, true);
  cerca(r.promedioMensual, 300, "promedio anual");
  assert.strictEqual(r.estadoDac, "pasa");
  // Bimestral de 420 kWh: 210 al mes, entre 80% (200) y el límite (250): cerca.
  r = K.reciboLuz({ tarifa: "1", meses: 2, kwh: 420, precios: ejemplo });
  assert.strictEqual(r.estadoDac, "cerca");
  // Justo en el límite (250 al mes) todavía no es DAC: la tarifa se aplica cuando el promedio es MAYOR al límite.
  r = K.reciboLuz({ tarifa: "1", meses: 1, kwh: 250, precios: ejemplo });
  assert.strictEqual(r.estadoDac, "cerca");
  r = K.reciboLuz({ tarifa: "1", meses: 1, kwh: 251, precios: ejemplo });
  assert.strictEqual(r.estadoDac, "pasa");
  // Límite de la 1B: 400.
  r = K.reciboLuz({ tarifa: "1B", meses: 1, kwh: 100, precios: ejemplo });
  assert.strictEqual(r.limiteDac, 400);
});

prueba("recibo con entradas vacías, negativas, texto y enormes", () => {
  for (const kwh of ["", -5, "abc", null, undefined, 0]) {
    const r = K.reciboLuz({ tarifa: "1", kwh, precios: ejemplo });
    assert.strictEqual(r.total, 0, `kwh=${kwh}`);
    assert.strictEqual(r.sinKwh, true);
    finito(r, `kwh=${kwh}`);
  }
  let r = K.reciboLuz({ tarifa: "1", kwh: 1e12, precios: ejemplo, kwhAnual: 1e15 });
  assert.strictEqual(r.recortado, true);
  assert.strictEqual(r.kwh, 100000);
  finito(r, "enorme");
  r = K.reciboLuz({ tarifa: "1", kwh: "Infinity", precios: { basico: "Infinity", intermedio: -3, excedente: "" } });
  assert.strictEqual(r.recortado, true);
  assert.strictEqual(r.sinPrecio, true, "hay kWh en bloques sin precio");
  finito(r, "infinito");
  // Tarifa desconocida usa la 1; mes raro usa bimestral.
  r = K.reciboLuz({ tarifa: "9", meses: "x", kwh: 300, precios: ejemplo });
  assert.strictEqual(r.tarifa, "1");
  assert.strictEqual(r.meses, 2);
  cerca(r.total, 485.46, "tarifa desconocida = tarifa 1");
  // Sin argumentos no truena.
  finito(K.reciboLuz(), "sin argumentos");
});

// ---------- Consumo de aparatos ----------
prueba("un aparato", () => {
  // 1 × 1,000 W × 1 h × 30 días ÷ 1,000 = 30 kWh.
  cerca(K.consumoAparato({ cantidad: 1, watts: 1000, horas: 1, dias: 30 }).kwhMes, 30, "plancha diaria");
  // Minisplit de 1,100 W, 8 h, 30 días: 264 kWh.
  cerca(K.consumoAparato({ cantidad: 1, watts: 1100, horas: 8, dias: 30 }).kwhMes, 264, "minisplit");
  // 6 focos de 9 W, 5 h, 30 días: 8.1 kWh.
  cerca(K.consumoAparato({ cantidad: 6, watts: 9, horas: 5, dias: 30 }).kwhMes, 8.1, "focos");
});

prueba("ejemplo de la página: lista de aparatos", () => {
  // 8.1 + 36 + 12 + 14.4 + 0 + 6 + 8 + 9 + 7.2 + 7.2 + 1.2 + 7.5 + 1.2 + 0 = 117.8 kWh al mes.
  // Costo con $1.60 por kWh: 117.8 × 1.60 = $188.48. Bimestre: 235.6 kWh y $376.96.
  const r = K.consumoAparatos(K.DATOS.aparatos, K.DATOS.precioKwhEjemplo);
  cerca(r.kwhMes, 117.8, "kWh al mes");
  cerca(r.costoMes, 188.48, "costo al mes");
  cerca(r.kwhBimestre, 235.6, "kWh bimestre");
  cerca(r.costoBimestre, 376.96, "costo bimestre");
  assert.strictEqual(r.mayor.id, "refri");
  cerca(r.mayor.kwhMes, 36, "refrigerador");
  cerca(r.mayor.porcentaje, 30.56, "porcentaje del refrigerador");
  cerca(r.aparatos.find(a => a.id === "refri").costoMes, 57.6, "costo del refrigerador");
  finito(r, "lista");
});

prueba("aparatos con entradas raras", () => {
  let r = K.consumoAparatos([{ nombre: "X", cantidad: 1, watts: 100, horas: 30, dias: 40 }], 2);
  assert.strictEqual(r.recortado, true);
  cerca(r.kwhMes, 100 * 24 * 31 / 1000, "horas y días recortados");
  r = K.consumoAparatos([{ cantidad: -2, watts: "abc", horas: "", dias: null }], -1);
  assert.strictEqual(r.kwhMes, 0);
  assert.strictEqual(r.costoMes, 0);
  assert.strictEqual(r.mayor, null);
  assert.strictEqual(r.sinPrecio, true);
  r = K.consumoAparatos([], 1.6);
  assert.strictEqual(r.kwhMes, 0);
  assert.strictEqual(r.mayor, null);
  r = K.consumoAparatos(undefined, "1e400");
  assert.strictEqual(r.precio, 50);
  assert.strictEqual(r.recortado, true);
  r = K.consumoAparatos([{ cantidad: 1e9, watts: 1e9, horas: 1e9, dias: 1e9 }], 1e9);
  finito(r, "enormes");
  cerca(r.kwhMes, 100 * 20000 * 24 * 31 / 1000, "todo al máximo");
});

// ---------- Gas LP ----------
prueba("conversión kilos y litros", () => {
  cerca(K.kilosALitros(30, 0.54), 55.5556, "30 kg en litros", 0.001);
  cerca(K.litrosAKilos(100, 0.54), 54, "100 litros en kilos");
  assert.strictEqual(K.kilosALitros(10, 0), 0);
});

prueba("ejemplo de la página: cilindro de 30 kg", () => {
  // Uso: 1.5 h × 0.2 kg + 30 min × 0.025 kg = 0.30 + 0.75 = 1.05 kg al día.
  // Compra: 30 × $20 = $600. Dura 30 ÷ 1.05 = 28.57 días. Al día: 1.05 × 20 = $21; al mes (30 días): $630.
  // Precio por litro: 20 × 0.54 = $10.80. Litros: 30 ÷ 0.54 = 55.56.
  const r = K.gasLP({ tipo: "cilindro", cilindroKg: 30, precio: 20, unidad: "kilo", densidad: 0.54,
    modo: "uso", horasEstufa: 1.5, kgHoraEstufa: 0.2, minutosRegadera: 30, kgMinutoCalentador: 0.025 });
  cerca(r.costo, 600, "costo del cilindro");
  cerca(r.kgDia, 1.05, "kg al día");
  cerca(r.dias, 28.571, "días que dura", 0.001);
  cerca(r.gastoDia, 21, "gasto al día");
  cerca(r.gastoMes, 630, "gasto al mes");
  cerca(r.precioLitro, 10.80, "precio por litro");
  cerca(r.litros, 55.556, "litros", 0.001);
  finito(r, "cilindro");
});

prueba("precio por litro y tanque estacionario", () => {
  // $10.80 por litro con densidad 0.54 = $20 por kilo.
  let r = K.gasLP({ tipo: "cilindro", cilindroKg: 20, precio: 10.80, unidad: "litro", densidad: 0.54, modo: "dias", diasDura: 20 });
  cerca(r.precioKilo, 20, "precio por kilo");
  cerca(r.costo, 400, "20 kg × $20");
  cerca(r.kgDia, 1, "20 kg en 20 días");
  cerca(r.gastoMes, 600, "1 kg × $20 × 30");
  // Tanque de 300 L del 10% al 85%: 225 litros, 121.5 kg, 225 × $10.80 = $2,430.
  r = K.gasLP({ tipo: "tanque", capacidad: 300, actual: 10, llenado: 85, precio: 10.80, unidad: "litro", densidad: 0.54, modo: "dias", diasDura: 90 });
  cerca(r.litros, 225, "litros a cargar");
  cerca(r.kilos, 121.5, "kilos a cargar");
  cerca(r.costo, 2430, "costo de la carga");
  cerca(r.kgDia, 1.35, "121.5 kg en 90 días");
  cerca(r.dias, 90, "días");
  // Mismo tanque pagando por kilo a $20: 121.5 × 20 = $2,430 (mismo resultado).
  r = K.gasLP({ tipo: "tanque", capacidad: 300, actual: 10, llenado: 85, precio: 20, unidad: "kilo", densidad: 0.54 });
  cerca(r.costo, 2430, "por kilo");
});

prueba("gas con entradas raras", () => {
  // Densidad vacía: usa 0.54. Densidad absurda: se recorta a 0.7.
  let r = K.gasLP({ cilindroKg: 30, precio: 20, densidad: "" });
  assert.strictEqual(r.densidad, 0.54);
  assert.strictEqual(r.densidadPorOmision, true);
  r = K.gasLP({ cilindroKg: 30, precio: 20, densidad: 2 });
  assert.strictEqual(r.densidad, 0.7);
  assert.strictEqual(r.recortado, true);
  // Tanque ya lleno: no hay nada que cargar.
  r = K.gasLP({ tipo: "tanque", capacidad: 300, actual: 90, llenado: 85, precio: 20 });
  assert.strictEqual(r.litros, 0);
  assert.strictEqual(r.costo, 0);
  assert.strictEqual(r.tanqueLleno, true);
  // Sin uso: no se puede saber cuánto dura.
  r = K.gasLP({ cilindroKg: 30, precio: 20, horasEstufa: 0, minutosRegadera: 0 });
  assert.strictEqual(r.dias, 0);
  assert.strictEqual(r.sinUso, true);
  // Vacíos, negativos, texto y enormes.
  for (const v of ["", -10, "abc", null, 1e300, "Infinity"]) {
    r = K.gasLP({ tipo: "tanque", capacidad: v, actual: v, llenado: v, precio: v, densidad: v, horasEstufa: v, kgHoraEstufa: v, minutosRegadera: v, kgMinutoCalentador: v });
    finito(r, `tanque v=${v}`);
    r = K.gasLP({ tipo: "cilindro", cilindroKg: v, precio: v, unidad: "litro", densidad: v, modo: "dias", diasDura: v });
    finito(r, `cilindro v=${v}`);
  }
  finito(K.gasLP(), "sin argumentos");
  // Precio en 0: costo 0 y aviso.
  r = K.gasLP({ cilindroKg: 30, precio: 0, horasEstufa: 1, kgHoraEstufa: 0.2 });
  assert.strictEqual(r.sinPrecio, true);
  assert.strictEqual(r.costo, 0);
});

console.log(`casa.test.js: ${n} grupos de pruebas pasaron.`);
