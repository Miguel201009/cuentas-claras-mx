// Buscador de la portada de Cuentas Claras MX: filtra la lista de calculadoras y guías por texto.
// Sin dependencias y sin enviar nada a ningún lado: todo pasa en el navegador de la persona.
// En Node se puede leer con require para probar las funciones puras (pruebas/sitio.test.js).
(function (raiz) {
  // Palabras que no ayudan a buscar ("cuánto me toca de aguinaldo" se busca como "toca aguinaldo").
  const VACIAS = new Set(("a al como con cual cuales cuando cuanto cuanta cuantos cuantas de del donde el en es " +
    "hay la las le les lo los me mi mis o para por que quiero se si su sus te tu tus u un una unos unas y ya yo " +
    "2025 2026 2027").split(" "));

  // Minúsculas, sin acentos y sin signos: "¿Cuánto?" y "cuanto" son lo mismo.
  function normalizar(texto) {
    return String(texto == null ? "" : texto)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  // Palabras útiles de lo que escribió la persona.
  function palabras(consulta) {
    return normalizar(consulta).split(" ").filter(p => p && !VACIAS.has(p));
  }

  // Formas de una palabra para que "pensiones" encuentre "pension" y "prestamos" encuentre "prestamo".
  function formas(p) {
    const f = [p];
    if (p.length > 4 && p.endsWith("es")) f.push(p.slice(0, -2));
    if (p.length > 3 && p.endsWith("s")) f.push(p.slice(0, -1));
    return f;
  }

  // ¿Alguna palabra del texto empieza con esa palabra (o una de sus formas)? "aguin" encuentra "aguinaldo",
  // pero "ine" no encuentra "dinero".
  function aparece(p, palabrasTexto) {
    const f = formas(p);
    return palabrasTexto.some(t => f.some(x => t.startsWith(x)));
  }

  // Busca en una lista de textos. Devuelve { modo, indices, palabras }:
  // modo "vacia": no hay nada que buscar (se muestra todo);
  // modo "todas": textos que tienen todas las palabras;
  // modo "alguna": ninguno las tiene todas, así que se muestran los que tienen al menos una, los que más tienen primero;
  // modo "ninguna": nada coincide.
  function buscar(textos, consulta) {
    const ps = palabras(consulta);
    if (!ps.length) return { modo: "vacia", indices: textos.map((_, i) => i), palabras: ps };
    const listas = textos.map(t => normalizar(t).split(" "));
    const aciertos = listas.map(l => ps.filter(p => aparece(p, l)).length);
    const todas = aciertos.map((n, i) => n === ps.length ? i : -1).filter(i => i >= 0);
    if (todas.length) return { modo: "todas", indices: todas, palabras: ps };
    const alguna = aciertos.map((n, i) => n > 0 ? i : -1).filter(i => i >= 0)
      .sort((a, b) => aciertos[b] - aciertos[a] || a - b);
    return { modo: alguna.length ? "alguna" : "ninguna", indices: alguna, palabras: ps };
  }

  function plural(n, uno, varios) {
    return n + " " + (n === 1 ? uno : varios);
  }

  // Conecta el buscador con la página. Espera un formulario #buscador con un campo #q, un párrafo #estado
  // y bloques [data-seccion] con una lista de herramientas (li, con palabras extra en data-k).
  function iniciar(doc) {
    const form = doc.getElementById("buscador");
    const q = doc.getElementById("q");
    const estado = doc.getElementById("estado");
    if (!form || !q || !estado) return;
    const secciones = Array.from(doc.querySelectorAll("[data-seccion]"));
    const items = [];
    secciones.forEach(sec => {
      sec.querySelectorAll("li").forEach(li => {
        items.push({ li, texto: sec.getAttribute("data-seccion") + " " + li.textContent + " " + (li.getAttribute("data-k") || "") });
      });
    });
    const textos = items.map(it => it.texto);
    const resumen = "Hay " + plural(items.length, "calculadora o guía", "calculadoras y guías") +
      " en " + plural(secciones.length, "sección", "secciones") + ".";

    function aplicar() {
      const r = buscar(textos, q.value);
      const visibles = new Set(r.indices);
      items.forEach((it, i) => { it.li.hidden = r.modo !== "vacia" && !visibles.has(i); });
      secciones.forEach(sec => { sec.hidden = r.modo !== "vacia" && !sec.querySelector("li:not([hidden])"); });
      const dicho = "“" + q.value.trim() + "”";
      if (r.modo === "vacia") estado.textContent = resumen;
      else if (r.modo === "todas") estado.textContent = plural(r.indices.length, "resultado", "resultados") + " para " + dicho + ".";
      else if (r.modo === "alguna") estado.textContent = "No encontramos todas las palabras de " + dicho + ". Esto es lo más parecido: " + plural(r.indices.length, "resultado", "resultados") + ".";
      else estado.textContent = "No encontramos nada con " + dicho + ". Prueba con otra palabra, por ejemplo aguinaldo, impuestos, luz o pasaporte.";
    }

    form.hidden = false;
    form.addEventListener("submit", e => e.preventDefault());
    q.addEventListener("input", aplicar);
    q.addEventListener("search", aplicar);
    q.addEventListener("keydown", e => { if (e.key === "Escape") { q.value = ""; aplicar(); } });
    // Si la dirección trae ?q=palabra, se busca al abrir la página.
    let inicial = "";
    try { inicial = new URLSearchParams(raiz.location.search).get("q") || ""; } catch (e) { inicial = ""; }
    if (inicial) q.value = inicial.slice(0, 80);
    aplicar();
  }

  const Buscador = { normalizar, palabras, formas, buscar, iniciar };
  if (typeof module !== "undefined" && module.exports) module.exports = Buscador;
  else {
    raiz.Buscador = Buscador;
    if (raiz.document) {
      if (raiz.document.readyState === "loading") raiz.document.addEventListener("DOMContentLoaded", () => iniciar(raiz.document));
      else iniciar(raiz.document);
    }
  }
})(typeof window !== "undefined" ? window : this);
