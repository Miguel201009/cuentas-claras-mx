// Pruebas de la sección Auto: node pruebas/auto.test.js
// Los valores esperados se calcularon a mano (con calculadora) a partir de las fórmulas de cada página.
const assert = require("assert");
const A = require("../assets/auto.js");
const C = require("../assets/calc.js");
const cerca = (a, b, msg, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${msg}: ${a} != ${b}`);
// Ningún número del resultado puede ser NaN o Infinity (revisa también objetos anidados y listas).
const finito = (r, msg) => {
  const revisar = (v, ruta) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${ruta} = ${v}`);
    else if (v && typeof v === "object" && !(v instanceof Date)) Object.entries(v).forEach(([k, x]) => revisar(x, ruta + "." + k));
  };
  revisar(r, "r");
};
let pruebas = 0;
const prueba = (nombre, fn) => { fn(); pruebas++; };

// ---------- Gasolina por viaje ----------
prueba("ejemplo de la página", () => {
  // 210 km de ida, 14 km/l, $24 por litro, ida y vuelta, 3 personas, sin casetas.
  // 420 km ÷ 14 = 30 litros; 30 × 24 = $720; 720 ÷ 3 = $240 por persona; gasolina por km: 24 ÷ 14 = $1.71.
  // Sin casetas, el costo total por km es el mismo: 720 ÷ 420 = $1.71.
  const r = A.gasolinaViaje({ km: 210, rendimiento: 14, precio: 24, idaYVuelta: true, personas: 3, casetas: 0 });
  assert.strictEqual(r.kmTotal, 420);
  cerca(r.litros, 30, "litros");
  cerca(r.costoGasolina, 720, "gasolina");
  cerca(r.total, 720, "total");
  cerca(r.porPersona, 240, "por persona");
  cerca(r.porKm, 1.71, "gasolina por km");
  cerca(r.porKmTotal, 1.71, "costo total por km");
  assert.strictEqual(r.sinDatos, false);
  assert.strictEqual(r.recortado, false);
  assert.strictEqual(A.DATOS.gasolina.precioEjemplo, 24, "el precio de ejemplo coincide con la página");
});

prueba("solo ida", () => {
  // 100 km ÷ 12.5 km/l = 8 litros; 8 × 25 = $200; 25 ÷ 12.5 = $2 por km.
  const r = A.gasolinaViaje({ km: 100, rendimiento: 12.5, precio: 25, idaYVuelta: false, personas: 1 });
  assert.strictEqual(r.kmTotal, 100);
  cerca(r.litros, 8, "litros");
  cerca(r.total, 200, "total");
  cerca(r.porPersona, 200, "una persona paga todo");
  cerca(r.porKm, 2, "por km");
});

prueba("costo por km con casetas (caso del revisor)", () => {
  // 350 km de ida y vuelta = 700 km; 700 ÷ 12 = 58.333 litros; × $23.50 = $1,370.83; + $800 = $2,170.83.
  // Gasolina por km: 23.50 ÷ 12 = $1.96. Costo total por km: 2,170.83 ÷ 700 = $3.10.
  const r = A.gasolinaViaje({ km: 350, rendimiento: 12, precio: 23.5, idaYVuelta: true, personas: 1, casetas: 800 });
  assert.strictEqual(r.kmTotal, 700);
  cerca(r.costoGasolina, 1370.83, "gasolina");
  cerca(r.total, 2170.83, "total");
  cerca(r.porKm, 1.96, "gasolina por km");
  cerca(r.porKmTotal, 3.10, "costo total por km");
});

prueba("con casetas", () => {
  // 300 km de ida y vuelta = 600 km; 600 ÷ 15 = 40 litros; 40 × 24.50 = $980; + $600 de casetas = $1,580;
  // entre 4 = $395. Las casetas no se duplican: son el total del viaje.
  const r = A.gasolinaViaje({ km: 300, rendimiento: 15, precio: 24.5, idaYVuelta: true, personas: 4, casetas: 600 });
  cerca(r.litros, 40, "litros");
  cerca(r.costoGasolina, 980, "gasolina");
  cerca(r.total, 1580, "total");
  cerca(r.porPersona, 395, "por persona");
});

