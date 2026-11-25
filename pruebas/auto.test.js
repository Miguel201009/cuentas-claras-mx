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
  assert.strictEqual(A.tenenciaEstado("hgo").tenencia, "revisar");
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
  assert.ok(A.tenenciaEstado("hgo").detalle.startsWith("No revisamos a fondo si Hidalgo cobra tenencia en 2026"));
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
  assert.strictEqual(A.paginaTenencia("hgo"), null, "Hidalgo todavía no tiene página");
  assert.strictEqual(new Date(2026, 3, 30).getDay(), 4, "30 de abril de 2026 es jueves");
  assert.strictEqual(new Date(2026, 3, 9).getDay(), 4, "9 de abril de 2026 es jueves");
  // Cada página por estado coincide con las cifras de auto.js.
  for (const [clave, p] of Object.entries(A.PAGINAS_TENENCIA)) {
    const html = fs.readFileSync(path.join(__dirname, "..", "auto", "tenencia", p.slug, "index.html"), "utf8");
    assert.ok(html.includes('const CLAVE = "' + clave + '"'), p.slug);
    // Guerrero no tiene monto de refrendo confirmado (null): su página lo dice.
    if (p.refrendo.auto !== null) {
      const r = "$" + p.refrendo.auto.toLocaleString("en-US");
      assert.ok(html.includes(r), p.slug + ": refrendo " + r);
    }
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

prueba("cifras 2026 de Nuevo León, Chiapas y Michoacán", () => {
  const nl = A.paginaTenencia("nl"), chis = A.paginaTenencia("chis"), mich = A.paginaTenencia("mich");
  for (const c of ["nl", "chis", "mich"]) {
    assert.strictEqual(A.paginaTenencia(c).cobraTenencia, false, c);
    assert.strictEqual(A.tenenciaEstado(c).tenencia, "no", c);
    assert.strictEqual(A.tenenciaEstado(c).corto, "No se cobra", c);
    assert.ok(A.tenenciaEstado(c).fuente.length > 0, c + ": fuente");
  }
  assert.ok(A.tenenciaEstado("nl").detalle.startsWith("Nuevo León no cobra tenencia desde 2018"));
  assert.ok(A.tenenciaEstado("chis").detalle.startsWith("Chiapas no cobra tenencia en 2026"));
  assert.ok(A.tenenciaEstado("mich").detalle.startsWith("Michoacán no cobra tenencia en 2026"));
  // Nuevo León: refrendo por modelo en UMA de enero ($113.14): 35, 25 y 19.5 UMA; motos 7 y eléctricos 17.5.
  assert.deepStrictEqual(nl.refrendo, { auto: 3960, moto: 792, electrico: 1980 });
  for (const [uma, monto] of [[35, 3960], [25, 2829], [19.5, 2206], [7, 792], [17.5, 1980]]) {
    assert.strictEqual(Math.round(uma * 113.14), monto, uma + " UMA");
  }
  assert.deepStrictEqual(nl.tarifas.auto.map(t => [t.hasta, t.monto, t.enero]), [[2011, 2206, 1075], [2016, 2829, 1698], [undefined, 3960, 3762]]);
  assert.strictEqual(nl.plazo, "2026-03-31");
  // Chiapas: $1,150 y $984 más el 6% del Código Fiscal dan $1,219 y $1,043.
  assert.deepStrictEqual(chis.refrendo, { auto: 1219, moto: 1043 });
  assert.strictEqual(Math.round(1150 * 1.06), 1219); assert.strictEqual(Math.round(984 * 1.06), 1043);
  assert.deepStrictEqual(chis.descuentosPorMes, { enero: 15, febrero: 10, marzo: 5 });
  assert.strictEqual(chis.plazo, "2026-03-31");
  // Michoacán: $1,256 y $401, 10% en enero, plazo al jueves 30 de abril.
  assert.deepStrictEqual(mich.refrendo, { auto: 1256, moto: 401 });
  assert.deepStrictEqual(mich.descuentosPorMes, { enero: 10 });
  assert.strictEqual(mich.plazo, "2026-04-30");
  // Las tres páginas muestran las cifras de cada tarifa.
  const html = s => fs.readFileSync(path.join(__dirname, "..", "auto", "tenencia", s, "index.html"), "utf8");
  for (const t of [...nl.tarifas.auto, ...nl.tarifas.moto, ...nl.tarifas.electrico]) {
    for (const m of [t.monto, t.enero]) assert.ok(html("nuevo-leon").includes("$" + m.toLocaleString("en-US")), "Nuevo León: $" + m);
  }
  for (const m of ["$1,036", "$1,097", "$1,158", "$887", "$939", "$991"]) assert.ok(html("chiapas").includes(m), "Chiapas: " + m);
  assert.ok(html("michoacan").includes("$1,130"), "Michoacán: $1,130 en enero");
});

prueba("Nuevo León, Chiapas y Michoacán: total a pagar", () => {
  // Nuevo León: sin modelo, la tarifa de 2017 o más nuevo. En enero, precio de pronto pago en pesos.
  let r = A.pagoTenencia2026("nl", {});
  assert.strictEqual(r.subsidio, "noAplica"); assert.strictEqual(r.refrendo, 3960); assert.strictEqual(r.total, 3960);
  r = A.pagoTenencia2026("nl", { modelo: 2020, momento: "enero" });
  assert.strictEqual(r.descuento, 198); assert.strictEqual(r.total, 3762);
  // Los límites de cada rango: 2011 y 2012, 2016 y 2017.
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 2011 }).refrendo, 2206);
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: "2012" }).refrendo, 2829);
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 2016, momento: "enero" }).total, 1698);
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 2017 }).refrendo, 3960);
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 1995, momento: "enero" }).total, 1075);
  // Motos y eléctricos no dependen del modelo.
  assert.strictEqual(A.pagoTenencia2026("nl", { tipo: "moto", modelo: 2000, momento: "enero" }).total, 752);
  r = A.pagoTenencia2026("nl", { tipo: "electrico", momento: "enero" });
  assert.strictEqual(r.tipo, "electrico"); assert.strictEqual(r.total, 1881);
  // "electrico" solo existe en Nuevo León; en otro estado se toma como auto.
  assert.strictEqual(A.pagoTenencia2026("jal", { tipo: "electrico" }).tipo, "auto");
  assert.strictEqual(A.pagoTenencia2026("nl", { tipo: "constructor" }).tipo, "auto");
  // Febrero o marzo: precio normal; tarde: precio normal y recargos aparte. Atrasados al costo de 2026.
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 2014, momento: "aTiempo" }).total, 2829);
  r = A.pagoTenencia2026("nl", { modelo: 2014, momento: "tarde", aniosAtrasados: 2 });
  assert.strictEqual(r.recargos, true); assert.strictEqual(r.descuento, 0); assert.strictEqual(r.total, 2829 * 3);
  // Chiapas: 15%, 10% y 5% sobre $1,219; con adeudos no hay descuento.
  cerca(A.pagoTenencia2026("chis", { momento: "enero" }).total, 1036.15, "enero 15%");
  cerca(A.pagoTenencia2026("chis", { momento: "febrero" }).total, 1097.1, "febrero 10%");
  cerca(A.pagoTenencia2026("chis", { momento: "marzo" }).total, 1158.05, "marzo 5%");
  cerca(A.pagoTenencia2026("chis", { tipo: "moto", momento: "enero" }).total, 886.55, "moto en enero");
  r = A.pagoTenencia2026("chis", { momento: "enero", alCorriente: false });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.sinDescuentoPorAdeudo, true); assert.strictEqual(r.total, 1219);
  r = A.pagoTenencia2026("chis", { momento: "febrero", aniosAtrasados: 1 });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.total, 2438);
  assert.strictEqual(A.pagoTenencia2026("chis", { momento: "tarde" }).sinDescuentoPorAdeudo, false);
  // En Veracruz el descuento por mes no pide estar al corriente (el estímulo a la tenencia sí).
  assert.strictEqual(A.pagoTenencia2026("ver", { momento: "enero", alCorriente: false }).descuento, 185.85);
  // Michoacán: 10% solo en enero.
  r = A.pagoTenencia2026("mich", { momento: "enero" });
  assert.strictEqual(r.descuento, 125.6); cerca(r.total, 1130.4, "Michoacán en enero");
  assert.strictEqual(A.pagoTenencia2026("mich", { momento: "febrero" }).descuento, 0);
  assert.strictEqual(A.pagoTenencia2026("mich", { tipo: "moto", momento: "aTiempo" }).total, 401);
  cerca(A.pagoTenencia2026("mich", { tipo: "moto", momento: "enero" }).total, 360.9, "moto en enero");
  for (const e of [{ modelo: "x", momento: "enero" }, { modelo: -5, aniosAtrasados: "abc", momento: "zzz" }, { modelo: 1e30, aniosAtrasados: 1e9 }, { tipo: "barco", modelo: Infinity }, { tipo: "electrico", modelo: null }]) {
    for (const c of ["nl", "chis", "mich"]) finito(A.pagoTenencia2026(c, e), c + " " + JSON.stringify(e));
  }
});

