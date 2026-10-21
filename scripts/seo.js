// Agrega a cada página la dirección canónica, la vista previa para redes y los datos estructurados.
// Uso: node scripts/seo.js [BASE]   (BASE por defecto: la dirección de GitHub Pages)
// Con --imagenes también genera la imagen de vista previa de cada página (necesita Playwright).
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const BASE = (process.argv.slice(2).find(a => !a.startsWith("--")) || "https://miguel201009.github.io/cuentas-claras-mx/").replace(/\/?$/, "/");
const IMAGENES = process.argv.includes("--imagenes");
const HOY = new Date().toISOString().slice(0, 10);

function paginas(dir = RAIZ, rel = "") {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || ["assets", "pruebas", "scripts", "node_modules"].includes(e.name)) continue;
    if (e.isDirectory()) out = out.concat(paginas(path.join(dir, e.name), rel + e.name + "/"));
    else if (e.name === "index.html") out.push(rel);
  }
  return out.sort();
}

const sinEtiquetas = s => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const decodificar = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = s => decodificar(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function datosDe(rel, html) {
  const url = BASE + rel;
  const titulo = decodificar((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "Cuentas Claras MX");
  const desc = decodificar((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "");
  const h1 = decodificar(sinEtiquetas((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || titulo));
  const migas = [{ nombre: "Inicio", url: BASE }];
  const m = html.match(/<span class="migas">([\s\S]*?)<\/span><\/div>/);
  if (m) {
    const partes = m[1].split("›").map(p => p.trim());
    partes.slice(1).forEach((p, i) => {
      const a = p.match(/<a href="([^"]*)">([\s\S]*?)<\/a>/);
      if (a) migas.push({ nombre: decodificar(sinEtiquetas(a[2])), url: new URL(a[1], url).href });
      else if (i === partes.length - 2) migas.push({ nombre: decodificar(sinEtiquetas(p)), url });
    });
  }
  const esCalculadora = /class="tool"/.test(html);
  const slug = rel ? rel.replace(/\/$/, "").replace(/\//g, "-") : "inicio";
  const seccion = migas[1] ? migas[1].nombre : "";
  return { rel, url, titulo, ogTitulo: titulo.replace(/\s*\|\s*Cuentas Claras MX$/, ""), desc, h1, migas, esCalculadora, slug, seccion };
}

function bloque(d) {
  const imagen = BASE + "assets/compartir/" + d.slug + ".png";
  const grafo = [];
  if (!d.rel) {
    grafo.push({ "@type": "WebSite", "@id": BASE + "#sitio", name: "Cuentas Claras MX", url: BASE, inLanguage: "es-MX", description: d.desc });
  } else {
    grafo.push({ "@type": "BreadcrumbList", itemListElement: d.migas.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.nombre, item: x.url })) });
  }
  grafo.push(d.esCalculadora
    ? { "@type": "WebApplication", name: d.h1, url: d.url, description: d.desc, applicationCategory: "FinanceApplication", operatingSystem: "Web", inLanguage: "es-MX", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "MXN" } }
    : { "@type": "WebPage", name: d.h1, url: d.url, description: d.desc, inLanguage: "es-MX", isPartOf: { "@id": BASE + "#sitio" } });
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": grafo }).replace(/</g, "\\u003c");
  return [
    "<!-- seo -->",
    `<link rel="canonical" href="${attr(d.url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Cuentas Claras MX">`,
    `<meta property="og:locale" content="es_MX">`,
    `<meta property="og:title" content="${attr(d.ogTitulo)}">`,
    `<meta property="og:description" content="${attr(d.desc)}">`,
    `<meta property="og:url" content="${attr(d.url)}">`,
    `<meta property="og:image" content="${attr(imagen)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<script type="application/ld+json">${json}</script>`,
    `<script src="${"../".repeat(d.rel.split("/").filter(Boolean).length)}assets/compartir.js" defer></script>`,
    "<!-- /seo -->"
  ].join("\n");
}