prueba("campos vacíos", () => {
  const r = A.gasolinaViaje({ km: "", rendimiento: "", precio: "", personas: "", casetas: "" });
  assert.strictEqual(r.sinDatos, true);
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.porPersona, 0);
  assert.strictEqual(r.personas, 1, "sin personas, pagas tú solo");
  finito(r, "vacíos");
  finito(A.gasolinaViaje(), "sin argumentos");
});

prueba("rendimiento en cero no divide entre cero", () => {
  const r = A.gasolinaViaje({ km: 100, rendimiento: 0, precio: 24, casetas: 50, personas: 2 });
  assert.strictEqual(r.faltaRendimiento, true);
  assert.strictEqual(r.litros, 0);
  assert.strictEqual(r.porKm, 0);
  cerca(r.total, 50, "solo casetas");
  cerca(r.porPersona, 25, "casetas entre 2");
  cerca(r.porKmTotal, 0.25, "costo total por km: $50 ÷ 200 km");
  assert.strictEqual(A.gasolinaViaje({ km: 0, rendimiento: 14, precio: 24, casetas: 100 }).porKmTotal, 0, "sin km no divide entre cero");
  finito(r, "rendimiento 0");
});

prueba("negativos cuentan como cero", () => {
  const r = A.gasolinaViaje({ km: -100, rendimiento: -14, precio: -24, personas: -3, casetas: -500 });
  assert.strictEqual(r.km, 0);
  assert.strictEqual(r.total, 0);
  assert.strictEqual(r.personas, 1);
  assert.strictEqual(r.casetas, 0);
  assert.strictEqual(r.faltaKm, true);
  finito(r, "negativos");
});

prueba("cifras enormes se recortan", () => {
  // Topes: 50,000 km, 100 km/l, $100 por litro, 100 personas y $1,000,000 de casetas.
  // 100,000 km ÷ 100 = 1,000 litros × 100 = $100,000 + $1,000,000 = $1,100,000; entre 100 = $11,000.
  const r = A.gasolinaViaje({ km: "1e20", rendimiento: 1e20, precio: "Infinity", personas: 1e20, casetas: 1e20, idaYVuelta: true });
  assert.strictEqual(r.recortado, true);
  cerca(r.kmTotal, 100000, "km");
  cerca(r.litros, 1000, "litros");
  cerca(r.total, 1100000, "total");
  cerca(r.porPersona, 11000, "por persona");
  cerca(r.porKmTotal, 11, "costo total por km: $1,100,000 ÷ 100,000 km");
  finito(r, "enormes");
});

prueba("rendimiento menor a 1 km/l se toma como 1", () => {
  // 10 km solo ida con 1 km/l = 10 litros × $20 = $200.
  const r = A.gasolinaViaje({ km: 10, rendimiento: 0.5, precio: 20, idaYVuelta: false });
  assert.strictEqual(r.rendimientoBajo, true);
  assert.strictEqual(r.rendimiento, 1);
  cerca(r.total, 200, "total");
});

prueba("personas con decimales o texto", () => {
  assert.strictEqual(A.gasolinaViaje({ km: 10, rendimiento: 10, precio: 10, personas: 2.7 }).personas, 2);
  assert.strictEqual(A.gasolinaViaje({ km: 10, rendimiento: 10, precio: 10, personas: 0 }).personas, 1);
  assert.strictEqual(A.gasolinaViaje({ km: 10, rendimiento: 10, precio: 10, personas: "abc" }).personas, 1);
  assert.strictEqual(A.gasolinaViaje({ km: "abc", rendimiento: 10, precio: 10 }).faltaKm, true);
});

