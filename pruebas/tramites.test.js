// Pruebas de trámites (pasaporte, credencial del INE y licencias por estado): node pruebas/tramites.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const T = require("../assets/tramites.js");
const cerca = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.006, `${msg}: ${a} != ${b}`);
const sinRaros = (obj, msg) => {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number") assert.ok(Number.isFinite(v), `${msg}: ${k} = ${v}`);
    else if (v && typeof v === "object" && !(v instanceof Date)) sinRaros(v, `${msg}.${k}`);
    else if (v instanceof Date) assert.ok(!isNaN(v), `${msg}: ${k} es fecha inválida`);
  }
};

// ---------- Pasaporte: cuotas 2026 (art. 20 LFD, tabla de la SRE) ----------
assert.deepStrictEqual(T.DATOS.pasaporte.cuotas, { 1: 920, 3: 1795, 6: 2440, 10: 4280 });
assert.deepStrictEqual(T.DATOS.pasaporte.conDescuento, { 1: 460, 3: 900, 6: 1220, 10: 2140 });
// Los montos con descuento son la mitad, salvo el de 3 años que la SRE redondea (1,795 / 2 = 897.50 -> 900).
for (const v of [1, 6, 10]) assert.strictEqual(T.DATOS.pasaporte.conDescuento[v], T.DATOS.pasaporte.cuotas[v] / 2);
assert.ok(Math.abs(T.DATOS.pasaporte.conDescuento[3] - 1795 / 2) <= 2.5);

// Vigencias por edad: solo las dos reglas seguras (1 año solo menores de 3; 10 años solo mayores de edad).
// El de 6 años para menores de 3 se calcula, pero queda "por confirmar con la SRE".
assert.deepStrictEqual(T.vigenciasPasaporte(0), [1, 3, 6]);
assert.deepStrictEqual(T.vigenciasPasaporte(2), [1, 3, 6]);
assert.strictEqual(T.vigenciaPorConfirmar(2, 6), true);
assert.strictEqual(T.vigenciaPorConfirmar(2, 3), false);
assert.strictEqual(T.vigenciaPorConfirmar(3, 6), false);
assert.deepStrictEqual(T.vigenciasPasaporte(3), [3, 6]);
assert.deepStrictEqual(T.vigenciasPasaporte(17), [3, 6]);
assert.deepStrictEqual(T.vigenciasPasaporte(18), [3, 6, 10]);
assert.deepStrictEqual(T.vigenciasPasaporte(90), [3, 6, 10]);

// Valores de la página: 35 años, 10 años, sin descuento
let r = T.costoPasaporte({ edad: "35", vigencia: "10", motivo: "ninguno" });
assert.ok(r.ok);
assert.strictEqual(r.aPagar, 4280);
assert.strictEqual(r.normal, 4280);
assert.strictEqual(r.descuento, false);
assert.strictEqual(r.ahorro, 0);
cerca(r.porAnio, 428, "4,280 / 10");
assert.deepStrictEqual(r.comparar.map(c => c.costo), [1795, 2440, 4280]);
cerca(r.comparar[0].porAnio, 598.333333, "1,795 / 3");
cerca(r.comparar[1].porAnio, 406.666667, "2,440 / 6");
assert.strictEqual(r.masBarata.vigencia, 6); // 406.67 < 428 < 598.33
assert.deepStrictEqual(r.avisos, []);

// Adulto mayor: el descuento se aplica solo desde los 60
r = T.costoPasaporte({ edad: 65, vigencia: 10 });
assert.strictEqual(r.aPagar, 2140);
assert.strictEqual(r.razon, "adulto mayor");
assert.strictEqual(r.ahorro, 2140);
// Con justo 60 años: se calcula con descuento, pero con aviso (la LFD dice "mayores de sesenta años")
r = T.costoPasaporte({ edad: 60, vigencia: 6 });
assert.strictEqual(r.aPagar, 1220);
assert.strictEqual(r.avisos.length, 1);
assert.ok(r.avisos[0].includes("mayores de sesenta"));
assert.deepStrictEqual(T.costoPasaporte({ edad: 61, vigencia: 6 }).avisos, []);
assert.deepStrictEqual(T.costoPasaporte({ edad: 60, vigencia: 6, motivo: "discapacidad" }).avisos, []); // ya toca por discapacidad
assert.strictEqual(T.costoPasaporte({ edad: 59, vigencia: 6 }).aPagar, 2440);
assert.strictEqual(T.costoPasaporte({ edad: 59.9, vigencia: 6 }).aPagar, 2440); // años cumplidos: 59
// Los descuentos no se suman
assert.strictEqual(T.costoPasaporte({ edad: 70, vigencia: 3, motivo: "discapacidad" }).aPagar, 900);

