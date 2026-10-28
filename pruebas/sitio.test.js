// Pruebas de todo el sitio: portada, buscador, enlaces internos, sitemap y robots. Correr: node pruebas/sitio.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const B = require("../assets/buscador.js");

const raiz = path.join(__dirname, "..");
const BASE = "https://miguel201009.github.io/cuentas-claras-mx/";
const SECCIONES = ["trabajo", "impuestos", "dinero", "retiro", "vivienda", "tramites", "auto", "casa", "familia", "negocio"];
const leer = rel => fs.readFileSync(path.join(raiz, rel), "utf8");

// Todas las páginas: cada carpeta con index.html, sin assets ni pruebas.
function paginas(dir = "") {
  const lista = fs.existsSync(path.join(raiz, dir, "index.html")) ? [dir ? dir + "/" : ""] : [];
  for (const d of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith(".") || ["assets", "pruebas", "node_modules"].includes(d.name)) continue;
    lista.push(...paginas(dir ? dir + "/" + d.name : d.name));
  }
  return lista;
}
const todas = paginas().sort();
const herramientas = todas.filter(p => p.split("/").length === 3); // seccion/herramienta/
assert.ok(todas.includes("") && todas.includes("aviso-legal/"), "portada y aviso legal");
for (const s of SECCIONES) assert.ok(todas.includes(s + "/"), `falta el índice de ${s}`);
for (const p of ["trabajo/sueldo-neto/", "trabajo/prima-de-antiguedad/", "trabajo/aguinaldo-pensionados/",
  "trabajo/aguinaldo-gobierno/", "trabajo/cuando-pagan-el-aguinaldo/", "trabajo/salario-minimo-2027/", "trabajo/dias-festivos-2027/",
  "dinero/buen-fin/", "familia/pension-bienestar-adultos-mayores/", "familia/pension-mujeres-bienestar/",
  "familia/beca-benito-juarez/", "familia/beca-rita-cetina/", "impuestos/aguinaldo-isr/", "trabajo/uma-2027/",
  "impuestos/calculadora-iva/", "dinero/interes-compuesto/", "dinero/credito-automotriz/",
  "vivienda/credito-hipotecario-bancos/"]) assert.ok(todas.includes(p), `falta ${p}`);
assert.strictEqual(herramientas.length, 51, "51 calculadoras y guías");

// ---------- Reglas para cada página ----------
const titulos = new Map();
for (const p of todas) {
  const rel = p + "index.html";
  const html = leer(rel);
  assert.ok(html.startsWith("<!doctype html>") && html.includes('<html lang="es-MX">'), `${rel}: doctype y lang`);
  assert.ok(html.includes('name="viewport"'), `${rel}: viewport`);
  const titulo = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
  assert.ok(titulo, `${rel}: título`);
  assert.ok(!titulos.has(titulo), `${rel}: título repetido con ${titulos.get(titulo)}`);
  titulos.set(titulo, rel);
  if (p !== "aviso-legal/") {
    assert.ok(/<meta name="description" content="[^"]{50,}">/.test(html), `${rel}: descripción`);
    assert.ok(/sitio independiente/i.test(html), `${rel}: aviso de sitio independiente`);
    assert.ok(/No guardamos tus datos/.test(html), `${rel}: no guardamos tus datos`);
    assert.ok(html.includes("aviso-legal/"), `${rel}: enlace al aviso legal`);
  }
  assert.ok(!html.includes("—"), `${rel}: sin guiones largos`);
  assert.ok(!/<input[^>]+(curp|rfc|password|contrase)/i.test(html), `${rel}: no pide datos personales`);
  assert.ok(!/<form[^>]+action=/i.test(html), `${rel}: ningún formulario envía datos`);
  assert.ok(!/(fetch\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie)/.test(html), `${rel}: nada sale del navegador`);
  assert.ok(!/netlify\.app/.test(html), `${rel}: dominio viejo`);
  // Scripts sin dependencias externas
  for (const [, src] of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    assert.ok(!/^(https?:)?\/\//.test(src), `${rel}: script externo ${src}`);
  }
  // Enlaces y recursos internos: relativos y que existan
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|#|mailto:|tel:)/.test(url) || /['+$]/.test(url)) continue;
    assert.ok(!url.startsWith("/"), `${rel}: ruta absoluta ${url}`);
    const destino = path.join(raiz, p, url.split("#")[0].split("?")[0]);
    const existe = url.endsWith("/") || url === "./" ? fs.existsSync(path.join(destino, "index.html")) : fs.existsSync(destino);
    assert.ok(existe, `${rel}: no existe ${url}`);
  }
}