// ---------- Engomado y calendario de verificación ----------
prueba("engomado por último número de la placa", () => {
  const rojo = A.engomado(4);
  assert.strictEqual(rojo.color, "rojo");
  assert.strictEqual(rojo.dia, "miércoles");
  assert.deepStrictEqual(rojo.periodos, [[3, 4], [9, 10]]);
  assert.deepStrictEqual(rojo.textoPeriodos, ["marzo y abril", "septiembre y octubre"]);
  assert.strictEqual(rojo.par, true);
  const esperado = { 5: ["amarillo", "lunes", "enero y febrero", "julio y agosto"], 6: ["amarillo", "lunes", "enero y febrero", "julio y agosto"],
    7: ["rosa", "martes", "febrero y marzo", "agosto y septiembre"], 8: ["rosa", "martes", "febrero y marzo", "agosto y septiembre"],
    3: ["rojo", "miércoles", "marzo y abril", "septiembre y octubre"],
    1: ["verde", "jueves", "abril y mayo", "octubre y noviembre"], 2: ["verde", "jueves", "abril y mayo", "octubre y noviembre"],
    9: ["azul", "viernes", "mayo y junio", "noviembre y diciembre"], 0: ["azul", "viernes", "mayo y junio", "noviembre y diciembre"] };
  for (const [d, [color, dia, p1, p2]] of Object.entries(esperado)) {
    const e = A.engomado(d);
    assert.strictEqual(e.color, color, `placa ${d}`);
    assert.strictEqual(e.dia, dia, `placa ${d}`);
    assert.deepStrictEqual(e.textoPeriodos, [p1, p2], `placa ${d}`);
  }
  for (const malo of [10, -1, 4.5, "a", "", null, undefined, NaN, Infinity]) assert.strictEqual(A.engomado(malo), null, `entrada ${malo}`);
});

prueba("turno de verificación según la fecha", () => {
  const hoy = new Date(2026, 9, 20); // 20 de octubre de 2026
  // Placa 4 (rojo): septiembre y octubre. Del 20 al 31 de octubre quedan 12 días.
  let t = A.turnoVerificacion(4, hoy);
  assert.strictEqual(t.enPeriodo, true);
  assert.strictEqual(t.texto, "septiembre y octubre de 2026");
  assert.strictEqual(t.diasRestantes, 12);
  assert.strictEqual(t.fin.getDate(), 31);
  // Placa 1 (verde): octubre y noviembre. 12 días de octubre + 30 de noviembre = 42.
  t = A.turnoVerificacion(1, hoy);
  assert.strictEqual(t.enPeriodo, true);
  assert.strictEqual(t.diasRestantes, 42);
  // Placa 0 (azul): noviembre y diciembre; empieza en 12 días.
  t = A.turnoVerificacion(0, hoy);
  assert.strictEqual(t.enPeriodo, false);
  assert.strictEqual(t.texto, "noviembre y diciembre de 2026");
  assert.strictEqual(t.diasParaEmpezar, 12);
  // Placa 5 (amarillo): ya pasó julio y agosto; el siguiente es enero y febrero de 2027.
  // 12 días de octubre + 30 de noviembre + 31 de diciembre = 73.
  t = A.turnoVerificacion(5, hoy);
  assert.strictEqual(t.texto, "enero y febrero de 2027");
  assert.strictEqual(t.diasParaEmpezar, 73);
  assert.strictEqual(t.fin.getDate(), 28, "febrero de 2027 tiene 28 días");
  // Placa 7 (rosa) el 15 de enero de 2026: empieza el 1 de febrero, en 17 días.
  t = A.turnoVerificacion(7, new Date(2026, 0, 15));
  assert.strictEqual(t.texto, "febrero y marzo de 2026");
  assert.strictEqual(t.diasParaEmpezar, 17);
  // Último día del año con placa 9: queda 1 día del periodo.
  t = A.turnoVerificacion(9, new Date(2026, 11, 31, 18, 30));
  assert.strictEqual(t.enPeriodo, true);
  assert.strictEqual(t.diasRestantes, 1);
  assert.strictEqual(A.turnoVerificacion("x", hoy), null);
  assert.strictEqual(A.turnoVerificacion(4, new Date("no es fecha")), null);
  assert.strictEqual(A.turnoVerificacion(4, "2026-10-20"), null);
});

// ---------- Hoy No Circula ----------
prueba("sábados de octubre de 2026", () => {
  // El 1 de octubre de 2026 es jueves: los sábados son 3, 10, 17, 24 y 31.
  assert.deepStrictEqual(A.sabadosDelMes(2026, 10), [3, 10, 17, 24, 31]);
  assert.deepStrictEqual(A.sabadosDelMes(2026, 2), [7, 14, 21, 28]);
});