// Discapacidad
r = T.costoPasaporte({ edad: 30, vigencia: 3, motivo: "discapacidad" });
assert.strictEqual(r.aPagar, 900);
assert.strictEqual(r.razon, "discapacidad");
assert.strictEqual(T.costoPasaporte({ edad: 2, vigencia: 1, motivo: "discapacidad" }).aPagar, 460);

// Trabajador agrícola en Canadá: solo 3 y 6 años
assert.strictEqual(T.costoPasaporte({ edad: 30, vigencia: 3, motivo: "agricola" }).aPagar, 900);
assert.strictEqual(T.costoPasaporte({ edad: 30, vigencia: 6, motivo: "agricola" }).aPagar, 1220);
r = T.costoPasaporte({ edad: 30, vigencia: 10, motivo: "agricola" });
assert.strictEqual(r.aPagar, 4280);
assert.strictEqual(r.descuento, false);
assert.strictEqual(r.avisos.length, 1);
assert.deepStrictEqual(r.comparar.map(c => c.costo), [900, 1220, 4280]);
assert.strictEqual(r.masBarata.vigencia, 6); // 203.33 al año
// Con 60 o más, el de 10 años sí lleva descuento aunque marque "agrícola"
assert.strictEqual(T.costoPasaporte({ edad: 62, vigencia: 10, motivo: "agricola" }).aPagar, 2140);
// Agrícola solo para mayores de edad: un niño o un bebé pagan el precio normal, con aviso
for (const [edad, vig, precio] of [[1, 3, 1795], [10, 6, 2440], [17, 3, 1795]]) {
  r = T.costoPasaporte({ edad, vigencia: vig, motivo: "agricola" });
  assert.strictEqual(r.aPagar, precio, `agrícola con ${edad} años`);
  assert.strictEqual(r.descuento, false);
  assert.ok(r.avisos.some(a => a.includes("mayores de edad")), `aviso agrícola con ${edad} años`);
}
assert.strictEqual(T.costoPasaporte({ edad: 18, vigencia: 3, motivo: "agricola" }).aPagar, 900);

// Bebé: 1 año $920; si pide 10 años se ajusta a 3 (no a 6, que está por confirmar), con aviso
assert.strictEqual(T.costoPasaporte({ edad: 1, vigencia: 1 }).aPagar, 920);
r = T.costoPasaporte({ edad: 2, vigencia: 10 });
assert.strictEqual(r.vigencia, 3);
assert.strictEqual(r.vigenciaAjustada, true);
assert.strictEqual(r.aPagar, 1795);
assert.ok(r.avisos[0].includes("solo para mayores de edad"));
// Bebé que elige 6 años: no se cambia en silencio; se calcula y se avisa que se confirme con la SRE
r = T.costoPasaporte({ edad: 2, vigencia: 6 });
assert.strictEqual(r.vigencia, 6);
assert.strictEqual(r.vigenciaAjustada, false);
assert.strictEqual(r.aPagar, 2440);
assert.strictEqual(r.porConfirmar, true);
assert.ok(r.avisos.some(a => a.includes("confirma con la SRE")));
assert.deepStrictEqual(r.comparar.map(c => c.porConfirmar), [false, false, true]);
assert.strictEqual(r.masBarata.vigencia, 3); // 598.33 < 920; el de 6 no cuenta porque está por confirmar
// Niño de 10: 1 año no se puede (usa 3) y 10 años tampoco (usa 6)
assert.strictEqual(T.costoPasaporte({ edad: 10, vigencia: 1 }).vigencia, 3);
assert.ok(T.costoPasaporte({ edad: 10, vigencia: 1 }).avisos[0].includes("solo para menores de 3"));
assert.strictEqual(T.costoPasaporte({ edad: 10, vigencia: 10 }).vigencia, 6);
assert.strictEqual(T.costoPasaporte({ edad: 10, vigencia: 10 }).aPagar, 2440);
// Adulto que pide 1 año: se usa 3
assert.strictEqual(T.costoPasaporte({ edad: 40, vigencia: 1 }).vigencia, 3);
assert.strictEqual(T.costoPasaporte({ edad: 18, vigencia: 10 }).aPagar, 4280);
assert.strictEqual(T.costoPasaporte({ edad: 17, vigencia: 10 }).aPagar, 2440);

