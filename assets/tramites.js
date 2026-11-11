// Trámites de Cuentas Claras MX: costo del pasaporte, vigencia de la credencial para votar, portales
// de licencias de manejo por estado, cartilla militar, e.firma del SAT y constancia de no antecedentes penales. Funciones puras, sin datos personales: todo se calcula en el navegador.
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

  // ---------------------------------------------------------------- Cartilla del Servicio Militar Nacional

  // Fuentes (no pudimos abrir gob.mx/defensa desde nuestra red; todo confirmado con al menos dos notas de prensa):
  // - Clase = año de nacimiento; la clase que cumple 18 años se registra ese año (la clase 2008 en 2026):
  //   Azteca Jalisco (29 jul 2026), El Cronista (27 jul 2026), Récord (5 oct 2026).
  // - Plazo para entregar papeles en la Junta Municipal de Reclutamiento: del 2 de enero al 15 de octubre:
  //   El Cronista (27 jul 2026), Tramitecadigital (act. 12 oct 2026); Azteca Jalisco da el mismo cierre.
  // - Remisos: de 19 a 39 años: Récord (5 oct y 7 ago 2026), Tramitecadigital; N+ (3 dic 2025) y El Imparcial
  //   (2 sep 2026) dan los 39 años como límite. A partir de los 40 se pide una constancia (Récord 7 ago 2026)
  //   o se pasa a la reserva (Tramitecadigital). Medimos la edad como los años que cumples en el año, como en las juntas;
  //   el caso de quien cumple 39 o 40 en el año se marca para confirmar con la junta.
  // - Anticipados de 16 y 17 años, solo con una razón de estudio o trabajo: solo Tramitecadigital (no confirmado).
  // - Sorteo en noviembre y 13 sesiones sabatinas: El Cronista (23 jul 2026), N+, Tramitecadigital.
  const CARTILLA = {
    edadClase: 18,
    remisoHasta: 39,
    edadAnticipado: 16,
    abre: [0, 2],   // 2 de enero (mes base 0)
    cierra: [9, 15] // 15 de octubre
  };

  // nacimiento: año en que naciste. hoy: Date. Dice si te toca registrarte este año y cómo.
  function cartillaMeToca({ nacimiento, hoy = new Date() }) {
    const n = numero(nacimiento);
    const anio = hoy.getFullYear();
    if (n === null) return { ok: false, error: "Escribe el año en que naciste, con cuatro números." };
    if (!Number.isInteger(n) || n < 1900 || n > 9999) return { ok: false, error: "Escribe solo el año, con cuatro números. Por ejemplo: 2008." };
    if (n > anio) return { ok: false, error: "Revisa el año: no puede ser posterior a este año." };
    const edad = anio - n; // años que cumples este año
    const hoy0 = new Date(anio, hoy.getMonth(), hoy.getDate());
    const abre = new Date(anio, CARTILLA.abre[0], CARTILLA.abre[1]);
    const cierra = new Date(anio, CARTILLA.cierra[0], CARTILLA.cierra[1]);
    const plazo = hoy0 < abre ? "antes" : hoy0 <= cierra ? "abierto" : "cerrado";
    const anioClase = n + CARTILLA.edadClase;
    let situacion;
    if (edad < CARTILLA.edadAnticipado) situacion = "aun-no";
    else if (edad < CARTILLA.edadClase) situacion = "anticipado";
    else if (edad === CARTILLA.edadClase) situacion = "clase";
    else if (edad <= CARTILLA.remisoHasta) situacion = "remiso";
    else situacion = "fuera";
    // Si el plazo de este año ya cerró, ¿cuándo puedes ir?
    // aun-no y anticipado: el año en que cumples 18. clase y remiso: este año si el plazo no ha cerrado; si ya
    // cerró, el próximo (como remiso), salvo que ese año ya cumplas 40. fuera: null.
    const proximoAnio = plazo === "cerrado" ? anio + 1 : anio;
    let siguiente = null;
    if (situacion === "aun-no" || situacion === "anticipado") siguiente = anioClase;
    else if (situacion !== "fuera" && proximoAnio - n <= CARTILLA.remisoHasta) siguiente = proximoAnio;
    const limiteEdad = edad === CARTILLA.remisoHasta || edad === CARTILLA.remisoHasta + 1;
    return {
      ok: true, nacimiento: n, clase: n, edad, anioClase, situacion, plazo, abre, cierra,
      siguiente, limiteEdad, anticipadoPorConfirmar: situacion === "anticipado"
    };
  }

  // ---------------------------------------------------------------- e.firma del SAT

  // Fuentes (sat.gob.mx no abrió desde nuestra red):
  // - Vigencia de 4 años desde que se emite o se renueva: El Imparcial (9 feb y 13 oct 2026), La Crónica
  //   (10 mar 2026), UnoTV (14 oct 2026), Récord (23 jun 2026).
  // - Vigente: se renueva en línea (Certifica y CertiSAT Web, o SAT ID) hasta 24 horas antes de vencer:
  //   El Imparcial (9 feb y 13 oct 2026); La Crónica (10 mar 2026) y Récord (23 jun 2026) confirman CertiSAT Web.
  // - Vencida hace menos de un año: todavía se puede renovar en línea con SAT ID: El Imparcial (9 feb, 10 mar y
  //   13 oct 2026) y La Crónica (10 mar 2026). UnoTV (14 oct 2026) dice en cambio que en ese caso vas a la
  //   oficina y te identificas con tu huella: lo marcamos como dato con fuentes que no coinciden.
  // - Vencida hace más de un año: cita en una oficina del SAT, como la primera vez: El Imparcial (13 oct 2026),
  //   SatFácil (jun 2026); El Imparcial (9 feb 2026) dice "posiblemente".
  const EFIRMA = { vigenciaAnios: 4, renovarVencidaAnios: 1, avisoDias: 60 };

  // Suma años a una fecha. Si cae en un 29 de febrero que no existe, se queda en el 28.
  function sumarAnios(d, n) {
    const r = new Date(d.getFullYear() + n, d.getMonth(), d.getDate());
    if (r.getMonth() !== d.getMonth()) r.setDate(0);
    return r;
  }

  // fecha: "AAAA-MM-DD". tipo: "emision" (la fecha en que la sacaste o renovaste) o "vencimiento".
  function vigenciaEfirma({ fecha: texto, tipo = "emision", hoy = new Date() }) {
    const d = typeof texto === "string" ? fecha(texto) : null;
    if (!d) return { ok: false, error: "Escribe la fecha que viene en tu certificado." };
    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const vence = tipo === "vencimiento" ? d : sumarAnios(d, EFIRMA.vigenciaAnios);
    const emitida = tipo === "vencimiento" ? sumarAnios(d, -EFIRMA.vigenciaAnios) : d;
    if (emitida > hoy0) return { ok: false, error: tipo === "vencimiento"
      ? `Revisa la fecha: una e.firma sacada hoy vence a más tardar en ${hoy0.getFullYear() + EFIRMA.vigenciaAnios}.`
      : "Revisa la fecha: no puede ser posterior a hoy." };
    if (vence.getFullYear() < 2000) return { ok: false, error: "Revisa el año de la fecha." };
    const limiteEnLinea = sumarAnios(vence, EFIRMA.renovarVencidaAnios);
    let estado;
    if (hoy0 < vence) estado = (vence - hoy0) / DIA <= EFIRMA.avisoDias ? "por-vencer" : "vigente";
    else if (hoy0 < limiteEnLinea) estado = "vencida-reciente";
    else estado = "vencida";
    const diasRestantes = hoy0 < vence ? Math.round((vence - hoy0) / DIA) : 0;
    const diasVencida = hoy0 >= vence ? Math.round((hoy0 - vence) / DIA) : 0;
    return {
      ok: true, emitida, vence, limiteEnLinea, estado, diasRestantes, diasVencida,
      tiempo: hoy0 < vence ? tiempoTexto(hoy0, vence) : tiempoTexto(vence, hoy0) || "Desde hoy",
      enLinea: estado !== "vencida", porConfirmar: estado === "vencida-reciente"
    };
  }

  // ---------------------------------------------------------------- Constancia de no antecedentes penales

  // Federal (Prevención y Reinserción Social, SSPC): $240 en 2026 según UnoTV (21 may 2026) y Tramitecadigital
  // (act. 13 oct 2026). Se pide en línea en constancias.oadprs.gob.mx y llega en PDF por correo.
  const ANTECEDENTES_FEDERAL = { costo: 240, url: "https://constancias.oadprs.gob.mx/" };

  // Por estado. Claves de ESTADOS. estado: "confirmado" (dos fuentes coinciden), "estimado" (no coinciden: rango),
  // "un-dato" (una sola fuente). Los que no están aquí: no encontramos el costo 2026 en fuentes confiables.
  // - CDMX: gratis en línea con la Fiscalía: UnoTV (21 may 2026) y Tramitaseguro (mar 2026).
  // - Puebla: $305, Fiscalía: ADN40 (24 feb 2026, act. 6 jul) y Tramitecadigital (act. 13 oct 2026).
  // - Guanajuato: $172, Fiscalía: Tramitecadigital (act. 13 oct 2026) y Tramitaseguro (2026).
  // - Coahuila: $172 según Posta (20 abr 2026); Tramitaseguro da de $172 a $194. SSP del estado.
  // - Jalisco: $95 según Tramitecadigital (13 oct 2026) y $92 según Tramitaseguro (mar 2026). Instituto Jalisciense
  //   de Ciencias Forenses; la primera vez es en persona.
  // - Estado de México: $153 según ADN40 (act. 7 jul 2026) y de $300 a $450 según Tramitaseguro (mar 2026). Fiscalía.
  // - Chiapas: $389 solo según Tramitecadigital (13 oct 2026).
  // - Nuevo León: la expide la Agencia de Administración Penitenciaria; ninguna fuente publica el costo 2026.
  const ANTECEDENTES = {
    cdmx: { min: 0, max: 0, estado: "confirmado", emisor: "Fiscalía General de Justicia de la CDMX", enLinea: "Sí, gratis en línea" },
    pue: { min: 305, max: 305, estado: "confirmado", emisor: "Fiscalía General del Estado", enLinea: "Sí" },
    gto: { min: 172, max: 172, estado: "confirmado", emisor: "Fiscalía General del Estado", enLinea: "Sí (ProcuraWeb)" },
    coah: { min: 172, max: 194, estado: "estimado", emisor: "Secretaría de Seguridad Pública del estado", enLinea: "Sí" },
    jal: { min: 92, max: 95, estado: "estimado", emisor: "Instituto Jalisciense de Ciencias Forenses", enLinea: "La primera vez, en persona" },
    mex: { min: 153, max: 450, estado: "estimado", emisor: "Fiscalía General de Justicia del Estado de México", enLinea: "En parte (cita en línea)" },
    chis: { min: 389, max: 389, estado: "un-dato", emisor: "Fiscalía General del Estado", enLinea: "" },
    nl: { min: null, max: null, estado: "sin-dato", emisor: "Agencia de Administración Penitenciaria", enLinea: "En parte (se recoge en persona)" }
  };

  // Datos de un estado (o "fed" para la federal). null si la clave no existe.
  function costoAntecedentes(clave) {
    if (clave === "fed") return { clave, nombre: "Federal", min: ANTECEDENTES_FEDERAL.costo, max: ANTECEDENTES_FEDERAL.costo,
      estado: "confirmado", emisor: "Prevención y Reinserción Social (SSPC)", enLinea: "Sí, en línea", federal: true };
    const e = ESTADOS.find(x => x.clave === clave);
    if (!e) return null;
    const d = ANTECEDENTES[clave] || { min: null, max: null, estado: "sin-dato", emisor: "", enLinea: "" };
    return Object.assign({ clave, nombre: e.nombre, federal: false }, d);
  }

  // Los 32 estados en orden alfabético, con su dato.
  function tablaAntecedentes() {
    return estadosOrdenados().map(e => costoAntecedentes(e.clave));
  }

  const api = {
    DATOS, ESTADOS, TEXTO_TIPO, ETIQUETA_TIPO, leerEdad, vigenciasPasaporte, vigenciaPorConfirmar, ajustarVigencia,
    razonDescuento, costoPasaporte, vigenciaCredencial, tiempoTexto, portalLicencia, estadosOrdenados,
    CARTILLA, cartillaMeToca, EFIRMA, sumarAnios, vigenciaEfirma, ANTECEDENTES_FEDERAL, ANTECEDENTES, costoAntecedentes, tablaAntecedentes
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Tramites = api;
})(this);