prueba("restricciones por holograma", () => {
  // Ejemplo de la página: placa 4 con holograma 1 no circula los miércoles ni el 2o y 4o sábado (10 y 24 de octubre).
  let r = A.hoyNoCircula(4, "1");
  assert.strictEqual(r.circulaDiario, false);
  assert.strictEqual(r.dia, "miércoles");
  assert.deepStrictEqual(r.sabados, [2, 4]);
  assert.strictEqual(r.textoSabados, "2º y 4º sábado del mes");
  assert.deepStrictEqual(A.sabadosSinCircular(4, "1", 2026, 10), [10, 24]);
  // Placa impar (3) con holograma 1: 1er y 3er sábado (3 y 17 de octubre).
  assert.deepStrictEqual(A.sabadosSinCircular(3, "1", 2026, 10), [3, 17]);
  // Holograma 2: todos los sábados.
  r = A.hoyNoCircula(4, "2");
  assert.strictEqual(r.textoSabados, "todos los sábados");
  assert.deepStrictEqual(A.sabadosSinCircular(4, "2", 2026, 10), [3, 10, 17, 24, 31]);
  assert.deepStrictEqual(A.sabadosSinCircular(4, "2", 2026, 2), [7, 14, 21, 28], "febrero solo tiene 4 sábados");
  // Hologramas 0 y 00 circulan diario (fuera de contingencia).
  for (const h of ["0", "00", 0]) {
    r = A.hoyNoCircula(8, h);
    assert.strictEqual(r.circulaDiario, true, `holograma ${h}`);
    assert.deepStrictEqual(A.sabadosSinCircular(8, h, 2026, 10), []);
  }
  assert.strictEqual(A.hoyNoCircula(4, "3"), null);
  assert.strictEqual(A.hoyNoCircula("", "1"), null);
  assert.deepStrictEqual(A.sabadosSinCircular(4, "9", 2026, 10), []);
});

prueba("multa por verificar tarde en la CDMX", () => {
  // 20 UMA × $117.31 (UMA 2026) = $2,346.20.
  assert.strictEqual(A.DATOS.verificacion.multaUmaCdmx, 20);
  assert.strictEqual(C.DATOS.uma, 117.31);
  cerca(A.multaExtemporaneaCdmx(), 2346.2, "multa");
});

prueba("lista de días", () => {
  assert.strictEqual(A.listaDias([]), "");
  assert.strictEqual(A.listaDias([10]), "10");
  assert.strictEqual(A.listaDias([10, 24]), "10 y 24");
  assert.strictEqual(A.listaDias([3, 10, 17]), "3, 10 y 17");
});

// ---------- Tenencia por estado ----------
prueba("32 estados con portal oficial", () => {
  assert.strictEqual(A.ESTADOS.length, 32);
  assert.strictEqual(new Set(A.ESTADOS.map(e => e.clave)).size, 32, "claves únicas");
  assert.strictEqual(new Set(A.ESTADOS.map(e => e.nombre)).size, 32, "nombres únicos");
  for (const e of A.ESTADOS) {
    const u = new URL(e.url);
    assert.strictEqual(u.protocol, "https:", e.nombre);
    assert.ok(u.hostname.endsWith(".gob.mx"), `${e.nombre}: ${u.hostname}`);
    assert.ok(["si", "algunos", "no", "revisar"].includes(e.tenencia), e.nombre);
    assert.ok(["pago", "finanzas", "catalogo", "estatal"].includes(e.portal), e.nombre);
    const t = A.tenenciaEstado(e.clave);
    assert.strictEqual(t.confirmado, false, "ningún dato se verificó abriendo el portal oficial");
    assert.ok(t.corto && t.detalle && t.descripcionPortal, e.nombre);
    // Solo los estados que revisamos para 2026 dicen "sí", "no" o "algunos", y todos citan su fuente.
    if (e.tenencia === "revisar") assert.strictEqual(t.fuente, "", e.nombre);
    else assert.ok(t.fuente.length > 20, `${e.nombre} sin fuente`);
    // Ningún texto del resultado lleva guion largo.
    assert.ok(!/\u2014/.test(t.detalle + t.fuente + t.descripcionPortal), e.nombre);
  }
});