// Entradas raras: sin NaN ni Infinity, con mensaje
for (const malo of ["", "abc", -1, null, undefined, NaN, Infinity, -Infinity, 121, 1e300, "1e500", true]) {
  const x = T.costoPasaporte({ edad: malo, vigencia: 10 });
  assert.strictEqual(x.ok, false, `edad ${malo}`);
  assert.ok(typeof x.error === "string" && x.error.length > 0);
}
for (const v of ["", "abc", null, -3, 1e9, NaN]) {
  const x = T.costoPasaporte({ edad: 35, vigencia: v });
  assert.ok(x.ok);
  assert.ok([1795, 2440, 4280].includes(x.aPagar), `vigencia ${v}`);
  sinRaros(x, `vigencia ${v}`);
}
assert.strictEqual(T.costoPasaporte({ edad: 0, vigencia: 1 }).aPagar, 920); // recién nacido
assert.strictEqual(T.costoPasaporte({ edad: 120, vigencia: 10 }).aPagar, 2140);
sinRaros(T.costoPasaporte({ edad: 35, vigencia: 10, motivo: "otro" }), "motivo desconocido");
assert.strictEqual(T.costoPasaporte({ edad: 35, vigencia: 10, motivo: "otro" }).aPagar, 4280);

// ---------- Credencial para votar ----------
const hoy = new Date(2026, 9, 20); // 20 de octubre de 2026
let c = T.vigenciaCredencial({ anio: "2026", hoy }); // valor de la página
assert.ok(c.ok);
assert.strictEqual(c.vigente, true);
assert.strictEqual(c.hasta.getTime(), new Date(2026, 11, 31).getTime());
assert.strictEqual(c.finVigencia.getTime(), new Date(2027, 0, 1).getTime());
assert.strictEqual(c.diasRestantes, 73); // 12 de oct + 30 de nov + 31 de dic
assert.strictEqual(c.tiempo, "2 meses"); // 20 oct 2026 al 1 ene 2027: 2 meses y 12 días
assert.strictEqual(c.votar.sirve, false); // pierde vigencia el 1 ene 2027, antes del 6 jun 2027
assert.strictEqual(c.votar.aTiempo, true);
assert.strictEqual(c.votar.limite.getTime(), new Date(2027, 0, 25).getTime());
sinRaros(c, "credencial 2026");

c = T.vigenciaCredencial({ anio: 2027, hoy });
assert.strictEqual(c.vigente, true);
assert.strictEqual(c.votar.sirve, true);
assert.strictEqual(c.tiempo, "1 año y 2 meses");

c = T.vigenciaCredencial({ anio: 2025, hoy });
assert.strictEqual(c.vigente, false);
assert.strictEqual(c.diasVencida, 292); // del 1 ene 2026 (dejó de servir) al 20 oct 2026: 273 + 19
assert.strictEqual(c.vencidaTexto, "9 meses");
assert.strictEqual(c.diasRestantes, 0);
assert.strictEqual(c.votar.sirve, false);

c = T.vigenciaCredencial({ anio: 2036, hoy }); // sacada en 2026: dura hasta 2036
assert.ok(c.ok);
assert.strictEqual(c.tiempo, "10 años y 2 meses");
assert.strictEqual(T.vigenciaCredencial({ anio: 2037, hoy }).ok, false);