function plantillaImagen(d) {
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#f6f7f4;font-family:system-ui,sans-serif;color:#17231f;padding:64px 72px;display:flex;flex-direction:column;border-bottom:18px solid #0f5c4c}
.logo{font-weight:800;font-size:38px;color:#0f5c4c}.logo span{color:#c47208}
.tag{margin-top:52px;align-self:flex-start;font:600 26px ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;background:#fdf0dc;color:#9a5804;padding:8px 18px;border-radius:99px}
h1{margin-top:22px;font-size:${d.h1.length > 44 ? 62 : 76}px;line-height:1.05;font-weight:800;letter-spacing:-1.5px;max-width:1000px}
.pie{margin-top:auto;font-size:30px;color:#5b6863}.pie b{color:#0f5c4c}
</style></head><body><div class="logo">Cuentas Claras <span>MX</span></div>
${d.seccion ? `<div class="tag">${esc(d.seccion)}</div>` : `<div class="tag">México</div>`}
<h1>${esc(d.rel ? d.h1 : "Calculadoras y guías gratis para tu dinero, trabajo y trámites")}</h1>
<div class="pie"><b>Gratis y sin registro</b> · con la ley citada en cada página</div></body></html>`;
}

async function main() {
  const todas = paginas().map(rel => {
    const archivo = path.join(RAIZ, rel, "index.html");
    let html = fs.readFileSync(archivo, "utf8");
    const d = datosDe(rel, html);
    html = html.replace(/\n?<!-- seo -->[\s\S]*?<!-- \/seo -->/, "");
    html = html.replace("</head>", bloque(d) + "\n</head>");
    fs.writeFileSync(archivo, html);
    return d;
  });

  const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    .concat(todas.map(d => `  <url><loc>${d.url}</loc><lastmod>${HOY}</lastmod></url>`), ["</urlset>", ""]).join("\n");
  fs.writeFileSync(path.join(RAIZ, "sitemap.xml"), sitemap);
  fs.writeFileSync(path.join(RAIZ, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${BASE}sitemap.xml\n`);

  // llms.txt: lista corta de páginas para que asistentes como ChatGPT o Perplexity entiendan el sitio y lo citen.
  const porSeccion = new Map();
  for (const d of todas.filter(d => d.rel && d.rel !== "aviso-legal/")) {
    const s = d.seccion && d.migas.length > 2 ? d.seccion : "Secciones";
    if (!porSeccion.has(s)) porSeccion.set(s, []);
    porSeccion.get(s).push(`- [${d.ogTitulo}](${d.url}): ${d.desc}`);
  }
  const llms = ["# Cuentas Claras MX", "",
    "> Calculadoras y guías gratis para cualquier persona en México: trabajo, impuestos del SAT, dinero, retiro e IMSS, vivienda, trámites, auto, casa, familia y negocio. Cada cifra cita la ley o la fuente oficial. Sitio independiente, no es del gobierno.", ""];
  for (const [s, lineas] of porSeccion) llms.push(`## ${s}`, "", ...lineas, "");
  fs.writeFileSync(path.join(RAIZ, "llms.txt"), llms.join("\n"));

  if (IMAGENES) {
    const { chromium } = require("playwright");
    const dir = path.join(RAIZ, "assets", "compartir");
    fs.mkdirSync(dir, { recursive: true });
    const nav = await chromium.launch();
    const p = await nav.newPage({ viewport: { width: 1200, height: 630 } });
    for (const d of todas) {
      await p.setContent(plantillaImagen(d));
      await p.screenshot({ path: path.join(dir, d.slug + ".png") });
    }
    await nav.close();
  }
  console.log(`${todas.length} páginas listas con base ${BASE}${IMAGENES ? " (con imágenes)" : ""}`);
}

main().catch(e => { console.error(e); process.exit(1); });