prueba("datos de tenencia por estado", () => {
  const cdmx = A.tenenciaEstado("cdmx");
  assert.strictEqual(cdmx.tenencia, "si");
  assert.strictEqual(cdmx.corto, "Sí, con subsidio");
  assert.strictEqual(cdmx.dominio, "www.finanzas.cdmx.gob.mx");
  assert.strictEqual(cdmx.nombreFrase, "la Ciudad de México");
  // La CDMX no es un estado: su texto nombra a su propia secretaría.
  assert.ok(cdmx.descripcionPortal.startsWith("Secretaría de Administración y Finanzas de la Ciudad de México"), cdmx.descripcionPortal);
  assert.ok(!/del estado/.test(cdmx.descripcionPortal));
  assert.strictEqual(A.tenenciaEstado("mex").nombreFrase, "el Estado de México");
  assert.strictEqual(A.tenenciaEstado("jal").nombreFrase, "Jalisco");
  assert.strictEqual(A.tenenciaEstado("mex").tenencia, "si");
  for (const c of ["jal", "chih"]) assert.strictEqual(A.tenenciaEstado(c).tenencia, "no", c);
  // Guanajuato volvió a cobrar tenencia en 2025 a los autos de mayor valor.
  assert.strictEqual(A.tenenciaEstado("gto").tenencia, "algunos");
  assert.strictEqual(A.tenenciaEstado("gto").corto, "Solo a algunos autos");
  assert.strictEqual(A.tenenciaEstado("nl").tenencia, "revisar");
  for (const c of ["ver", "pue"]) assert.strictEqual(A.tenenciaEstado(c).tenencia, "si", c);
  assert.ok(A.tenenciaEstado("ver").detalle.startsWith("Veracruz sí cobra tenencia en 2026"));
  assert.ok(A.tenenciaEstado("ver").detalle.includes("31 de marzo de 2026"));
  assert.ok(A.tenenciaEstado("pue").detalle.includes("30 de abril de 2026"));
  assert.ok(A.tenenciaEstado("gto").detalle.includes("$522,000"));
  assert.strictEqual(A.tenenciaEstado("ver").dominio, "www.ovh.gob.mx");
  assert.ok(cdmx.detalle.startsWith("La Ciudad de México sí cobra tenencia en 2026"), cdmx.detalle);
  assert.ok(cdmx.detalle.includes("$638,000") && cdmx.detalle.includes("30 de junio de 2026"), cdmx.detalle);
  assert.ok(A.tenenciaEstado("mex").detalle.includes("6 de abril de 2026"));
  assert.ok(A.tenenciaEstado("jal").detalle.startsWith("Jalisco no cobra tenencia en 2026"));
  assert.ok(A.tenenciaEstado("chih").detalle.startsWith("Chihuahua no cobra tenencia desde 2011"));
  assert.ok(A.tenenciaEstado("nl").detalle.startsWith("No revisamos a fondo si Nuevo León cobra tenencia en 2026"));
  assert.strictEqual(A.tenenciaEstado("xx"), null);
  assert.strictEqual(A.tenenciaEstado(""), null);
  // Orden por el nombre que se ve: "Estado de México" va en la E, entre Durango y Guanajuato.
  const lista = A.estadosOrdenados().map(e => e.nombre);
  assert.strictEqual(lista[0], "Aguascalientes");
  assert.strictEqual(lista[lista.length - 1], "Zacatecas");
  assert.strictEqual(lista.indexOf("Estado de México"), lista.indexOf("Durango") + 1);
  assert.strictEqual(lista.indexOf("Guanajuato"), lista.indexOf("Estado de México") + 1);
  const ordenada = lista.slice().sort((a, b) => a.localeCompare(b, "es"));
  assert.deepStrictEqual(lista, ordenada, "orden alfabético por el nombre visible");
});