// Último día y primer día sin vigencia
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2026, 11, 31) }).vigente, true);
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2026, 11, 31) }).tiempo, "1 día");
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 0, 1) }).vigente, false);
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 0, 1) }).diasVencida, 0);
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 0, 1) }).vencidaTexto, "Desde hoy");
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 0, 2) }).vencidaTexto, "1 día");
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 2, 2) }).vencidaTexto, "60 días");
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 2, 3) }).vencidaTexto, "2 meses");
// Credencial 2019 el 20 oct 2026: del 1 ene 2020 son 2,484 días (366 + 365 + 365 + 365 + 366 + 365 + 292)
c = T.vigenciaCredencial({ anio: 2019, hoy });
assert.strictEqual(c.diasVencida, 2484);
assert.strictEqual(c.vencidaTexto, "6 años y 9 meses");
assert.strictEqual(T.vigenciaCredencial({ anio: 1990, hoy }).vencidaTexto, "35 años y 9 meses");
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy }).vencidaTexto, "");
// Después del plazo del 25 de enero de 2027
c = T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 0, 26) });
assert.strictEqual(c.votar.aTiempo, false);
assert.strictEqual(T.vigenciaCredencial({ anio: 2026, hoy: new Date(2027, 0, 25) }).votar.aTiempo, true);
// Pasada la elección ya no se muestra esa parte
assert.strictEqual(T.vigenciaCredencial({ anio: 2030, hoy: new Date(2027, 5, 7) }).votar, null);
assert.ok(T.vigenciaCredencial({ anio: 2030, hoy: new Date(2027, 5, 6) }).votar.sirve);

for (const malo of ["", "abc", null, undefined, NaN, Infinity, -2026, 0, 1989, 2029.5, 1e12, "1e500", true]) {
  const x = T.vigenciaCredencial({ anio: malo, hoy });
  assert.strictEqual(x.ok, false, `año ${malo}`);
  assert.ok(x.error.length > 0);
}
assert.strictEqual(T.tiempoTexto(new Date(2026, 9, 20), new Date(2030, 0, 1)), "3 años y 2 meses");
assert.strictEqual(T.tiempoTexto(new Date(2026, 9, 20), new Date(2026, 9, 20)), "");

// ---------- Licencias: 32 entidades, enlaces oficiales ----------
const NOMBRES = ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Estado de México",
  "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas"];
assert.strictEqual(T.ESTADOS.length, 32);
assert.deepStrictEqual(T.ESTADOS.map(e => e.nombre).sort(), NOMBRES.slice().sort());
assert.strictEqual(new Set(T.ESTADOS.map(e => e.clave)).size, 32);
assert.strictEqual(new Set(T.ESTADOS.map(e => e.url)).size, 32);
for (const e of T.ESTADOS) {
  const u = new URL(e.url);
  assert.strictEqual(u.protocol, "https:", `${e.nombre} usa https`);
  assert.ok(u.hostname.endsWith(".gob.mx"), `${e.nombre}: ${u.hostname} es .gob.mx`);
  assert.ok(T.TEXTO_TIPO[e.tipo], `${e.nombre}: tipo ${e.tipo}`);
  if (e.tipo === "licencias" || e.tipo === "dependencia") assert.ok(e.dependencia, `${e.nombre} dice quién la expide`);
  const p = T.portalLicencia(e.clave);
  assert.strictEqual(p.url, e.url);
  assert.strictEqual(p.dominio, u.hostname);
}
assert.strictEqual(T.portalLicencia("jal").dependencia, "Secretaría de Transporte (SETRAN)");
// La etiqueta dice qué tipo de sitio es (no todos son la página de licencias)
assert.strictEqual(T.portalLicencia("cdmx").etiqueta, "Página de licencias del estado");
assert.strictEqual(T.portalLicencia("nl").etiqueta, "Portal del gobierno del estado");
assert.strictEqual(T.portalLicencia("hgo").etiqueta, "Catálogo de trámites del estado");
assert.strictEqual(T.portalLicencia("mex").etiqueta, "Sitio de la dependencia que da las licencias");
assert.ok(T.TEXTO_TIPO.licencias.startsWith("Según nuestra búsqueda"));
for (const e of T.ESTADOS) assert.ok(!e.url.includes("?"), `${e.nombre}: enlace sin parámetros de búsqueda`);
assert.strictEqual(T.portalLicencia("cdmx").dominio, "semovi.cdmx.gob.mx");
assert.strictEqual(T.portalLicencia("xx"), null);
assert.strictEqual(T.portalLicencia(""), null);
assert.strictEqual(T.portalLicencia(undefined), null);
const orden = T.estadosOrdenados().map(e => e.nombre);
assert.strictEqual(orden[0], "Aguascalientes");
assert.strictEqual(orden[31], "Zacatecas");
assert.strictEqual(orden.indexOf("Estado de México"), orden.indexOf("Jalisco") + 1); // se ordena como "México"
assert.strictEqual(T.ESTADOS.length, 32, "ordenar no cambia los datos originales");

