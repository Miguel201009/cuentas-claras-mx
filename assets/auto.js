// Cálculos de la sección Auto de Cuentas Claras MX: costo de gasolina por viaje, calendario de verificación
// y Hoy No Circula (CDMX y zona conurbada) y datos de tenencia por estado. Funciones puras, sin datos personales:
// todo se calcula en el navegador de la persona.
// En el navegador carga antes ../../assets/calc.js (UMA y mxn()). En Node se lee con require.
(function (raiz) {
  const enNode = typeof module !== "undefined" && module.exports;
  const Calc = enNode ? require("./calc.js") : raiz.Calc;
  const DIA = 864e5;

  // Revisión del 20 de octubre de 2026: con buscador, pero los portales oficiales no se pudieron abrir desde
  // nuestra red (403 o falla de DNS). Lo que vimos de fuentes oficiales fue a través de los resultados del
  // buscador; lo demás se confirmó con al menos 2 fuentes secundarias serias y queda anotado como pendiente de
  // verificar con la fuente oficial. Las páginas lo dicen y enlazan al portal oficial.
  const DATOS = {
    anio: 2026,
    revisado: "octubre de 2026",

    gasolina: {
      // Precio de EJEMPLO por litro, NO oficial: cada gasolinera fija su precio y cambia seguido.
      // La página pide escribir el de tu gasolinera (Profeco publica comparativos de precios).
      precioEjemplo: 24
    },

    verificacion: {
      // Calendario por color de engomado (último número de la placa).
      // Fuente: Programa de Verificación Vehicular Obligatoria para el segundo semestre de 2026, Gaceta Oficial
      // de la CDMX núm. 1892 del 1 de julio de 2026, vigente del 1 jul al 31 dic 2026 (visto en el buscador:
      // proyectos.sedema.cdmx.gob.mx/.../GOCDMX_26-07-01_DGCA.pdf). Coincide con lo publicado para el primer
      // semestre de 2026 (Crónica, 2 ene 2026) y con Uno TV, N+ y Milenio (julio de 2026).
      // mes: primer mes del periodo del primer semestre (1 = enero); el periodo dura 2 meses y el del
      // segundo semestre empieza 6 meses después. dia: día entre semana que no circulan los hologramas 1 y 2
      // (Programa Hoy No Circula de la CDMX y del Estado de México). Días confirmados con notas de 2026
      // (Expansión, Uno TV, Récord); pendiente cotejar con el texto oficial del programa.
      colores: [
        { color: "amarillo", digitos: [5, 6], mes: 1, dia: "lunes" },
        { color: "rosa", digitos: [7, 8], mes: 2, dia: "martes" },
        { color: "rojo", digitos: [3, 4], mes: 3, dia: "miércoles" },
        { color: "verde", digitos: [1, 2], mes: 4, dia: "jueves" },
        { color: "azul", digitos: [9, 0], mes: 5, dia: "viernes" }
      ],
      // Hoy No Circula, holograma 1: placas con número impar no circulan el 1er y 3er sábado del mes;
      // con número par, el 2o y 4o. Holograma 2: ningún sábado. Horario de 5:00 a 22:00 h.
      // Confirmado con notas de 2026 (Xataka, adn40, Expansión); pendiente cotejar con el texto oficial.
      sabadosImpar: [1, 3],
      sabadosPar: [2, 4],
      // Multa por verificar fuera de tiempo en la CDMX: 20 veces la UMA = $2,346.20 con la UMA de 2026
      // (117.31, vigente del 1 feb 2026 al 31 ene 2027). Monto que dio la Secretaría de Administración y
      // Finanzas de la CDMX en 2026, según Uno TV y Expansión (abril de 2026) y adn40 (julio de 2026).
      multaUmaCdmx: 20
    },

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: { km: 50000, rendimiento: 100, rendimientoMinimo: 1, precio: 100, personas: 100, casetas: 1e6 }
  };

  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
    "septiembre", "octubre", "noviembre", "diciembre"];

  // Número válido, finito y positivo; vacío, texto, negativo o infinito cuenta como 0.
  function num(x) {
    if (x === "" || x === null || x === undefined) return 0;
    const n = +x;
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Número positivo con tope. Lo que pasa del máximo (incluso "1e20" o Infinity) se recorta y se marca.
  function acotar(x, maximo) {
    const n = x === "" || x === null || x === undefined ? 0 : +x;
    if (n > maximo) return { valor: maximo, recortado: true };
    return { valor: Number.isFinite(n) && n > 0 ? n : 0, recortado: false };
  }

  // ---------------------------------------------------------------- Gasolina por viaje

  // Litros = km ÷ rendimiento; costo = litros × precio. Ida y vuelta duplica los km.
  // Las casetas son el total del viaje (no se duplican). Por persona = (gasolina + casetas) ÷ personas.
  function gasolinaViaje({ km, rendimiento, precio, idaYVuelta = true, personas = 1, casetas = 0 } = {}) {
    const M = DATOS.maximos;
    const k = acotar(km, M.km);
    const r = acotar(rendimiento, M.rendimiento);
    const p = acotar(precio, M.precio);
    const c = acotar(casetas, M.casetas);
    const pe = acotar(personas, M.personas);
    // Menos de 1 km/l no existe en un auto: se toma 1 y se avisa.
    const rendimientoBajo = r.valor > 0 && r.valor < M.rendimientoMinimo;
    const rend = rendimientoBajo ? M.rendimientoMinimo : r.valor;
    // Personas: número entero, al menos 1 (si dejas el campo vacío, pagas tú solo).
    const nPersonas = Math.max(1, Math.floor(pe.valor));

    const kmTotal = k.valor * (idaYVuelta ? 2 : 1);
    const litros = rend > 0 ? kmTotal / rend : 0;
    const costoGasolina = litros * p.valor;
    const total = costoGasolina + c.valor;
    const porPersona = total / nPersonas;
    // porKm: solo gasolina (precio ÷ rendimiento). porKmTotal: todo el viaje, con casetas (total ÷ km en total).
    const porKm = rend > 0 ? p.valor / rend : 0;
    const porKmTotal = kmTotal > 0 ? total / kmTotal : 0;

    const faltaKm = k.valor === 0, faltaRendimiento = rend === 0, faltaPrecio = p.valor === 0;
    return {
      km: k.valor, kmTotal, rendimiento: rend, precio: p.valor, casetas: c.valor, personas: nPersonas,
      idaYVuelta: !!idaYVuelta, litros, costoGasolina, total, porPersona, porKm, porKmTotal,
      faltaKm, faltaRendimiento, faltaPrecio, sinDatos: faltaKm || faltaRendimiento || faltaPrecio,
      rendimientoBajo,
      recortado: k.recortado || r.recortado || p.recortado || c.recortado || pe.recortado
    };
  }

  // ---------------------------------------------------------------- Verificación y Hoy No Circula

  // Último número de la placa: entero de 0 a 9; cualquier otra cosa da null.
  function digitoValido(x) {
    if (x === "" || x === null || x === undefined) return null;
    const n = +x;
    return Number.isInteger(n) && n >= 0 && n <= 9 ? n : null;
  }

  // Color de engomado, meses de verificación y día que no circula, según el último número de la placa.
  function engomado(digito) {
    const d = digitoValido(digito);
    if (d === null) return null;
    const c = DATOS.verificacion.colores.find(x => x.digitos.includes(d));
    const periodos = [[c.mes, c.mes + 1], [c.mes + 6, c.mes + 7]];
    return {
      digito: d, par: d % 2 === 0, color: c.color, dia: c.dia, digitos: c.digitos.slice(), periodos,
      textoPeriodos: periodos.map(([a, b]) => `${MESES[a - 1]} y ${MESES[b - 1]}`)
    };
  }

  function inicioDelDia(f) {
    return new Date(f.getFullYear(), f.getMonth(), f.getDate());
  }

  // Periodo de verificación que toca en una fecha: el actual si la fecha cae dentro, o el siguiente.
  // Devuelve { enPeriodo, inicio, fin (último día), anio, texto, diasRestantes o diasParaEmpezar }.
  function turnoVerificacion(digito, fecha) {
    const e = engomado(digito);
    if (!e || !(fecha instanceof Date) || isNaN(fecha)) return null;
    const hoy = inicioDelDia(fecha);
    const anio = hoy.getFullYear();
    const candidatos = [[anio, e.periodos[0][0]], [anio, e.periodos[1][0]], [anio + 1, e.periodos[0][0]]];
    for (const [a, m] of candidatos) {
      const inicio = new Date(a, m - 1, 1);
      const despues = new Date(a, m + 1, 1); // primer día después del periodo
      if (hoy < despues) {
        const enPeriodo = hoy >= inicio;
        return {
          enPeriodo, inicio, fin: new Date(a, m + 1, 0), anio: a,
          texto: `${MESES[m - 1]} y ${MESES[m]} de ${a}`,
          diasRestantes: enPeriodo ? Math.round((despues - hoy) / DIA) : 0,
          diasParaEmpezar: enPeriodo ? 0 : Math.round((inicio - hoy) / DIA)
        };
      }
    }
    return null; // no se llega aquí: el primer periodo del año siguiente siempre es futuro
  }

  // Días (del 1 al 31) que son sábado en un mes. mes: 1 a 12.
  function sabadosDelMes(anio, mes) {
    const dias = [];
    const ultimo = new Date(anio, mes, 0).getDate();
    for (let d = 1; d <= ultimo; d++) if (new Date(anio, mes - 1, d).getDay() === 6) dias.push(d);
    return dias;
  }

  const HOLOGRAMAS = ["00", "0", "1", "2"];

  // Restricciones del Hoy No Circula (CDMX y municipios conurbados del Estado de México) fuera de contingencia.
  function hoyNoCircula(digito, holograma) {
    const e = engomado(digito);
    const h = String(holograma);
    if (!e || !HOLOGRAMAS.includes(h)) return null;
    if (h === "00" || h === "0") return { holograma: h, circulaDiario: true, dia: null, sabados: [], textoSabados: "ninguno" };
    if (h === "1") {
      const sabados = (e.par ? DATOS.verificacion.sabadosPar : DATOS.verificacion.sabadosImpar).slice();
      return { holograma: h, circulaDiario: false, dia: e.dia, sabados, textoSabados: `${sabados[0]}º y ${sabados[1]}º sábado del mes` };
    }
    return { holograma: h, circulaDiario: false, dia: e.dia, sabados: [1, 2, 3, 4, 5], textoSabados: "todos los sábados" };
  }

  // Fechas (días del mes) en que no circulas en sábado en un mes dado. mes: 1 a 12.
  function sabadosSinCircular(digito, holograma, anio, mes) {
    const r = hoyNoCircula(digito, holograma);
    if (!r) return [];
    const sab = sabadosDelMes(anio, mes);
    return r.sabados.filter(n => n <= sab.length).map(n => sab[n - 1]);
  }

  // Multa por verificar fuera de tiempo en la CDMX: 20 UMA (ver DATOS.verificacion.multaUmaCdmx).
  function multaExtemporaneaCdmx() {
    return Calc.redondear(DATOS.verificacion.multaUmaCdmx * Calc.DATOS.uma);
  }

  // Une una lista de días: [10, 24] -> "10 y 24"; [3, 10, 17] -> "3, 10 y 17".
  function listaDias(dias) {
    if (!dias.length) return "";
    if (dias.length === 1) return String(dias[0]);
    return dias.slice(0, -1).join(", ") + " y " + dias[dias.length - 1];
  }

  // ---------------------------------------------------------------- Tenencia y refrendo por estado

  // tenencia: "si" = cobra tenencia estatal, con un subsidio que la deja en $0 a muchos autos;
  //           "algunos" = la cobra solo a algunos autos (los de mayor valor);
  //           "no" = no cobra tenencia, solo el pago anual de placas (refrendo, control vehicular o revalidación);
  //           "revisar" = no lo revisamos a fondo para 2026.
  // Solo 5 estados tienen dato propio (TENENCIA_2026, abajo), revisado el 20 oct 2026 con al menos 2 fuentes.
  // Ninguno se pudo cotejar abriendo el portal oficial (403 desde nuestra red): queda pendiente.
  // portal: "pago" = página oficial de pago o consulta de adeudo vehicular; "finanzas" = secretaría de finanzas
  //         o de hacienda del estado; "catalogo" = catálogo oficial de trámites; "estatal" = portal general
  //         del gobierno del estado (no encontramos la página exacta de pago).
  // Enlaces: páginas .gob.mx que el buscador mostró indexadas en 2026 (oct 2026). Desde nuestra red no se
  // pudieron abrir (403 o falla de DNS): siguen pendientes de abrirse a mano.
  const ESTADOS = [
    { clave: "ags", nombre: "Aguascalientes", tenencia: "revisar", portal: "pago", url: "https://epagos.aguascalientes.gob.mx/controlvehicular" },
    { clave: "bc", nombre: "Baja California", tenencia: "revisar", portal: "pago", url: "https://refrendo.bajacalifornia.gob.mx/" },
    { clave: "bcs", nombre: "Baja California Sur", tenencia: "revisar", portal: "finanzas", url: "https://finanzas.bcs.gob.mx/" },
    { clave: "camp", nombre: "Campeche", tenencia: "revisar", portal: "finanzas", url: "https://seafi.campeche.gob.mx/" },
    { clave: "chis", nombre: "Chiapas", tenencia: "revisar", portal: "pago", url: "https://soluciones.finanzaschiapas.gob.mx/liquidacion_vehicular/default.aspx" },
    { clave: "chih", nombre: "Chihuahua", tenencia: "no", portal: "pago", url: "https://ipagos.chihuahua.gob.mx/" },
    { clave: "cdmx", nombre: "Ciudad de México", tenencia: "si", portal: "finanzas", url: "https://www.finanzas.cdmx.gob.mx/servicios/servicios-de-control-vehicular",
      textoPortal: "Secretaría de Administración y Finanzas de la Ciudad de México: busca “tenencia” o “refrendo”." },
    { clave: "coah", nombre: "Coahuila", tenencia: "revisar", portal: "pago", url: "https://www.pagafacil.gob.mx/" },
    { clave: "col", nombre: "Colima", tenencia: "revisar", portal: "pago", url: "https://www.col.gob.mx/finanzas/contenido/MTAyNjg=" },
    { clave: "dgo", nombre: "Durango", tenencia: "revisar", portal: "pago", url: "https://www.pagos.durango.gob.mx/" },
    { clave: "gto", nombre: "Guanajuato", tenencia: "algunos", portal: "pago", url: "https://refrendo.guanajuato.gob.mx/" },
    { clave: "gro", nombre: "Guerrero", tenencia: "revisar", portal: "pago", url: "https://esefina.ingresos-guerrero.gob.mx/Tenencia/ModuloExterno/" },
    { clave: "hgo", nombre: "Hidalgo", tenencia: "revisar", portal: "finanzas", url: "https://portaltributario.hidalgo.gob.mx/" },
    { clave: "jal", nombre: "Jalisco", tenencia: "no", portal: "pago", url: "https://refrendo.jalisco.gob.mx/" },
    { clave: "mex", nombre: "Estado de México", tenencia: "si", portal: "pago", url: "https://tenencia.edomex.gob.mx/" },
    { clave: "mich", nombre: "Michoacán", tenencia: "revisar", portal: "pago", url: "https://refrendodigital.michoacan.gob.mx/" },
    { clave: "mor", nombre: "Morelos", tenencia: "revisar", portal: "pago", url: "https://digital.morelos.gob.mx/" },
    { clave: "nay", nombre: "Nayarit", tenencia: "revisar", portal: "finanzas", url: "https://hacienda.minayarit.gob.mx/tramites" },
    { clave: "nl", nombre: "Nuevo León", tenencia: "revisar", portal: "pago", url: "https://www.nl.gob.mx/refrendo" },
    { clave: "oax", nombre: "Oaxaca", tenencia: "revisar", portal: "finanzas", url: "https://www.finanzasoaxaca.gob.mx/" },
    { clave: "pue", nombre: "Puebla", tenencia: "revisar", portal: "pago", url: "https://rl.puebla.gob.mx/tenencia" },
    { clave: "qro", nombre: "Querétaro", tenencia: "revisar", portal: "pago", url: "https://tenencia.queretaro.gob.mx/" },
    { clave: "qroo", nombre: "Quintana Roo", tenencia: "revisar", portal: "finanzas", url: "https://satq.qroo.gob.mx/" },
    { clave: "slp", nombre: "San Luis Potosí", tenencia: "revisar", portal: "pago", url: "https://enlacesipel.slp.gob.mx/ControlVehicular_Liquidacion" },
    { clave: "sin", nombre: "Sinaloa", tenencia: "revisar", portal: "finanzas", url: "https://portalfiscal.sinaloa.gob.mx/" },
    { clave: "son", nombre: "Sonora", tenencia: "revisar", portal: "finanzas", url: "https://hacienda.sonora.gob.mx/revalidacion-placas" },
    { clave: "tab", nombre: "Tabasco", tenencia: "revisar", portal: "finanzas", url: "https://tabasco.gob.mx/finanzas" },
    { clave: "tamps", nombre: "Tamaulipas", tenencia: "revisar", portal: "finanzas", url: "https://finanzas.tamaulipas.gob.mx/" },
    { clave: "tlax", nombre: "Tlaxcala", tenencia: "revisar", portal: "estatal", url: "https://www.tlaxcala.gob.mx/" },
    { clave: "ver", nombre: "Veracruz", tenencia: "revisar", portal: "finanzas", url: "https://www.veracruz.gob.mx/finanzas/" },
    { clave: "yuc", nombre: "Yucatán", tenencia: "revisar", portal: "estatal", url: "https://www.yucatan.gob.mx/" },
    { clave: "zac", nombre: "Zacatecas", tenencia: "revisar", portal: "finanzas", url: "https://sefin.zacatecas.gob.mx/" }
  ];

  const TEXTO_PORTAL = {
    pago: "Página oficial de pago del estado: escribe tu placa para ver cuánto debes.",
    finanzas: "Secretaría de finanzas o de hacienda del estado: busca “tenencia”, “refrendo” o “control vehicular”.",
    catalogo: "Catálogo oficial de trámites del estado: busca “refrendo”, “control vehicular” o “tenencia”.",
    estatal: "Portal oficial del gobierno del estado: busca “refrendo”, “control vehicular” o “tenencia”. No encontramos la página exacta de pago."
  };

  // Lo que revisamos para 2026, estado por estado (20 de octubre de 2026). Cada dato tiene al menos 2 fuentes;
  // ninguna página oficial se pudo abrir directamente, así que todo queda pendiente de verificar en el portal.
  const TENENCIA_2026 = {
    // Tope de $638,000 con IVA y plazo al 30 de junio: Secretaría de Administración y Finanzas (comunicado de
    // enero de 2026; acuerdo de subsidio en la Gaceta Oficial de la CDMX del 16 ene 2026, según AMCPDF),
    // Expansión (dic 2025), El Financiero (28 abr 2026, amplía el plazo 3 meses) y adn40 (25 jun 2026).
    cdmx: {
      detalle: "La Ciudad de México sí cobra tenencia en 2026, pero con un subsidio. Los autos con valor de hasta $638,000 con IVA no la pagaron si estaban al corriente y pagaron el refrendo a más tardar el 30 de junio de 2026. Si se te pasó la fecha, revisa en el portal cuánto debes.",
      fuente: "Secretaría de Administración y Finanzas de la CDMX (comunicado de enero de 2026), El Financiero (28 de abril de 2026) y adn40 (25 de junio de 2026)."
    },
    // Tope de $638,000 con IVA, plazo al 6 de abril, 100% con placas 2021 o más nuevas y 50% con placas 2020:
    // acuerdo en la Gaceta del Gobierno del 19 dic 2025 (Uno TV), Crónica (6 ene 2026), Expansión (28 ene 2026).
    mex: {
      detalle: "El Estado de México sí cobra tenencia en 2026, pero con un subsidio. Los autos con valor de hasta $638,000 con IVA podían no pagarla si estaban al corriente y pagaron el refrendo a más tardar el 6 de abril de 2026. Había más condiciones, como el año de expedición de tus placas. Si se te pasó la fecha, revisa en el portal cuánto debes.",
      fuente: "Secretaría de Finanzas del Estado de México (acuerdo publicado en la Gaceta del Gobierno el 19 de diciembre de 2025), Crónica (6 de enero de 2026) y Expansión (28 de enero de 2026)."
    },
    // Volvió en 2025 solo para autos de valor alto (Motorpasión y Líder Empresarial, 2024 y 2025). La calculadora
    // 2026 de la Secretaría de Finanzas de Guanajuato (vista en el buscador) dice que la pagan los autos con
    // valor factura con IVA de más de $522,000; no ponemos la cifra en la página porque no la pudimos abrir.
    gto: {
      detalle: "Guanajuato volvió a cobrar tenencia en 2025, pero solo a los autos de mayor valor. La mayoría de los autos paga solo el refrendo cada año. En el portal oficial puedes ver si a tu auto le toca.",
      fuente: "Secretaría de Finanzas de Guanajuato (calculadora de 2026), Motorpasión y Líder Empresarial (notas de 2024 y 2025)."
    },
    // Hacienda de Jalisco anunció el refrendo 2026 ($1,000 autos) sin tenencia; Récord (ene 2026) y adn40 (2025)
    // lo listan entre los estados sin tenencia. Su Ley de Ingresos dejó de contemplarla en 2012 (AMDA).
    jal: {
      detalle: "Jalisco no cobra tenencia en 2026. Lo que pagas cada año es el refrendo de tus placas.",
      fuente: "Secretaría de la Hacienda Pública de Jalisco (refrendo 2026), Récord (enero de 2026) y adn40 (2025)."
    },
    // La revalidación 2026 incluye control vehicular, tarjeta, Cruz Roja e impuesto universitario, sin tenencia
    // (comunicado del Gobierno de Chihuahua, 29 ene 2026; N+ y La Razón). La tenencia estatal se quitó desde
    // 2011 (documento de cabildo de Juárez; La Jornada, 15 dic 2011).
    chih: {
      detalle: "Chihuahua no cobra tenencia desde 2011. Lo que pagas cada año es la revalidación vehicular, que incluye el control vehicular, la tarjeta de circulación, la aportación a la Cruz Roja y el impuesto universitario.",
      fuente: "Gobierno de Chihuahua (comunicado de la revalidación 2026), N+ y La Razón (2026); La Jornada (2011)."
    }
  };

  // Nombre con artículo para armar frases ("la Ciudad de México", "el Estado de México", "Jalisco").
  const ARTICULO = { cdmx: "la", mex: "el" };
  function conArticulo(e) {
    return ARTICULO[e.clave] ? ARTICULO[e.clave] + " " + e.nombre : e.nombre;
  }

  // Títulos cortos del resultado. Los estados en "si", "algunos" o "no" tienen su detalle en TENENCIA_2026.
  const TEXTO_TENENCIA = {
    si: { corto: "Sí, con subsidio" },
    algunos: { corto: "Solo a algunos autos" },
    no: { corto: "No se cobra" },
    revisar: {
      corto: "Revisa en tu estado",
      detalle: n => `No revisamos a fondo si ${n} cobra tenencia en 2026. Lo que pagan casi todos los estados cada año es el refrendo o control vehicular de las placas.`
    }
  };

  // Datos de tenencia y portal de un estado por su clave, o null si la clave no existe.
  // fuente: de dónde sale el dato de 2026 ("" si no lo revisamos). confirmado: false porque ningún dato se
  // pudo verificar abriendo el portal oficial.
  function tenenciaEstado(clave) {
    const e = ESTADOS.find(x => x.clave === clave);
    if (!e) return null;
    const t = TEXTO_TENENCIA[e.tenencia];
    const r = TENENCIA_2026[e.clave];
    return Object.assign({}, e, {
      corto: t.corto, detalle: r ? r.detalle : t.detalle(conArticulo(e)), fuente: r ? r.fuente : "",
      descripcionPortal: e.textoPortal || TEXTO_PORTAL[e.portal],
      nombreFrase: conArticulo(e), dominio: new URL(e.url).hostname, confirmado: false
    });
  }

  // Estados en orden alfabético por el nombre que se ve en el selector ("Estado de México" va en la E).
  function estadosOrdenados() {
    return ESTADOS.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  const api = {
    DATOS, MESES, ESTADOS, HOLOGRAMAS, num, acotar, gasolinaViaje, digitoValido, engomado, turnoVerificacion,
    sabadosDelMes, hoyNoCircula, sabadosSinCircular, multaExtemporaneaCdmx, listaDias, tenenciaEstado, estadosOrdenados
  };
  if (enNode) module.exports = api;
  else raiz.Auto = api;
})(this);