// ---------- Tenencia y refrendo 2026: páginas por estado ----------
const fs = require("fs");
const path = require("path");
prueba("cifras 2026 de Edomex, CDMX y Jalisco", () => {
  const mex = A.paginaTenencia("mex"), cdmx = A.paginaTenencia("cdmx"), jal = A.paginaTenencia("jal");
  assert.deepStrictEqual(mex.refrendo, { auto: 990, moto: 731 });
  assert.deepStrictEqual(mex.tope, { auto: 638000, moto: 250000 });
  assert.strictEqual(mex.plazo, "2026-04-06");
  assert.deepStrictEqual(cdmx.refrendo, { auto: 760, moto: null });
  assert.deepStrictEqual(cdmx.tope, { auto: 638000, moto: 250000 });
  assert.strictEqual(cdmx.plazo, "2026-06-30");
  assert.deepStrictEqual(jal.refrendo, { auto: 1000, moto: 600 });
  assert.strictEqual(jal.extras.reduce((s, x) => s + x.monto, 0), 100, "Cruz Roja $40 + Hogar Cabañas $60");
  assert.strictEqual(jal.cobraTenencia, false);
  assert.strictEqual(jal.plazo, "2026-03-31");
  assert.strictEqual(new Date(2026, 2, 31).getDay(), 2, "31 de marzo de 2026 es martes (día hábil)");
  assert.strictEqual(new Date(2026, 3, 6).getDay(), 1, "6 de abril de 2026 es lunes");
  assert.strictEqual(A.paginaTenencia("nl"), null, "Nuevo León todavía no tiene página");
  assert.strictEqual(new Date(2026, 3, 30).getDay(), 4, "30 de abril de 2026 es jueves");
  assert.strictEqual(new Date(2026, 3, 9).getDay(), 4, "9 de abril de 2026 es jueves");
  // Cada página por estado coincide con las cifras de auto.js.
  for (const [clave, p] of Object.entries(A.PAGINAS_TENENCIA)) {
    const html = fs.readFileSync(path.join(__dirname, "..", "auto", "tenencia", p.slug, "index.html"), "utf8");
    assert.ok(html.includes('const CLAVE = "' + clave + '"'), p.slug);
    const r = "$" + p.refrendo.auto.toLocaleString("en-US");
    assert.ok(html.includes(r), p.slug + ": refrendo " + r);
    if (p.tope) assert.ok(html.includes("$" + p.tope.auto.toLocaleString("en-US")), p.slug + ": tope");
    if (p.refrendo.moto) assert.ok(html.includes("$" + p.refrendo.moto.toLocaleString("en-US")), p.slug + ": moto");
    // La página enlaza al portal oficial del estado.
    assert.ok(html.includes('href="' + A.paginaTenencia(clave).url + '"'), p.slug + ": portal");
  }
});

prueba("cifras 2026 de Veracruz, Puebla y Guanajuato", () => {
  const ver = A.paginaTenencia("ver"), pue = A.paginaTenencia("pue"), gto = A.paginaTenencia("gto");
  assert.deepStrictEqual(ver.refrendo, { auto: 1239, moto: 690 });
  assert.strictEqual(ver.tope, null, "sin tope de valor publicado");
  assert.strictEqual(ver.plazo, "2026-03-31");
  assert.deepStrictEqual(ver.descuentosPorMes, { enero: 15, febrero: 8, marzo: 7 });
  assert.deepStrictEqual(pue.refrendo, { auto: 700, moto: 700 });
  assert.strictEqual(pue.tope, null);
  assert.strictEqual(pue.plazo, "2026-04-30"); assert.strictEqual(pue.plazoOriginal, "2026-03-31");
  assert.deepStrictEqual(gto.refrendo, { auto: 940, moto: 200 });
  assert.strictEqual(gto.tope.auto, 522000);
  assert.strictEqual(Math.round(450000 * 1.16), 522000, "$450,000 sin IVA son $522,000 con IVA");
  assert.strictEqual(gto.plazo, "2026-04-09");
  for (const c of ["ver", "pue", "gto"]) assert.strictEqual(A.paginaTenencia(c).cobraTenencia, true, c);
});