// ---------- Páginas de la sección ----------
const raiz = path.join(__dirname, "..");
const paginas = ["tramites/index.html", "tramites/curp/index.html", "tramites/ine/index.html",
  "tramites/pasaporte/index.html", "tramites/licencia-de-manejo/index.html"];
const titulos = new Set();
for (const rel of paginas) {
  const html = fs.readFileSync(path.join(raiz, rel), "utf8");
  const titulo = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  assert.ok(titulo && titulo.endsWith(" | Cuentas Claras MX"), `${rel}: título`);
  assert.ok(!titulos.has(titulo), `${rel}: título repetido`);
  titulos.add(titulo);
  const desc = (html.match(/<meta name="description" content="([^"]+)">/) || [])[1];
  assert.ok(desc && desc.length <= 160, `${rel}: descripción de ${desc && desc.length} caracteres`);
  assert.ok(!html.includes("—"), `${rel}: sin guiones largos`);
  assert.ok(/sitio independiente/i.test(html) && html.includes("aviso-legal/"), `${rel}: pie con aviso`);
  assert.ok(!/<input[^>]+(curp|rfc|password)/i.test(html), `${rel}: no pide datos personales`);
  // Enlaces y recursos internos: relativos y que existan
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|#|mailto:)/.test(url)) continue;
    assert.ok(!url.startsWith("/"), `${rel}: ruta absoluta ${url}`);
    const destino = path.join(raiz, path.dirname(rel), url);
    const existe = url.endsWith("/") ? fs.existsSync(path.join(destino, "index.html")) : fs.existsSync(destino);
    assert.ok(existe, `${rel}: no existe ${url}`);
  }
}
// La tabla de la guía de licencias coincide con los datos del selector
const lic = fs.readFileSync(path.join(raiz, "tramites/licencia-de-manejo/index.html"), "utf8");
for (const e of T.ESTADOS) assert.ok(lic.includes(`href="${e.url}"`), `tabla de licencias: falta ${e.nombre}`);
assert.strictEqual((lic.match(/<tr><td>/g) || []).length, 32);
// El ejemplo de la guía del pasaporte coincide con la calculadora
const pas = fs.readFileSync(path.join(raiz, "tramites/pasaporte/index.html"), "utf8");
assert.ok(pas.includes('id="edad" type="number" min="0" max="120" step="1" inputmode="numeric" value="35"'));
assert.ok(pas.includes('<option value="10" selected>'));
for (const t of ["$4,280", "$428", "$406.67", "$598.33", "$2,140"]) assert.ok(pas.includes(t), `ejemplo del pasaporte: ${t}`);
const ine = fs.readFileSync(path.join(raiz, "tramites/ine/index.html"), "utf8");
assert.ok(ine.includes('value="2026"') && ine.includes("25 de enero de 2027") && ine.includes("31 de diciembre de 2026"));
// Correcciones de la revisión: afirmaciones sin fuente que ya no deben aparecer
assert.ok(ine.includes("artículo 156") && ine.includes("pendiente de cotejar"), "INE: fuente de la vigencia y fecha por cotejar");
assert.ok(!ine.includes("29 de septiembre"), "INE: fecha de comunicado que no existe");
assert.ok(!pas.includes("dólares"), "pasaporte: en el extranjero no siempre se paga en dólares");
assert.ok(!pas.includes("Suprema Corte"), "pasaporte: afirmación jurídica sin fuente");
assert.ok(pas.includes("Pendiente de confirmar con la SRE"), "pasaporte: vigencias por edad marcadas como pendientes");
assert.ok(!lic.includes("Revisamos los enlaces") && !lic.includes("Baja California, tienen"), "licencias: afirmaciones sin fuente");
assert.ok(!lic.includes("Sitio oficial de licencias"), "licencias: etiqueta según el tipo de sitio");
const indice = fs.readFileSync(path.join(raiz, "tramites/index.html"), "utf8");
assert.ok(!indice.includes("sitio oficial de licencias"), "índice: no promete páginas de licencias exactas");
const curp = fs.readFileSync(path.join(raiz, "tramites/curp/index.html"), "utf8");
assert.ok(!curp.includes("La ley pide tu"), "CURP: el consentimiento viene de notas de prensa");

console.log("tramites.test.js: todas las pruebas pasaron");