// ---------- Portada ----------
const portada = leer("index.html");
assert.ok(!/pr[oó]ximamente/i.test(portada), "portada: ya no dice Próximamente");
const enlacesPortada = new Set([...portada.matchAll(/href="([^"]+)"/g)].map(m => m[1]));
for (const s of SECCIONES) assert.ok(enlacesPortada.has(s + "/"), `portada: falta el índice ${s}/`);
for (const h of herramientas) assert.ok(enlacesPortada.has(h), `portada: falta ${h}`);
assert.strictEqual((portada.match(/data-seccion="/g) || []).length, 10, "portada: 10 secciones");
assert.strictEqual((portada.match(/<li data-k="/g) || []).length, herramientas.length, "portada: una entrada por herramienta");
assert.ok(portada.includes('src="assets/buscador.js"'), "portada: carga el buscador");
assert.ok(/<form class="buscar" id="buscador" role="search" hidden>/.test(portada), "portada: sin JavaScript el buscador no aparece");

// ---------- Buscador ----------
assert.strictEqual(B.normalizar("¿Cuánto me TOCA de Aguinaldo?"), "cuanto me toca de aguinaldo");
assert.strictEqual(B.normalizar("e.firma"), "e firma");
assert.deepStrictEqual(B.palabras("¿Cuánto me toca de aguinaldo 2026?"), ["toca", "aguinaldo"]);
assert.deepStrictEqual(B.formas("pensiones"), ["pensiones", "pension", "pensione"]);
const mini = ["Dinero y ahorro CETES vs. banco", "Trámites Credencial para votar del INE", "Familia Pensión alimenticia"];
assert.deepStrictEqual(B.buscar(mini, "ine").indices, [1], "ine no encuentra dinero");
assert.deepStrictEqual(B.buscar(mini, "pensiones").indices, [2], "plural");
assert.deepStrictEqual(B.buscar(mini, "cet").indices, [0], "inicio de palabra");
assert.strictEqual(B.buscar(mini, "").modo, "vacia");
assert.strictEqual(B.buscar(mini, "  ¿de la?  ").modo, "vacia", "solo palabras vacías");
assert.deepStrictEqual(B.buscar(mini, "credencial banco"), { modo: "alguna", indices: [0, 1], palabras: ["credencial", "banco"] });
assert.strictEqual(B.buscar(mini, "zzzz").modo, "ninguna");

// El buscador con las entradas reales de la portada: texto de la sección + texto visible + palabras extra.
const entradas = [];
for (const [, nombre, cuerpo] of portada.matchAll(/data-seccion="([^"]+)">([\s\S]*?)<\/ul>/g)) {
  for (const [, k, li] of cuerpo.matchAll(/<li data-k="([^"]*)">([\s\S]*?)<\/li>/g)) {
    entradas.push({ href: li.match(/href="([^"]+)"/)[1], texto: nombre + " " + li.replace(/<[^>]+>/g, " ") + " " + k });
  }
}
assert.strictEqual(entradas.length, herramientas.length);
const textos = entradas.map(e => e.texto);
const hrefs = q => B.buscar(textos, q).indices.map(i => entradas[i].href);
const casos = {
  "aguinaldo": "trabajo/aguinaldo/",
  "cuánto me toca de aguinaldo": "trabajo/aguinaldo/",
  "liquidación": "trabajo/finiquito/",
  "RFC": "impuestos/rfc/",
  "saldo a favor": "impuestos/declaracion-anual/",
  "resico": "impuestos/resico/",
  "cetes": "dinero/cetes-vs-bancos/",
  "afore": "retiro/afore/",
  "infonavit": "vivienda/credito-infonavit/",
  "INE": "tramites/ine/",
  "pasaporte": "tramites/pasaporte/",
  "hoy no circula": "auto/verificacion/",
  "recibo de luz": "casa/recibo-de-luz/",
  "gas": "casa/gas-lp/",
  "becas": "familia/becas/",
  "pensión alimenticia": "familia/pension-alimenticia/",
  "punto de equilibrio": "negocio/punto-de-equilibrio/",
  "aguinaldo pensionados": "trabajo/aguinaldo-pensionados/",
  "aguinaldo jubilados ISSSTE": "trabajo/aguinaldo-pensionados/",
  "aguinaldo pensión IMSS": "trabajo/aguinaldo-pensionados/",
  "aguinaldo maestros": "trabajo/aguinaldo-gobierno/",
  "aguinaldo burócratas": "trabajo/aguinaldo-gobierno/",
  "aguinaldo gobierno": "trabajo/aguinaldo-gobierno/",
  "cuándo pagan el aguinaldo": "trabajo/cuando-pagan-el-aguinaldo/",
  "no me pagaron el aguinaldo": "trabajo/cuando-pagan-el-aguinaldo/",
  "fecha límite aguinaldo": "trabajo/cuando-pagan-el-aguinaldo/",
  "profedet": "trabajo/cuando-pagan-el-aguinaldo/",
  "buen fin": "dinero/buen-fin/",
  "ofertas": "dinero/buen-fin/",
  "descuentos noviembre": "dinero/buen-fin/",
  "salario mínimo": "trabajo/salario-minimo-2027/",
  "salario mínimo 2027": "trabajo/salario-minimo-2027/",
  "aumento salario mínimo": "trabajo/salario-minimo-2027/",
  "conasami": "trabajo/salario-minimo-2027/",
  "días festivos": "trabajo/dias-festivos-2027/",
  "días festivos 2027": "trabajo/dias-festivos-2027/",
  "días de descanso obligatorio": "trabajo/dias-festivos-2027/",
  "pago triple": "trabajo/dias-festivos-2027/",
  "feriados": "trabajo/dias-festivos-2027/",
  "pensión adultos mayores": "familia/pension-bienestar-adultos-mayores/",
  "pensión bienestar 65 años": "familia/pension-bienestar-adultos-mayores/",
  "calendario pago pensión bienestar": "familia/pension-bienestar-adultos-mayores/",
  "pensión abuelos": "familia/pension-bienestar-adultos-mayores/",
  "mujeres bienestar": "familia/pension-mujeres-bienestar/",
  "pensión mujeres 60 a 64": "familia/pension-mujeres-bienestar/",
  "beca benito juárez": "familia/beca-benito-juarez/",
  "beca prepa": "familia/beca-benito-juarez/",
  "beca bachillerato": "familia/beca-benito-juarez/",
  "buscador de estatus": "familia/beca-benito-juarez/",
  "rita cetina": "familia/beca-rita-cetina/",
  "beca secundaria": "familia/beca-rita-cetina/",
  "beca primaria": "familia/beca-rita-cetina/",
  "registro beca rita cetina": "familia/beca-rita-cetina/",
  "isr aguinaldo": "impuestos/aguinaldo-isr/",
  "cuánto me quitan de ISR del aguinaldo": "impuestos/aguinaldo-isr/",
  "impuesto aguinaldo": "impuestos/aguinaldo-isr/",
  "artículo 174": "impuestos/aguinaldo-isr/",
  "uma": "trabajo/uma-2027/",
  "uma 2027": "trabajo/uma-2027/",
  "valor de la uma": "trabajo/uma-2027/",
  "unidad de medida y actualización": "trabajo/uma-2027/",
  "uma a pesos": "trabajo/uma-2027/",
  "iva": "impuestos/calculadora-iva/",
  "calculadora de iva": "impuestos/calculadora-iva/",
  "quitar iva": "impuestos/calculadora-iva/",
  "iva 8% frontera": "impuestos/calculadora-iva/",
  "desglosar iva": "impuestos/calculadora-iva/",
  "interés compuesto": "dinero/interes-compuesto/",
  "cuánto crece mi ahorro": "dinero/interes-compuesto/",
  "regla del 72": "dinero/interes-compuesto/",
  "crédito automotriz": "dinero/credito-automotriz/",
  "crédito para auto": "dinero/credito-automotriz/",
  "financiamiento carro": "dinero/credito-automotriz/",
  "mensualidad coche": "dinero/credito-automotriz/",
  "crédito hipotecario": "vivienda/credito-hipotecario-bancos/",
  "hipoteca": "vivienda/credito-hipotecario-bancos/",
  "hipoteca banco": "vivienda/credito-hipotecario-bancos/",
  "gastos notariales": "vivienda/credito-hipotecario-bancos/",
  "escrituras": "vivienda/credito-hipotecario-bancos/"
};
for (const [q, esperado] of Object.entries(casos)) assert.ok(hrefs(q).includes(esperado), `buscar "${q}" debe dar ${esperado}: ${hrefs(q)}`);
assert.ok(!hrefs("ine").some(h => h.startsWith("dinero/")), "ine no muestra la sección dinero");
assert.deepStrictEqual(hrefs("trabajo").filter(h => h.startsWith("trabajo/")).length, 13, "el nombre de la sección encuentra todas sus herramientas");
// En temporada de aguinaldo, cada búsqueda lleva primero a su página
assert.strictEqual(hrefs("aguinaldo pensionados")[0], "trabajo/aguinaldo-pensionados/");
assert.strictEqual(hrefs("aguinaldo maestros")[0], "trabajo/aguinaldo-gobierno/");
assert.strictEqual(hrefs("no me pagaron el aguinaldo")[0], "trabajo/cuando-pagan-el-aguinaldo/");
// Temporada de fin de año: Buen Fin, salario mínimo y días festivos
assert.strictEqual(hrefs("buen fin")[0], "dinero/buen-fin/");
assert.strictEqual(hrefs("salario mínimo 2027")[0], "trabajo/salario-minimo-2027/");
assert.strictEqual(hrefs("días festivos")[0], "trabajo/dias-festivos-2027/");
// Temporada de pensiones y becas del Bienestar
assert.strictEqual(hrefs("mujeres bienestar")[0], "familia/pension-mujeres-bienestar/");
assert.strictEqual(hrefs("rita cetina")[0], "familia/beca-rita-cetina/");
assert.ok(hrefs("pensión adultos mayores").indexOf("familia/pension-bienestar-adultos-mayores/") < 2, "adultos mayores entre los primeros");
// Temporada de aguinaldo: ISR del aguinaldo; todo el año: UMA e IVA
assert.strictEqual(hrefs("isr aguinaldo")[0], "impuestos/aguinaldo-isr/");
assert.strictEqual(hrefs("uma 2027")[0], "trabajo/uma-2027/");
assert.strictEqual(hrefs("calculadora de iva")[0], "impuestos/calculadora-iva/");
// Todo el año: interés compuesto, crédito automotriz y crédito hipotecario de bancos
assert.strictEqual(hrefs("interés compuesto")[0], "dinero/interes-compuesto/");
assert.strictEqual(hrefs("crédito automotriz")[0], "dinero/credito-automotriz/");
assert.strictEqual(hrefs("crédito hipotecario")[0], "vivienda/credito-hipotecario-bancos/");
assert.strictEqual(hrefs("hipoteca banco")[0], "vivienda/credito-hipotecario-bancos/");
assert.ok(hrefs("aguinaldo").includes("trabajo/aguinaldo/") && hrefs("aguinaldo")[0] === "trabajo/aguinaldo/", "aguinaldo sigue llevando primero a la calculadora");
assert.strictEqual(B.buscar(textos, "qwertyuiop").modo, "ninguna");

// ---------- Sitemap y robots ----------
const sitemap = leer("sitemap.xml");
assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), "sitemap: encabezado XML");
assert.ok(sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), "sitemap: urlset");
const locs = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>\d{4}-\d{2}-\d{2}<\/lastmod><\/url>/g)].map(m => m[1]);
assert.strictEqual(locs.length, (sitemap.match(/<url>/g) || []).length, "sitemap: cada url con lastmod");
assert.deepStrictEqual([...locs].sort(), todas.map(p => BASE + p).sort(), "sitemap: todas las páginas y solo ellas");
assert.strictEqual(new Set(locs).size, locs.length, "sitemap: sin repetidos");
const robots = leer("robots.txt");
assert.ok(robots.includes("Sitemap: " + BASE + "sitemap.xml"), "robots: sitemap");
assert.ok(!/Disallow: \/\s*$/m.test(robots), "robots: no bloquea el sitio");

// ---------- Datos para Google y vista previa en redes ----------
for (const p of todas) {
  const h = leer(p + "index.html");
  assert.strictEqual((h.match(/<!-- seo -->/g) || []).length, 1, `${p}: un solo bloque seo`);
  const canon = (h.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
  assert.strictEqual(canon, BASE + p, `${p}: canonical`);
  const img = (h.match(/<meta property="og:image" content="([^"]+)">/) || [])[1] || "";
  assert.ok(img.startsWith(BASE + "assets/compartir/"), `${p}: og:image en la base`);
  assert.ok(fs.existsSync(path.join(raiz, img.slice(BASE.length))), `${p}: existe la imagen ${img}`);
  const ld = (h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  assert.ok(ld && JSON.parse(ld)["@graph"].length >= 1, `${p}: datos estructurados válidos`);
}

// ---------- Botones para compartir ----------
const C = require("../assets/compartir.js");
assert.strictEqual(C.nombre("Calculadora de aguinaldo 2026: cuánto te toca | Cuentas Claras MX"), "Calculadora de aguinaldo 2026: cuánto te toca");
assert.strictEqual(C.nombre(""), "Cuentas Claras MX");
const ejemplo = C.enlaces("Calculadora de aguinaldo 2026 | Cuentas Claras MX", BASE + "trabajo/aguinaldo/");
assert.ok(ejemplo.whatsapp.startsWith("https://wa.me/?text="), "whatsapp: wa.me");
assert.ok(decodeURIComponent(ejemplo.whatsapp).endsWith(BASE + "trabajo/aguinaldo/"), "whatsapp: termina con el link");
assert.strictEqual(ejemplo.facebook, "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(BASE + "trabajo/aguinaldo/"));
for (const p of todas) {
  const h = leer(p + "index.html");
  const src = "../".repeat(p.split("/").filter(Boolean).length) + "assets/compartir.js";
  assert.ok(h.includes(`<script src="${src}" defer></script>`), `${p}: carga compartir.js`);
}
assert.ok(leer("llms.txt").startsWith("# Cuentas Claras MX"), "llms.txt");

console.log(`sitio.test.js: todas las pruebas pasaron (${todas.length} páginas revisadas)`);
