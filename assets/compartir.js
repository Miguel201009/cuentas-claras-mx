// Botones para compartir la página por WhatsApp, Facebook o copiando el link.
// Cada persona que la manda a un amigo o a un grupo trae más visitas sin que nadie tenga que publicar.
// En Node se puede leer con require para probar las funciones puras (pruebas/sitio.test.js).
(function (raiz) {
  // "Calculadora de aguinaldo 2026: cuánto te toca | Cuentas Claras MX" → "Calculadora de aguinaldo 2026: cuánto te toca"
  function nombre(titulo) {
    return String(titulo || "").split(" | ")[0].trim() || "Cuentas Claras MX";
  }

  function mensaje(titulo, url) {
    return `${nombre(titulo)}. Gratis y sin registro 👉 ${url}`;
  }

  function enlaces(titulo, url) {
    return {
      whatsapp: "https://wa.me/?text=" + encodeURIComponent(mensaje(titulo, url)),
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url)
    };
  }

  function poner(doc) {
    const pie = doc.querySelector("footer");
    if (!pie || doc.querySelector(".compartir")) return;
    const canon = doc.querySelector('link[rel="canonical"]');
    const url = canon ? canon.href : doc.location.href;
    const e = enlaces(doc.title, url);
    const caja = doc.createElement("section");
    caja.className = "compartir";
    caja.innerHTML =
      '<h2>¿Le sirve a alguien más?</h2>' +
      '<p class="nota">Mándasela a tu familia o a tu grupo del trabajo. Es gratis y no pide datos.</p>' +
      '<div class="botones">' +
      `<a class="boton wa" href="${e.whatsapp}" target="_blank" rel="noopener">Mandar por WhatsApp</a>` +
      `<a class="boton fb" href="${e.facebook}" target="_blank" rel="noopener">Compartir en Facebook</a>` +
      '<button class="boton copiar" type="button">Copiar link</button>' +
      '</div>';
    pie.parentNode.insertBefore(caja, pie);
    const copiar = caja.querySelector(".copiar");
    copiar.addEventListener("click", function () {
      const listo = () => { copiar.textContent = "¡Link copiado!"; };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(listo, () => {});
    });
  }

  const api = { nombre, mensaje, enlaces };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    raiz.Compartir = api;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => poner(document));
    else poner(document);
  }
})(typeof window !== "undefined" ? window : this);