prueba("cifras 2026 de Oaxaca, Chihuahua y Guerrero", () => {
  const oax = A.paginaTenencia("oax"), chih = A.paginaTenencia("chih"), gro = A.paginaTenencia("gro");
  for (const c of ["oax", "chih", "gro"]) assert.ok(A.tenenciaEstado(c).fuente.length > 20, c + ": fuente");
  // Oaxaca: tenencia con estímulo de 100%; paquete de derechos de $2,299 en enero; plazo estimado al 30 de junio.
  assert.strictEqual(A.tenenciaEstado("oax").tenencia, "si");
  assert.strictEqual(A.tenenciaEstado("oax").corto, "Sí, con subsidio");
  assert.ok(A.tenenciaEstado("oax").detalle.startsWith("Oaxaca sí cobra tenencia"));
  assert.deepStrictEqual(oax.refrendo, { auto: 2299, moto: 723 });
  assert.strictEqual(oax.tope, null); assert.strictEqual(oax.plazo, "2026-06-30"); assert.strictEqual(oax.plazoEstimado, true);
  assert.strictEqual(Math.round(2299 * 117.31 / 113.14), oax.precioDesdeFebreroEstimado, "estimado con la UMA de febrero");
  assert.strictEqual(new Date(2026, 11, 19).getDay(), 6, "19 de diciembre de 2026 es sábado");
  assert.strictEqual(A.tenenciaEstado("oax").dominio, "siox.finanzasoaxaca.gob.mx");
  // Chihuahua: sin tenencia; revalidación por modelo y mes; $2,749 desde el 1 de mayo.
  assert.strictEqual(chih.cobraTenencia, false);
  assert.strictEqual(A.tenenciaEstado("chih").tenencia, "no");
  assert.strictEqual(chih.tarifas.auto.length, 7);
  for (const t of chih.tarifas.auto) {
    assert.strictEqual(t.monto, 2749);
    assert.ok(t.febrero < t.marzo && t.marzo < t.abril && t.abril < t.monto, "sube cada mes: " + JSON.stringify(t));
  }
  assert.strictEqual(chih.plazo, "2026-04-30");
  // Guerrero: tenencia sin subsidio confirmado, con 10/8/5% por pronto pago; sin monto de refrendo.
  assert.strictEqual(A.tenenciaEstado("gro").tenencia, "si");
  assert.strictEqual(A.tenenciaEstado("gro").corto, "Sí, con descuento por pronto pago");
  assert.ok(A.tenenciaEstado("gro").detalle.startsWith("Guerrero sí cobra tenencia en 2026"));
  assert.deepStrictEqual(gro.refrendo, { auto: null, moto: null });
  assert.deepStrictEqual(gro.descuentosPorMes, { enero: 10, febrero: 8, marzo: 5 });
  assert.strictEqual(gro.plazo, "2026-03-31");
  // Las páginas muestran las cifras.
  const html = s => fs.readFileSync(path.join(__dirname, "..", "auto", "tenencia", s, "index.html"), "utf8");
  for (const t of chih.tarifas.auto) for (const m of [t.monto, t.febrero, t.marzo, t.abril]) {
    assert.ok(html("chihuahua").includes("$" + m.toLocaleString("en-US")), "Chihuahua: $" + m);
  }
  for (const m of ["$2,299", "$723", "$2,384", "30 de junio", "19 de diciembre"]) assert.ok(html("oaxaca").includes(m), "Oaxaca: " + m);
  for (const m of ["10%", "8%", "5%", "31 de marzo"]) assert.ok(html("guerrero").includes(m), "Guerrero: " + m);
});