prueba("Veracruz, Puebla y Guanajuato: subsidio y total", () => {
  // Veracruz: en enero, 15% de $1,239 = $185.85; paga $1,053.15. Sin pedir el valor (no hay tope).
  let r = A.pagoTenencia2026("ver", { momento: "enero" });
  assert.strictEqual(r.subsidio, "completo"); assert.strictEqual(r.descuento, 185.85); cerca(r.total, 1053.15, "enero");
  cerca(A.pagoTenencia2026("ver", { momento: "febrero" }).total, 1139.88, "febrero 8%");
  cerca(A.pagoTenencia2026("ver", { momento: "marzo" }).total, 1152.27, "marzo 7%");
  cerca(A.pagoTenencia2026("ver", { tipo: "moto", momento: "enero" }).total, 586.5, "moto en enero");
  // Después del 31 de marzo: sin descuento y sin estímulo.
  r = A.pagoTenencia2026("ver", { momento: "tarde" });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.total, 1239); assert.deepStrictEqual(r.motivos, ["plazo"]);
  // Sin verificación pierde el estímulo; el valor no importa.
  r = A.pagoTenencia2026("ver", { momento: "enero", verificado: false, valor: 5e6 });
  assert.deepStrictEqual(r.motivos, ["verificacion"]); assert.strictEqual(r.pagasTenencia, true);
  // La verificación solo cuenta donde el subsidio la pide.
  assert.strictEqual(A.pagoTenencia2026("pue", { verificado: false }).subsidio, "completo");
  // Puebla: $700 a tiempo y al corriente, sin tope; tarde o con adeudos pierde el subsidio.
  r = A.pagoTenencia2026("pue", { valor: 2e6 });
  assert.strictEqual(r.subsidio, "completo"); assert.strictEqual(r.total, 700);
  r = A.pagoTenencia2026("pue", { alCorriente: false, momento: "tarde", aniosAtrasados: 1 });
  assert.deepStrictEqual(r.motivos, ["adeudos", "plazo"]); assert.strictEqual(r.total, 1400);
  assert.strictEqual(A.pagoTenencia2026("pue", { momento: "descuento" }).descuento, 0, "Puebla no tiene descuento");
  // Guanajuato: solo cuenta el valor; $522,000 justo no paga, un peso más sí. Pagar tarde no quita nada.
  assert.strictEqual(A.pagoTenencia2026("gto", { valor: 522000, momento: "tarde" }).subsidio, "completo");
  r = A.pagoTenencia2026("gto", { valor: 522001 });
  assert.strictEqual(r.subsidio, "no"); assert.deepStrictEqual(r.motivos, ["valor"]); assert.strictEqual(r.total, 940);
  assert.strictEqual(A.pagoTenencia2026("gto", {}).subsidio, "faltaValor");
  assert.strictEqual(A.pagoTenencia2026("gto", { tipo: "moto", valor: 50000, aniosAtrasados: 2 }).total, 600);
  for (const e of [{ valor: "x", momento: "enero" }, { valor: -5, aniosAtrasados: "abc", momento: "zzz" }, { valor: 1e30, aniosAtrasados: 1e9 }, { tipo: "barco", valor: Infinity }]) {
    for (const c of ["ver", "pue", "gto"]) finito(A.pagoTenencia2026(c, e), c + " " + JSON.stringify(e));
  }
});

