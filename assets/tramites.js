// Trámites de Cuentas Claras MX: costo del pasaporte, vigencia de la credencial para votar y portales
// de licencias de manejo por estado. Funciones puras, sin datos personales: todo se calcula en el navegador.
// En el navegador carga antes ../../assets/calc.js (de ahí sale mxn() para el formato de pesos).
(function (raiz) {
  const DIA = 864e5;

  const DATOS = {
    anio: 2026,
    revisado: "octubre de 2026",

    pasaporte: {
      // Art. 20 de la Ley Federal de Derechos (LFD), cuotas en territorio nacional vigentes del 1 ene al
      // 31 dic 2026, tal como las publica la SRE en gob.mx/pasaporte. Confirmadas en varias fuentes
      // secundarias que citan a la SRE (Informador 2 ene 2026, El Financiero 7 ene 2026, Infobae 25 dic 2025,
      // El Universal). Pendiente cotejar contra gob.mx/pasaporte y el texto de la LFD (sitios oficiales
      // bloqueados desde nuestra red).
      cuotas: { 1: 920, 3: 1795, 6: 2440, 10: 4280 },
      // Montos con 50% de descuento como los publica la SRE (redondeados a pesos: el de 3 años es $900,
      // no $897.50). Mismas fuentes que arriba.
      conDescuento: { 1: 460, 3: 900, 6: 1220, 10: 2140 },
      // Vigencias según la edad. Solo aplicamos las dos reglas que coinciden en todas las fuentes (tabla de
      // cuotas de la SRE): el de 1 año es solo para menores de 3 años y el de 10 años solo para mayores de edad.
      // El Reglamento de Pasaportes y del Documento de Identidad y Viaje y páginas de consulados de la SRE
      // (vistas en resultados de búsqueda, oct 2026) dicen además: menores de 3 años, 1 o 3 años; de 3 a 17,
      // 3 o 6 años. Las versiones del reglamento que encontramos se contradicen sobre los menores de 3 años,
      // así que el de 6 años para menores de 3 queda "por confirmar con la SRE" (se calcula, con aviso).
      edadBebe: 3,
      mayoriaEdad: 18,
      // Art. 20 LFD: 50% para "personas mayores de sesenta años", personas con discapacidad comprobada y
      // trabajadores agrícolas temporales contratados en el extranjero (este último solo hasta 6 años de
      // vigencia). Texto citado por leyes-mx.com y consulados de la SRE; no lo pudimos cotejar en el DOF.
      // No está claro si quien tiene justo 60 años cumplidos ya entra: lo calculamos con descuento y avisamos.
      edadDescuento: 60,
      vigenciasAgricola: [3, 6]
    },

    ine: {
      // La credencial dura 10 años, contados a partir del año de su emisión (art. 156 de la Ley General de
      // Instituciones y Procedimientos Electorales, texto citado por Justia y mley.mx; diputados.gob.mx bloqueado
      // desde nuestra red). Sirve hasta el 31 de diciembre del año de vigencia que trae impreso.
      vigenciaAnios: 10,
      // Proceso electoral federal 2026-2027. Jornada electoral: domingo 6 de junio de 2027.
      eleccion: "2027-06-06",
      // Campaña Anual Intensa 2026-2027 del INE (1 sep 2026 al 25 ene 2027): último día para inscribirte,
      // renovar, corregir datos o cambiar domicilio y aparecer en la lista nominal de 2027.
      // Comunicados en Central Electoral (INE) del 31 ago, 1 sep y 17 oct de 2026 ("A 100 días de la conclusión del
      // plazo..."), vistos en resultados de búsqueda porque el sitio no abrió desde nuestra red.
      // Pendiente cotejar con el acuerdo del Consejo General del INE.
      limiteTramites: "2027-01-25"
    }
  };

  // Número válido o null. Vacío, texto, NaN o infinito no cuentan.
  function numero(x) {
    if (x === "" || x === null || x === undefined || typeof x === "boolean") return null;
    const n = +x;
    return Number.isFinite(n) ? n : null;
  }

  function fecha(texto) {
    const d = new Date(texto + "T00:00:00");
    return isNaN(d) ? null : d;
  }

  // ---------------------------------------------------------------- Pasaporte

  // Edad en años cumplidos (entero). Devuelve { edad } o { error } con un mensaje para la página.
  function leerEdad(valor) {
    const n = numero(valor);
    if (n === null) return { error: "Escribe la edad de la persona que va a sacar el pasaporte." };
    if (n < 0) return { error: "La edad no puede ser negativa." };
    if (n > 120) return { error: "Revisa la edad: escribe los años cumplidos." };
    return { edad: Math.floor(n) };
  }

  // Vigencias que se pueden pedir con esa edad, según las dos reglas seguras:
  // 1 año solo para menores de 3; 10 años solo para mayores de edad.
  function vigenciasPasaporte(edad) {
    const p = DATOS.pasaporte;
    if (edad < p.edadBebe) return [1, 3, 6];
    if (edad < p.mayoriaEdad) return [3, 6];
    return [3, 6, 10];
  }

  // true si esa vigencia, con esa edad, está pendiente de confirmar con la SRE (6 años para menores de 3).
  function vigenciaPorConfirmar(edad, vigencia) {
    return edad < DATOS.pasaporte.edadBebe && vigencia === 6;
  }

  // Si la vigencia pedida no se permite para esa edad, usa la más larga de las "seguras" que no pase de ella
  // (o la más corta si todas son mayores). Una vigencia por confirmar solo se usa si la persona la eligió.
  function ajustarVigencia(pedida, permitidas, seguras = permitidas) {
    const v = numero(pedida);
    if (v !== null && permitidas.includes(v)) return { vigencia: v, ajustada: false };
    const menores = seguras.filter(x => v !== null && x <= v);
    return { vigencia: menores.length ? menores[menores.length - 1] : seguras[0], ajustada: true };
  }

  // Por qué toca el 50% de descuento con esa edad, motivo y vigencia, o null si no toca.
  // Con justo 60 años cumplidos también lo damos como "adulto mayor", pero costoPasaporte() avisa que se confirme.
  function razonDescuento(edad, motivo, vigencia) {
    const p = DATOS.pasaporte;
    if (edad > p.edadDescuento) return "adulto mayor";
    if (motivo === "discapacidad") return "discapacidad";
    // Solo adultos: la Ley Federal del Trabajo (art. 29) prohíbe que menores de 18 trabajen fuera del país.
    if (motivo === "agricola" && edad >= p.mayoriaEdad && p.vigenciasAgricola.includes(vigencia)) return "trabajador agrícola";
    if (edad === p.edadDescuento) return "adulto mayor";
    return null;
  }

  const anios = v => v + (v === 1 ? " año" : " años");

  // Por qué cambiamos la vigencia que pidió la persona.
  function textoAjuste(edad, pedida, v, permitidas) {
    const p = DATOS.pasaporte;
    if (pedida === 10 && edad < p.mayoriaEdad) return `El pasaporte de 10 años es solo para mayores de edad. Calculamos el de ${anios(v)}.`;
    if (pedida === 1 && edad >= p.edadBebe) return `El pasaporte de 1 año es solo para menores de 3 años. Calculamos el de ${anios(v)}.`;
    return `Elige ${lista(permitidas)} años. Calculamos el de ${anios(v)}.`;
  }

  // Costo del pasaporte ordinario en México (oficinas de la SRE), 2026.
  // motivo: "ninguno", "discapacidad" o "agricola" (trabajador agrícola temporal en Canadá; solo adultos).
  // Por edad, el descuento se aplica solo (con aviso si tiene justo 60). Los descuentos no se suman: el máximo es 50%.
  function costoPasaporte({ edad, vigencia = 10, motivo = "ninguno" }) {
    const e = leerEdad(edad);
    if (e.error) return { ok: false, error: e.error };
    const p = DATOS.pasaporte;
    const permitidas = vigenciasPasaporte(e.edad);
    const seguras = permitidas.filter(x => !vigenciaPorConfirmar(e.edad, x));
    const aj = ajustarVigencia(vigencia, permitidas, seguras);
    const v = aj.vigencia;
    const normal = p.cuotas[v];
    const avisos = [];

    const razon = razonDescuento(e.edad, motivo, v);
    const descuento = razon !== null;
    const aPagar = descuento ? p.conDescuento[v] : normal;

    if (aj.ajustada) avisos.push(textoAjuste(e.edad, numero(vigencia), v, permitidas));
    if (vigenciaPorConfirmar(e.edad, v)) {
      avisos.push("Las oficinas de la SRE suelen dar a menores de 3 años pasaporte de 1 o 3 años. Antes de pagar el de 6 años, confirma con la SRE al sacar tu cita que lo puedes pedir.");
    }
    if (razon === "adulto mayor" && e.edad === p.edadDescuento) {
      avisos.push("La ley habla de personas “mayores de sesenta años”. Con 60 años cumplidos, confirma el descuento al sacar tu cita. Si no te lo aplican, pagas el precio normal.");
    }
    if (motivo === "agricola" && !descuento) {
      avisos.push(e.edad < p.mayoriaEdad
        ? "El descuento para trabajadores agrícolas temporales en Canadá es solo para personas mayores de edad."
        : "El descuento para trabajadores agrícolas en Canadá solo aplica en pasaportes de 3 o 6 años.");
    }

    const comparar = permitidas.map(x => {
      const costo = razonDescuento(e.edad, motivo, x) ? p.conDescuento[x] : p.cuotas[x];
      return { vigencia: x, costo, porAnio: costo / x, porConfirmar: vigenciaPorConfirmar(e.edad, x) };
    });
    // La más barata por año, sin contar las que están por confirmar.
    const masBarata = comparar.filter(c => !c.porConfirmar).reduce((a, b) => (b.porAnio < a.porAnio ? b : a));

    return {
      ok: true, edad: e.edad, vigencia: v, vigenciaAjustada: aj.ajustada, permitidas, motivo,
      normal, descuento, razon, aPagar, ahorro: normal - aPagar, porAnio: aPagar / v,
      porConfirmar: vigenciaPorConfirmar(e.edad, v), comparar, masBarata, avisos
    };
  }

  function lista(xs) {
    if (xs.length === 1) return String(xs[0]);
    return xs.slice(0, -1).join(", ") + " o " + xs[xs.length - 1];
  }

  // ---------------------------------------------------------------- Credencial para votar

  // anio: el año de vigencia impreso en la credencial (si trae dos, el último). hoy: Date.
  function vigenciaCredencial({ anio, hoy = new Date() }) {
    const n = numero(anio);
    const anioHoy = hoy.getFullYear();
    if (n === null) return { ok: false, error: "Escribe el año de vigencia que viene en tu credencial." };
    if (!Number.isInteger(n)) return { ok: false, error: "Escribe solo el año, con cuatro números. Por ejemplo: 2029." };
    if (n < 1990 || n > 9999) return { ok: false, error: "Revisa el año: escríbelo con cuatro números, por ejemplo 2029." };
    if (n > anioHoy + DATOS.ine.vigenciaAnios) {
      return { ok: false, error: `Revisa el año: una credencial sacada este año dura hasta ${anioHoy + DATOS.ine.vigenciaAnios}.` };
    }
    const hasta = new Date(n, 11, 31);
    const finVigencia = new Date(n + 1, 0, 1); // deja de servir este día
    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const vigente = hoy0 < finVigencia;
    const diasRestantes = vigente ? Math.round((finVigencia - hoy0) / DIA) : 0;
    // Días desde que dejó de servir (0 el mismo 1 de enero).
    const diasVencida = vigente ? 0 : Math.round((hoy0 - finVigencia) / DIA);
    // Cuánto tiempo lleva vencida: "Desde hoy", en días hasta 60 y después en años y meses.
    const vencidaTexto = vigente ? ""
      : diasVencida === 0 ? "Desde hoy"
      : diasVencida <= 60 ? diasVencida + (diasVencida === 1 ? " día" : " días")
      : tiempoTexto(finVigencia, hoy0);

    const eleccion = fecha(DATOS.ine.eleccion);
    const limite = fecha(DATOS.ine.limiteTramites);
    let votar = null;
    if (hoy0 <= eleccion) {
      const sirve = n >= eleccion.getFullYear();
      votar = { fecha: eleccion, sirve, limite, aTiempo: hoy0 <= limite };
    }
    return {
      ok: true, anio: n, hasta, finVigencia, vigente, diasRestantes, diasVencida, vencidaTexto,
      tiempo: tiempoTexto(hoy0, finVigencia), votar
    };
  }

  // Texto corto con años y meses entre dos fechas (a < b), o días si falta menos de un mes.
  function tiempoTexto(a, b) {
    if (b <= a) return "";
    let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) meses--;
    if (meses < 1) {
      const d = Math.round((b - a) / DIA);
      return d + (d === 1 ? " día" : " días");
    }
    const anios = Math.floor(meses / 12), resto = meses % 12;
    const partes = [];
    if (anios) partes.push(anios + (anios === 1 ? " año" : " años"));
    if (resto) partes.push(resto + (resto === 1 ? " mes" : " meses"));
    return partes.join(" y ");
  }

  // ---------------------------------------------------------------- Licencias de manejo por estado

  // tipo: "licencias" = página de licencias del gobierno estatal que encontramos en su propio dominio .gob.mx;
  //       "dependencia" = sitio de la dependencia estatal que expide licencias;
  //       "catalogo" = catálogo oficial de trámites del estado (busca "licencia de conducir");
  //       "estatal" = portal general del gobierno del estado (no pudimos confirmar la página exacta de licencias).
  // Enlaces encontrados en octubre de 2026 con buscadores. Ninguno se abrió: los sitios .gob.mx no se pudieron
  // abrir desde nuestra red, así que cada enlace está pendiente de abrirse a mano para confirmar que sigue activo
  // y que lleva a la página que dice su tipo.
  const ESTADOS = [
    { clave: "ags", nombre: "Aguascalientes", tipo: "licencias", dependencia: "Secretaría de Seguridad Pública del Estado", url: "https://tramites.aguascalientes.gob.mx/tramite/EDO-SSP-10" },
    { clave: "bc", nombre: "Baja California", tipo: "licencias", dependencia: "Recaudación de Rentas del Estado", url: "https://retys.bajacalifornia.gob.mx/Portal/TyS/661" },
    { clave: "bcs", nombre: "Baja California Sur", tipo: "catalogo", dependencia: "", url: "https://tramites.bcs.gob.mx/servicios/" },
    { clave: "camp", nombre: "Campeche", tipo: "licencias", dependencia: "Secretaría de Protección y Seguridad Ciudadana (SPSC)", url: "https://www.spsc.campeche.gob.mx/licencias-de-conducir/" },
    { clave: "chis", nombre: "Chiapas", tipo: "licencias", dependencia: "Secretaría de Hacienda del Estado", url: "https://chiapas.gob.mx/servicios/3260" },
    { clave: "chih", nombre: "Chihuahua", tipo: "licencias", dependencia: "Secretaría de Seguridad Pública del Estado (SSPE)", url: "https://sspe.chihuahua.gob.mx/licencias/" },
    { clave: "cdmx", nombre: "Ciudad de México", tipo: "licencias", dependencia: "Secretaría de Movilidad (SEMOVI)", url: "https://semovi.cdmx.gob.mx/tramites-y-servicios/vehiculos-particulares/licencias_menu" },
    { clave: "coah", nombre: "Coahuila", tipo: "licencias", dependencia: "Secretaría de Infraestructura, Desarrollo Urbano y Movilidad", url: "https://www.tramitescoahuila.gob.mx/tramites/secretar%C3%ADa-de-infraestructura,-desarrollo-urbano-y-movilidad/emisi%C3%B3n-de-licencias-de-conducir.html" },
    { clave: "col", nombre: "Colima", tipo: "licencias", dependencia: "Movilidad del Gobierno del Estado (Semov)", url: "https://semov.col.gob.mx/index.php/detalle/contenido/NjU4Mw==" },
    { clave: "dgo", nombre: "Durango", tipo: "licencias", dependencia: "Secretaría de Finanzas y de Administración", url: "https://www.durango.gob.mx/tramites-y-servicios/secretarias/secretaria_de_finanzas__y_de_administracion/licencia_de_conducir_automovilista_autocamioneta_y_motociclista_servicio_particular_por_primera_vez" },
    { clave: "gto", nombre: "Guanajuato", tipo: "licencias", dependencia: "Secretaría de Seguridad y Paz", url: "https://seguridad.guanajuato.gob.mx/licencias_conducir/modulos-licencias/" },
    { clave: "gro", nombre: "Guerrero", tipo: "estatal", dependencia: "", url: "https://www.guerrero.gob.mx/", nota: "En Guerrero también hay municipios que expiden licencias. Desconfía de páginas que las venden por internet o por WhatsApp sin examen." },
    { clave: "hgo", nombre: "Hidalgo", tipo: "catalogo", dependencia: "Secretaría de Seguridad Pública del Estado", url: "https://ruts.hidalgo.gob.mx/" },
    { clave: "jal", nombre: "Jalisco", tipo: "licencias", dependencia: "Secretaría de Transporte (SETRAN)", url: "https://setran.jalisco.gob.mx/tramite-de-licencias-de-conducir" },
    { clave: "mex", nombre: "Estado de México", tipo: "dependencia", dependencia: "Secretaría de Movilidad (SEMOV)", url: "https://smovilidad.edomex.gob.mx/" },
    { clave: "mich", nombre: "Michoacán", tipo: "estatal", dependencia: "", url: "https://michoacan.gob.mx/" },
    { clave: "mor", nombre: "Morelos", tipo: "estatal", dependencia: "", url: "https://morelos.gob.mx/" },
    { clave: "nay", nombre: "Nayarit", tipo: "estatal", dependencia: "", url: "https://www.nayarit.gob.mx/" },
    { clave: "nl", nombre: "Nuevo León", tipo: "estatal", dependencia: "", url: "https://www.nl.gob.mx/" },
    { clave: "oax", nombre: "Oaxaca", tipo: "estatal", dependencia: "", url: "https://www.oaxaca.gob.mx/" },
    { clave: "pue", nombre: "Puebla", tipo: "estatal", dependencia: "", url: "https://www.puebla.gob.mx/" },
    { clave: "qro", nombre: "Querétaro", tipo: "estatal", dependencia: "", url: "https://www.queretaro.gob.mx/" },
    { clave: "qroo", nombre: "Quintana Roo", tipo: "estatal", dependencia: "", url: "https://qroo.gob.mx/" },
    { clave: "slp", nombre: "San Luis Potosí", tipo: "estatal", dependencia: "", url: "https://slp.gob.mx/" },
    { clave: "sin", nombre: "Sinaloa", tipo: "estatal", dependencia: "", url: "https://sinaloa.gob.mx/" },
    { clave: "son", nombre: "Sonora", tipo: "estatal", dependencia: "", url: "https://www.sonora.gob.mx/" },
    { clave: "tab", nombre: "Tabasco", tipo: "estatal", dependencia: "", url: "https://tabasco.gob.mx/" },
    { clave: "tamps", nombre: "Tamaulipas", tipo: "licencias", dependencia: "Secretaría de Finanzas del Estado", url: "https://finanzas.tamaulipas.gob.mx/pago-de-contribuciones/licencia-de-conducir/realizar-tramite.php" },
    { clave: "tlax", nombre: "Tlaxcala", tipo: "estatal", dependencia: "", url: "https://www.tlaxcala.gob.mx/" },
    { clave: "ver", nombre: "Veracruz", tipo: "estatal", dependencia: "", url: "https://www.veracruz.gob.mx/" },
    { clave: "yuc", nombre: "Yucatán", tipo: "estatal", dependencia: "", url: "https://www.yucatan.gob.mx/" },
    { clave: "zac", nombre: "Zacatecas", tipo: "estatal", dependencia: "", url: "https://www.zacatecas.gob.mx/" }
  ];

  const TEXTO_TIPO = {
    licencias: "Según nuestra búsqueda, es la página de licencias del gobierno del estado. No pudimos abrirla para confirmarlo: si no abre, busca “licencia de conducir” en el portal del gobierno de tu estado.",
    dependencia: "Es el sitio de la dependencia estatal que expide las licencias. Busca la sección de licencias.",
    catalogo: "Es el catálogo oficial de trámites del estado. Busca “licencia de conducir”.",
    estatal: "Es el portal oficial del gobierno del estado. Busca “licencia de conducir”: no pudimos confirmar la página exacta de licencias."
  };

  // Qué tipo de sitio es, para la etiqueta del resultado.
  const ETIQUETA_TIPO = {
    licencias: "Página de licencias del estado",
    dependencia: "Sitio de la dependencia que da las licencias",
    catalogo: "Catálogo de trámites del estado",
    estatal: "Portal del gobierno del estado"
  };

  // Datos del portal de un estado por su clave, o null si la clave no existe.
  function portalLicencia(clave) {
    const e = ESTADOS.find(x => x.clave === clave);
    if (!e) return null;
    return Object.assign({ descripcion: TEXTO_TIPO[e.tipo], etiqueta: ETIQUETA_TIPO[e.tipo], dominio: new URL(e.url).hostname }, e);
  }

  // Estados en orden alfabético (para el selector). "Estado de México" se ordena como "México".
  function estadosOrdenados() {
    const llave = e => e.nombre.replace(/^Estado de /, "");
    return ESTADOS.slice().sort((a, b) => llave(a).localeCompare(llave(b), "es"));
  }

  const api = {
    DATOS, ESTADOS, TEXTO_TIPO, ETIQUETA_TIPO, leerEdad, vigenciasPasaporte, vigenciaPorConfirmar, ajustarVigencia,
    razonDescuento, costoPasaporte, vigenciaCredencial, tiempoTexto, portalLicencia, estadosOrdenados
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Tramites = api;
})(this);