prueba("Oaxaca, Chihuahua y Guerrero: total a pagar", () => {
  // Oaxaca: al corriente y a tiempo, estímulo completo y solo el paquete de derechos.
  let r = A.pagoTenencia2026("oax", { momento: "enero" });
  assert.strictEqual(r.subsidio, "completo"); assert.strictEqual(r.total, 2299); assert.strictEqual(r.descuento, 0);
  assert.strictEqual(A.pagoTenencia2026("oax", { tipo: "moto" }).total, 723);
  r = A.pagoTenencia2026("oax", { alCorriente: false, aniosAtrasados: 1 });
  assert.deepStrictEqual(r.motivos, ["adeudos"]); assert.strictEqual(r.pagasTenencia, true); assert.strictEqual(r.total, 4598);
  assert.deepStrictEqual(A.pagoTenencia2026("oax", { momento: "tarde" }).motivos, ["plazo"]);
  // Chihuahua: precio por modelo y mes; desde mayo, $2,749 parejo.
  r = A.pagoTenencia2026("chih", { modelo: 2022, momento: "febrero" });
  assert.strictEqual(r.subsidio, "noAplica"); assert.strictEqual(r.refrendo, 2749); assert.strictEqual(r.descuento, 424); assert.strictEqual(r.total, 2325);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: 2018, momento: "marzo" }).total, 2374);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: 1990, momento: "abril" }).total, 1609);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: 1995, momento: "febrero" }).total, 1507);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: 1996, momento: "febrero" }).total, 1660);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: "2010", momento: "abril" }).total, 2119);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: 2011, momento: "abril" }).total, 2272);
  assert.strictEqual(A.pagoTenencia2026("chih", { modelo: 2021, momento: "abril" }).total, 2529);
  r = A.pagoTenencia2026("chih", { modelo: 2005, momento: "tarde", aniosAtrasados: 1 });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.recargos, true); assert.strictEqual(r.total, 2749 * 2);
  // Sin modelo: la tarifa de los más nuevos. Enero no tiene precio propio en Chihuahua.
  assert.strictEqual(A.pagoTenencia2026("chih", { momento: "febrero" }).total, 2325);
  assert.strictEqual(A.pagoTenencia2026("chih", { momento: "enero" }).descuento, 0);
  // Moto: sin dato.
  assert.strictEqual(A.pagoTenencia2026("chih", { tipo: "moto" }).sinRefrendo, true);
  // Nuevo León sigue igual con la regla por mes: en febrero no hay precio propio.
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 2020, momento: "febrero" }).total, 3960);
  // Guerrero: tenencia que escribe la persona, con 10/8/5% por mes; sin refrendo confirmado.
  r = A.pagoTenencia2026("gro", { momento: "enero", montoTenencia: 3000 });
  assert.strictEqual(r.subsidio, "sinSubsidio"); assert.strictEqual(r.pagasTenencia, true); assert.strictEqual(r.sinRefrendo, true);
  assert.strictEqual(r.descuentoTenencia, 300); assert.strictEqual(r.tenenciaNeta, 2700); assert.strictEqual(r.total, 2700);
  assert.strictEqual(r.descuento, 0, "el descuento no se aplica al refrendo");
  assert.strictEqual(A.pagoTenencia2026("gro", { momento: "febrero", montoTenencia: 3000 }).total, 2760);
  assert.strictEqual(A.pagoTenencia2026("gro", { momento: "marzo", montoTenencia: 3000 }).total, 2850);
  r = A.pagoTenencia2026("gro", { momento: "tarde", montoTenencia: 3000 });
  assert.strictEqual(r.descuentoTenencia, 0); assert.strictEqual(r.total, 3000); assert.strictEqual(r.recargos, true);
  assert.strictEqual(A.pagoTenencia2026("gro", {}).total, 0);
  // La tenencia escrita solo cuenta donde se paga completa.
  assert.strictEqual(A.pagoTenencia2026("pue", { montoTenencia: 5000 }).total, 700);
  assert.strictEqual(A.pagoTenencia2026("mex", { valor: 900000, montoTenencia: 5000 }).tenencia, 0);
  for (const e of [{ modelo: "x", momento: "febrero" }, { modelo: -5, aniosAtrasados: "abc", momento: "zzz", montoTenencia: "x" }, { modelo: 1e30, aniosAtrasados: 1e9, montoTenencia: 1e30 }, { tipo: "barco", modelo: Infinity, montoTenencia: -3 }]) {
    for (const c of ["oax", "chih", "gro"]) finito(A.pagoTenencia2026(c, e), c + " " + JSON.stringify(e));
  }
  assert.strictEqual(A.pagoTenencia2026("gro", { montoTenencia: 1e30 }).recortado, true);
});