prueba("subsidio y total a pagar", () => {
  // Edomex, auto de $350,000 con placas 2021, al corriente y a tiempo: subsidio completo, paga $990.
  let r = A.pagoTenencia2026("mex", { valor: 350000, anioPlacas: 2021 });
  assert.strictEqual(r.subsidio, "completo"); assert.strictEqual(r.total, 990); assert.strictEqual(r.pagasTenencia, false);
  // Placas 2020: subsidio de 50%, paga el refrendo más la mitad de la tenencia (monto en el portal).
  r = A.pagoTenencia2026("mex", { valor: 350000, anioPlacas: "2020" });
  assert.strictEqual(r.subsidio, "mitad"); assert.strictEqual(r.pagasTenencia, true); assert.strictEqual(r.total, 990);
  r = A.pagoTenencia2026("mex", { valor: 350000, anioPlacas: 2019 });
  assert.strictEqual(r.subsidio, "no"); assert.deepStrictEqual(r.motivos, ["placas"]);
  // Justo en el tope sí aplica; un peso arriba, no.
  assert.strictEqual(A.pagoTenencia2026("cdmx", { valor: 638000 }).subsidio, "completo");
  r = A.pagoTenencia2026("cdmx", { valor: 638001 });
  assert.strictEqual(r.subsidio, "no"); assert.deepStrictEqual(r.motivos, ["valor"]); assert.strictEqual(r.total, 760);
  // Moto en Edomex: tope de $250,000 y refrendo de $731.
  r = A.pagoTenencia2026("mex", { tipo: "moto", valor: 260000 });
  assert.strictEqual(r.refrendo, 731); assert.strictEqual(r.subsidio, "no");
  assert.strictEqual(A.pagoTenencia2026("mex", { tipo: "moto", valor: 250000 }).subsidio, "completo");
  // Moto en la CDMX: no tenemos el refrendo.
  r = A.pagoTenencia2026("cdmx", { tipo: "moto", valor: 100000 });
  assert.strictEqual(r.sinRefrendo, true); assert.strictEqual(r.total, 0); assert.strictEqual(r.subsidio, "completo");
  // Tarde y con adeudos: pierde el subsidio por las dos razones; 2 refrendos atrasados estimados a $760.
  r = A.pagoTenencia2026("cdmx", { valor: 200000, momento: "tarde", alCorriente: false, aniosAtrasados: 2 });
  assert.deepStrictEqual(r.motivos, ["adeudos", "plazo"]); assert.strictEqual(r.recargos, true);
  assert.strictEqual(r.adeudoEstimado, 1520); assert.strictEqual(r.total, 2280);
  // Sin valor no decimos si toca el subsidio.
  assert.strictEqual(A.pagoTenencia2026("mex", {}).subsidio, "faltaValor");
  // Jalisco: sin tenencia; $1,000 + $100; en línea en enero o febrero, 5% de $1,000 = $50 de descuento.
  r = A.pagoTenencia2026("jal", {});
  assert.strictEqual(r.subsidio, "noAplica"); assert.strictEqual(r.total, 1100);
  r = A.pagoTenencia2026("jal", { momento: "descuento" });
  assert.strictEqual(r.descuento, 50); assert.strictEqual(r.total, 1050);
  r = A.pagoTenencia2026("jal", { tipo: "moto", momento: "descuento" });
  assert.strictEqual(r.descuento, 30); assert.strictEqual(r.total, 670);
  // El descuento solo existe donde el estado lo da.
  assert.strictEqual(A.pagoTenencia2026("mex", { valor: 1, momento: "descuento" }).descuento, 0);
  // Moto en Jalisco con 3 refrendos atrasados: 700 + 3 x 700 = 2,800.
  assert.strictEqual(A.pagoTenencia2026("jal", { tipo: "moto", aniosAtrasados: 3 }).total, 2800);
  // Datos absurdos: sin NaN ni Infinity, y se recortan.
  for (const e of [{ valor: "x" }, { valor: -5, aniosAtrasados: "abc" }, { valor: 1e30, aniosAtrasados: 1e9 }, { tipo: "barco", valor: Infinity }]) {
    for (const c of ["mex", "cdmx", "jal"]) finito(A.pagoTenencia2026(c, e), c + " " + JSON.stringify(e));
  }
  assert.strictEqual(A.pagoTenencia2026("jal", { aniosAtrasados: 1e9 }).atrasados, 20);
  assert.strictEqual(A.pagoTenencia2026("jal", { aniosAtrasados: 1e9 }).recortado, true);
  assert.strictEqual(A.pagoTenencia2026("xx", {}), null);
});

prueba("lista de los 32 estados en auto/tenencia/", () => {
  const lista = A.estadosTenencia();
  assert.strictEqual(lista.length, 32);
  assert.strictEqual(new Set(lista.map(e => e.slug)).size, 32, "direcciones únicas");
  assert.strictEqual(A.slugEstado("Estado de México"), "estado-de-mexico");
  assert.strictEqual(A.slugEstado("San Luis Potosí"), "san-luis-potosi");
  assert.deepStrictEqual(lista.filter(e => e.lista).map(e => e.clave).sort(), Object.keys(A.PAGINAS_TENENCIA).sort());
  const hub = fs.readFileSync(path.join(__dirname, "..", "auto", "tenencia", "index.html"), "utf8");
  for (const e of lista) {
    assert.ok(hub.includes(e.nombre), "la lista nombra " + e.nombre);
    if (e.lista) assert.ok(hub.includes('<a href="' + e.slug + '/">' + e.nombre + "</a>"), "enlace a " + e.slug);
    else assert.ok(hub.includes("<li>" + e.nombre + ' <span class="nota">(próximamente)</span></li>'), e.nombre + " próximamente");
  }
});

console.log(`auto.test.js: ${pruebas} pruebas pasaron`);