prueba("cifras 2026 de Baja California, Tamaulipas y Coahuila", () => {
  const bc = A.paginaTenencia("bc"), tamps = A.paginaTenencia("tamps"), coah = A.paginaTenencia("coah");
  for (const c of ["bc", "tamps", "coah"]) assert.ok(A.tenenciaEstado(c).fuente.length > 20, c + ": fuente");
  // Baja California: tenencia solo a vehículos de mayor valor (tope disputado); refrendo de $1,167 para autos y motos.
  assert.strictEqual(A.tenenciaEstado("bc").tenencia, "algunos");
  assert.strictEqual(A.tenenciaEstado("bc").corto, "Solo a algunos autos");
  assert.ok(A.tenenciaEstado("bc").detalle.startsWith("Baja California cobra tenencia solo"));
  assert.strictEqual(A.tenenciaEstado("bc").dominio, "refrendo.bajacalifornia.gob.mx");
  assert.deepStrictEqual(bc.refrendo, { auto: 1167, moto: 1167 });
  assert.strictEqual(bc.tope, null); assert.strictEqual(bc.soloPorValor, true);
  assert.deepStrictEqual(bc.descuentosPorMes, { enero: 12, febrero: 8.5, marzo: 5 });
  assert.deepStrictEqual(bc.plazosPorModelo.map(x => x.plazo), ["2026-06-30", "2026-03-31"]);
  assert.strictEqual(bc.regularizarHasta, "2026-12-30");
  assert.strictEqual(new Date(2026, 5, 30).getDay(), 2, "30 de junio de 2026 es martes");
  assert.strictEqual(new Date(2026, 11, 30).getDay(), 3, "30 de diciembre de 2026 es miércoles");
  // Tamaulipas: sin tenencia; 20 UMA = $2,346; 30% para quien está al corriente hasta el 31 de diciembre.
  assert.strictEqual(A.tenenciaEstado("tamps").tenencia, "no");
  assert.ok(A.tenenciaEstado("tamps").detalle.startsWith("Tamaulipas no cobra tenencia en 2026"));
  assert.strictEqual(A.tenenciaEstado("tamps").portal, "pago");
  assert.strictEqual(A.tenenciaEstado("tamps").dominio, "finanzas.tamaulipas.gob.mx");
  assert.strictEqual(Math.round(20 * 117.31), tamps.refrendo.auto, "20 UMA de 2026");
  assert.strictEqual(tamps.refrendo.moto, null);
  assert.deepStrictEqual(tamps.descuentoCumplido, { porcentaje: 30, hasta: "2026-12-31" });
  assert.strictEqual(tamps.plazoEstimado, true);
  assert.deepStrictEqual(tamps.cuotasRegularizacion, [{ hasta: 2011, monto: 3990 }, { hasta: 2017, monto: 5990 }]);
  // Coahuila: sin tenencia; $2,441 + $549 (22.5%) + $10 + $75 = $3,075; plazo al 31 de marzo.
  assert.strictEqual(A.tenenciaEstado("coah").tenencia, "no");
  assert.ok(A.tenenciaEstado("coah").detalle.startsWith("Coahuila no cobra tenencia en 2026"));
  assert.deepStrictEqual(coah.refrendo, { auto: 2441, moto: 2441 });
  assert.strictEqual(Math.round(2441 * 0.225), 549, "22.5% de $2,441");
  assert.strictEqual(coah.refrendo.auto + coah.extras.reduce((s, x) => s + x.monto, 0), 3075);
  assert.strictEqual(coah.plazo, "2026-03-31"); assert.strictEqual(coah.regularizarHasta, "2026-11-30");
  // Las páginas muestran las cifras.
  const html = s => fs.readFileSync(path.join(__dirname, "..", "auto", "tenencia", s, "index.html"), "utf8");
  for (const m of ["$1,167", "$1,027", "$1,068", "$1,109", "12%", "8.5%", "31 de marzo", "30 de junio", "$685,000", "$500,000", "30 de diciembre"]) assert.ok(html("baja-california").includes(m), "Baja California: " + m);
  for (const m of ["$2,346", "$1,642", "30%", "31 de diciembre", "$3,990", "$5,990", "$870"]) assert.ok(html("tamaulipas").includes(m), "Tamaulipas: " + m);
  for (const m of ["$2,441", "$549", "$3,075", "$3,076", "31 de marzo", "30 de noviembre"]) assert.ok(html("coahuila").includes(m), "Coahuila: " + m);
});

prueba("Baja California, Tamaulipas y Coahuila: total a pagar", () => {
  // Baja California: descuento por mes sobre $1,167; sin tenencia salvo que sea de alto valor.
  let r = A.pagoTenencia2026("bc", { modelo: 2020, momento: "enero" });
  assert.strictEqual(r.subsidio, "completo"); assert.strictEqual(r.pagasTenencia, false);
  assert.strictEqual(r.descuento, 140.04); cerca(r.total, 1026.96, "enero 12%");
  cerca(A.pagoTenencia2026("bc", { momento: "febrero" }).total, 1067.81, "febrero 8.5%");
  cerca(A.pagoTenencia2026("bc", { tipo: "moto", momento: "marzo" }).total, 1108.65, "moto en marzo 5%");
  // Plazo según el modelo: de abril a junio solo es a tiempo para los 2016 y anteriores.
  r = A.pagoTenencia2026("bc", { modelo: 2016, momento: "abrilJunio" });
  assert.strictEqual(r.plazo, "2026-06-30"); assert.strictEqual(r.recargos, false); assert.strictEqual(r.total, 1167);
  r = A.pagoTenencia2026("bc", { modelo: 2017, momento: "abrilJunio" });
  assert.strictEqual(r.plazo, "2026-03-31"); assert.strictEqual(r.recargos, true);
  assert.strictEqual(A.pagoTenencia2026("bc", { momento: "abrilJunio" }).recargos, true, "sin modelo: plazo de los más nuevos");
  assert.strictEqual(A.pagoTenencia2026("bc", { modelo: 2010, momento: "tarde" }).recargos, true);
  // Alto valor: paga tenencia (monto en el portal), además del refrendo.
  r = A.pagoTenencia2026("bc", { modelo: 2025, momento: "enero", altoValor: true });
  assert.strictEqual(r.subsidio, "no"); assert.deepStrictEqual(r.motivos, ["valor"]); assert.strictEqual(r.pagasTenencia, true);
  cerca(r.total, 1026.96, "la tenencia no se suma: la da el portal");
  // Tamaulipas: 30% si estás al corriente; con adeudos, sin descuento.
  r = A.pagoTenencia2026("tamps", {});
  assert.strictEqual(r.subsidio, "noAplica"); assert.strictEqual(r.descuento, 703.8); cerca(r.total, 1642.2, "30% de $2,346");
  r = A.pagoTenencia2026("tamps", { alCorriente: false });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.sinDescuentoPorAdeudo, true); assert.strictEqual(r.total, 2346);
  r = A.pagoTenencia2026("tamps", { aniosAtrasados: 2 });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.total, 2346 * 3);
  r = A.pagoTenencia2026("tamps", { momento: "tarde" });
  assert.strictEqual(r.descuento, 0); assert.strictEqual(r.sinDescuentoPorAdeudo, false); assert.strictEqual(r.total, 2346);
  assert.strictEqual(A.pagoTenencia2026("tamps", { tipo: "moto" }).sinRefrendo, true);
  // El descuento para cumplidos no se cuela en otros estados.
  assert.strictEqual(A.pagoTenencia2026("pue", {}).descuento, 0);
  assert.strictEqual(A.pagoTenencia2026("nl", { modelo: 2020 }).total, 3960);
  // Coahuila: $2,441 + $634 = $3,075, igual para motos; atrasados al costo de 2026.
  r = A.pagoTenencia2026("coah", {});
  assert.strictEqual(r.subsidio, "noAplica"); assert.strictEqual(r.extras, 634); assert.strictEqual(r.total, 3075);
  assert.strictEqual(A.pagoTenencia2026("coah", { tipo: "moto" }).total, 3075);
  r = A.pagoTenencia2026("coah", { momento: "tarde", aniosAtrasados: 1 });
  assert.strictEqual(r.recargos, true); assert.strictEqual(r.descuento, 0); assert.strictEqual(r.total, 6150);
  for (const e of [{ modelo: "x", momento: "abrilJunio" }, { modelo: -5, aniosAtrasados: "abc", momento: "zzz", altoValor: "si" }, { modelo: 1e30, aniosAtrasados: 1e9 }, { tipo: "barco", modelo: Infinity }]) {
    for (const c of ["bc", "tamps", "coah"]) finito(A.pagoTenencia2026(c, e), c + " " + JSON.stringify(e));
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
