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
  // Solo 12 estados tienen dato propio (TENENCIA_2026, abajo), revisado el 20 oct 2026 (Veracruz y Puebla, el
  // 18 nov 2026; Nuevo León, Chiapas y Michoacán, el 20 nov 2026; Oaxaca, Chihuahua y Guerrero, el 23 nov 2026)
  // con al menos 2 fuentes.
  // corto: título propio del resultado cuando el de su categoría no le queda (Guerrero cobra tenencia sin subsidio).
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
    { clave: "chis", nombre: "Chiapas", tenencia: "no", portal: "pago", url: "https://soluciones.finanzaschiapas.gob.mx/liquidacion_vehicular/default.aspx" },
    { clave: "chih", nombre: "Chihuahua", tenencia: "no", portal: "pago", url: "https://ipagos.chihuahua.gob.mx/" },
    { clave: "cdmx", nombre: "Ciudad de México", tenencia: "si", portal: "finanzas", url: "https://www.finanzas.cdmx.gob.mx/servicios/servicios-de-control-vehicular",
      textoPortal: "Secretaría de Administración y Finanzas de la Ciudad de México: busca “tenencia” o “refrendo”." },
    { clave: "coah", nombre: "Coahuila", tenencia: "revisar", portal: "pago", url: "https://www.pagafacil.gob.mx/" },
    { clave: "col", nombre: "Colima", tenencia: "revisar", portal: "pago", url: "https://www.col.gob.mx/finanzas/contenido/MTAyNjg=" },
    { clave: "dgo", nombre: "Durango", tenencia: "revisar", portal: "pago", url: "https://www.pagos.durango.gob.mx/" },
    { clave: "gto", nombre: "Guanajuato", tenencia: "algunos", portal: "pago", url: "https://refrendo.guanajuato.gob.mx/" },
    { clave: "gro", nombre: "Guerrero", tenencia: "si", portal: "pago", url: "https://esefina.ingresos-guerrero.gob.mx/Tenencia/ModuloExterno/",
      corto: "Sí, con descuento por pronto pago",
      textoPortal: "Módulo de pago de tenencia de la Secretaría de Finanzas y Administración de Guerrero: escribe tu placa para ver cuánto debes." },
    { clave: "hgo", nombre: "Hidalgo", tenencia: "revisar", portal: "finanzas", url: "https://portaltributario.hidalgo.gob.mx/" },
    { clave: "jal", nombre: "Jalisco", tenencia: "no", portal: "pago", url: "https://refrendo.jalisco.gob.mx/" },
    { clave: "mex", nombre: "Estado de México", tenencia: "si", portal: "pago", url: "https://tenencia.edomex.gob.mx/" },
    { clave: "mich", nombre: "Michoacán", tenencia: "no", portal: "pago", url: "https://refrendodigital.michoacan.gob.mx/" },
    { clave: "mor", nombre: "Morelos", tenencia: "revisar", portal: "pago", url: "https://digital.morelos.gob.mx/" },
    { clave: "nay", nombre: "Nayarit", tenencia: "revisar", portal: "finanzas", url: "https://hacienda.minayarit.gob.mx/tramites" },
    { clave: "nl", nombre: "Nuevo León", tenencia: "no", portal: "pago", url: "https://www.nl.gob.mx/refrendo",
      textoPortal: "Página oficial del refrendo de Nuevo León; el estado de cuenta con tu placa está en el portal del Instituto de Control Vehicular (ICV)." },
    { clave: "oax", nombre: "Oaxaca", tenencia: "si", portal: "pago", url: "https://siox.finanzasoaxaca.gob.mx/pagoTenencia",
      textoPortal: "Sistema de pago de la Secretaría de Finanzas de Oaxaca: escribe tu placa o tu número de serie para ver cuánto debes." },
    { clave: "pue", nombre: "Puebla", tenencia: "si", portal: "pago", url: "https://rl.puebla.gob.mx/adeudovehicular" },
    { clave: "qro", nombre: "Querétaro", tenencia: "revisar", portal: "pago", url: "https://tenencia.queretaro.gob.mx/" },
    { clave: "qroo", nombre: "Quintana Roo", tenencia: "revisar", portal: "finanzas", url: "https://satq.qroo.gob.mx/" },
    { clave: "slp", nombre: "San Luis Potosí", tenencia: "revisar", portal: "pago", url: "https://enlacesipel.slp.gob.mx/ControlVehicular_Liquidacion" },
    { clave: "sin", nombre: "Sinaloa", tenencia: "revisar", portal: "finanzas", url: "https://portalfiscal.sinaloa.gob.mx/" },
    { clave: "son", nombre: "Sonora", tenencia: "revisar", portal: "finanzas", url: "https://hacienda.sonora.gob.mx/revalidacion-placas" },
    { clave: "tab", nombre: "Tabasco", tenencia: "revisar", portal: "finanzas", url: "https://tabasco.gob.mx/finanzas" },
    { clave: "tamps", nombre: "Tamaulipas", tenencia: "revisar", portal: "finanzas", url: "https://finanzas.tamaulipas.gob.mx/" },
    { clave: "tlax", nombre: "Tlaxcala", tenencia: "revisar", portal: "estatal", url: "https://www.tlaxcala.gob.mx/" },
    { clave: "ver", nombre: "Veracruz", tenencia: "si", portal: "pago", url: "https://www.ovh.gob.mx/",
      textoPortal: "Oficina Virtual de Hacienda (OVH) de Veracruz: escribe tu placa para ver cuánto debes." },
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
      detalle: "Guanajuato volvió a cobrar tenencia en 2025, pero solo a los autos de mayor valor: en 2026, a los que valen más de $522,000 con IVA. La mayoría de los autos paga solo el refrendo cada año. En el portal oficial puedes ver si a tu auto le toca.",
      fuente: "Secretaría de Finanzas de Guanajuato (calculadora de 2026), Todo Sobre Autos (2026), Motorpasión y Líder Empresarial (notas de 2024 y 2025)."
    },
    // Estímulo de 100% a la tenencia para quien pagó el control vehicular del 1 de enero al 31 de marzo de 2026,
    // al corriente y con la verificación hecha; sin tope de valor publicado. Decreto anunciado por la gobernadora
    // (Al Calor Político, 31 dic 2025), adn40 (24 mar 2026) y La Silla Rota (3 ene 2026).
    ver: {
      detalle: "Veracruz sí cobra tenencia en 2026, pero con un estímulo de 100% para quien pagó el control vehicular entre el 1 de enero y el 31 de marzo de 2026, sin adeudos y con la verificación vehicular hecha. No encontramos un tope de valor. Si se te pasó la fecha, revisa en el portal cuánto debes.",
      fuente: "Gobierno de Veracruz (decreto de estímulo, citado por Al Calor Político el 31 de diciembre de 2025), adn40 (24 de marzo de 2026) y La Silla Rota (3 de enero de 2026)."
    },
    // Subsidio de 100% para quien pagó el control vehicular de $700 a tiempo y sin adeudos ni fotomultas; plazo
    // del 31 de marzo ampliado al 30 de abril de 2026 (adn40, 6 abr 2026; N+, 1 abr 2026). Sin tope de valor
    // (Todo Sobre Autos; adn40, N+ y TV Azteca no mencionan ninguno).
    pue: {
      detalle: "Puebla sí cobra tenencia en 2026, pero con un subsidio de 100% para quien pagó el control vehicular a más tardar el 30 de abril de 2026 (el plazo original era el 31 de marzo), sin adeudos ni fotomultas. No encontramos un tope de valor. Si se te pasó la fecha, revisa en el portal cuánto debes.",
      fuente: "adn40 (6 de abril de 2026), N+ (1 de abril de 2026), TV Azteca (30 de marzo de 2026) y Todo Sobre Autos (2026)."
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
      fuente: "Gobierno de Chihuahua (comunicados de la revalidación 2026 del 29 de enero y del 29 de abril de 2026), N+ y La Razón (2026); La Jornada (2011)."
    },
    // Oaxaca: estímulo fiscal de 100% a la tenencia para quien está al corriente (subsecretario de Ingresos, conferencia
    // del 5 ene 2026, citado por NVI Noticias, 6 ene 2026, La Tinta Oaxaca, 6 ene 2026, y El Universal Oaxaca, 8 ene 2026).
    oax: {
      detalle: "Oaxaca sí cobra tenencia, pero en 2026 tuvo un estímulo fiscal de 100%: quien estaba al corriente pagó $0 de tenencia y solo pagó los derechos vehiculares (placas, refrendo, tarjeta de circulación y verificación). Si debes años anteriores, el estímulo no aplica hasta que te pongas al corriente.",
      fuente: "Secretaría de Finanzas de Oaxaca (conferencia del 5 de enero de 2026), citada por NVI Noticias, La Tinta Oaxaca y El Universal Oaxaca (enero de 2026)."
    },
    // Guerrero: cobra tenencia con descuento por pronto pago de 10% en enero, 8% en febrero y 5% en marzo (Gobierno de
    // Guerrero, comunicado del 9 ene 2026; Quadratín Guerrero, 9 ene 2026; Uno TV, 20 mar 2026). Sitios de trámites
    // hablan de un subsidio para autos de menor valor, pero con topes que no coinciden ($200,000 y $400,000) y sin
    // fuente oficial ni de prensa: no lo usamos.
    gro: {
      detalle: "Guerrero sí cobra tenencia en 2026 y no encontramos un subsidio confirmado. Lo que hubo fue un descuento por pronto pago: 10% en enero, 8% en febrero y 5% en marzo. El monto depende del valor y el modelo de tu vehículo: revísalo en el portal con tu placa.",
      fuente: "Gobierno de Guerrero (comunicado del 9 de enero de 2026), Quadratín Guerrero (9 de enero de 2026) y Uno TV (20 de marzo de 2026)."
    },
    // Nuevo León quitó la tenencia estatal desde 2018 (Congreso de Nuevo León, boletín del 8 nov 2017; Todo Sobre
    // Autos, 2026; Posta, 2 feb 2025). Récord (ene 2026) la pone entre los estados que sí cobran: no lo usamos
    // porque ninguna otra fuente lo dice y el refrendo 2026 del ICV no la incluye (N+, adn40).
    nl: {
      detalle: "Nuevo León no cobra tenencia desde 2018. Lo que pagas cada año es el refrendo de tus placas al Instituto de Control Vehicular, que en 2026 dependió del modelo de tu auto.",
      fuente: "Congreso de Nuevo León (2017), Todo Sobre Autos (2026) y Posta (2025); refrendo 2026: N+ y adn40."
    },
    // La Ley de Ingresos de Chiapas 2026 no trae impuesto de tenencia (solo el de adquisición de vehículos usados),
    // y Todo Sobre Autos (2026) dice que no hay tenencia estatal. Lo que se paga es el refrendo.
    chis: {
      detalle: "Chiapas no cobra tenencia en 2026: su Ley de Ingresos no la incluye. Lo que pagas cada año es el refrendo de tu tarjeta de circulación, con descuento si pagas en enero, febrero o marzo.",
      fuente: "Ley de Ingresos del Estado de Chiapas 2026, Todo Sobre Autos (2026) y TV Azteca (2026)."
    },
    // Michoacán no cobra tenencia estatal (Todo Sobre Autos, 2026: la Ley de Hacienda no la contempla; TramitaSeguro,
    // desde 2012; Récord, ene 2026, lo lista entre los estados sin tenencia).
    mich: {
      detalle: "Michoacán no cobra tenencia en 2026. Lo que pagas cada año es el refrendo de tus placas, con 10% de descuento si pagas en enero.",
      fuente: "Todo Sobre Autos (2026), Récord (enero de 2026) y TramitaSeguro (2026); refrendo 2026: Tus Buenas Noticias y adn40."
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
      corto: e.corto || t.corto, detalle: r ? r.detalle : t.detalle(conArticulo(e)), fuente: r ? r.fuente : "",
      descripcionPortal: e.textoPortal || TEXTO_PORTAL[e.portal],
      nombreFrase: conArticulo(e), dominio: new URL(e.url).hostname, confirmado: false
    });
  }

  // Estados en orden alfabético por el nombre que se ve en el selector ("Estado de México" va en la E).
  function estadosOrdenados() {
    return ESTADOS.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  // ---------------------------------------------------------------- Tenencia y refrendo 2026: una página por estado
  // Una entrada por cada estado que ya tiene su página en auto/tenencia/<slug>/ (la lista de los 32 está en
  // auto/tenencia/). Para agregar un estado: copia una entrada, pon sus cifras con 2 fuentes cada una, crea la
  // página copiando la de un estado parecido y quítale el "próximamente" en auto/tenencia/index.html.
  // Revisado el 16 de noviembre de 2026 (Veracruz, Puebla y Guanajuato, el 18 de noviembre; Nuevo León, Chiapas y
  // Michoacán, el 20 de noviembre; Oaxaca, Chihuahua y Guerrero, el 23 de noviembre). Ningún portal oficial se pudo abrir desde nuestra red (403): cada cifra
  // se confirmó con al menos 2 fuentes secundarias y queda pendiente de cotejar en el portal del estado.
  // refrendo: lo que cuesta el pago anual de placas y tarjeta (null = no encontramos el monto).
  // tope: valor del vehículo con IVA hasta el que aplica el subsidio de 100% a la tenencia (null = no hay tenencia).
  // plazo: último día para pagar a tiempo (con subsidio o sin recargos). placas: año de las placas que da el
  // subsidio completo y el de la mitad. extras: cobros que se suman al refrendo. descuentoEnLinea: pronto pago.
  const PAGINAS_TENENCIA = {
    mex: {
      slug: "estado-de-mexico", corto: "Edomex", cobraTenencia: true,
      // Refrendo 2026: $990 autos y $731 motos (en 2025 fueron $917 y $677). El Imparcial (7 ene 2026),
      // Expansión (28 ene 2026) y adn40 (16 mar 2026).
      refrendo: { auto: 990, moto: 731 },
      // Subsidio de 100% para valor con IVA de hasta $638,000 (autos) y $250,000 (motos): las mismas tres fuentes.
      tope: { auto: 638000, moto: 250000 },
      // Plazo del subsidio: lunes 6 de abril de 2026 (Expansión, 28 ene 2026; adn40, 16 mar 2026).
      plazo: "2026-04-06",
      // Placas expedidas en 2021 o después: 100%; placas de 2020: 50% (adn40, 16 mar 2026; Crónica, 6 ene 2026,
      // y Uno TV con el acuerdo de la Gaceta del Gobierno del 19 dic 2025). Placas más viejas: sin dato confirmado.
      placas: { completo: 2021, mitad: 2020 },
      extras: [], descuentoEnLinea: null
    },
    cdmx: {
      slug: "ciudad-de-mexico", corto: "CDMX", cobraTenencia: true,
      // Refrendo (renovación anual de la tarjeta de circulación, art. 219 del Código Fiscal de la CDMX): $760.
      // Uno TV (5 ene 2026), El Financiero (31 dic 2025) y adn40 (25 jun 2026). De motos no encontramos el monto.
      refrendo: { auto: 760, moto: null },
      // Tope del subsidio con IVA: $638,000 autos y $250,000 motos (Uno TV, 5 ene 2026; El Financiero, 31 dic 2025).
      tope: { auto: 638000, moto: 250000 },
      // Plazo: 31 de marzo de 2026, ampliado al 30 de junio de 2026 (El Imparcial, 29 abr 2026; adn40, 25 jun 2026).
      plazo: "2026-06-30", plazoOriginal: "2026-03-31",
      placas: null, extras: [], descuentoEnLinea: null
    },
    jal: {
      slug: "jalisco", corto: "Jalisco", cobraTenencia: false,
      // Refrendo 2026: $1,000 autos y camionetas y $600 motos, más $40 para la Cruz Roja y $60 para el Hogar
      // Cabañas: $1,100 y $700 en total. Uno TV (6 ene 2026) y TV Azteca (ene 2026); los $1,000, también adn40.
      refrendo: { auto: 1000, moto: 600 },
      extras: [{ nombre: "Cruz Roja", monto: 40 }, { nombre: "Hogar Cabañas", monto: 60 }],
      tope: null, placas: null,
      // Ese precio vale del 2 de enero al último día hábil de marzo (martes 31 de marzo de 2026); después hay
      // recargos. Uno TV (6 ene 2026) y adn40 ("antes de concluir marzo", mar 2026).
      plazo: "2026-03-31",
      // 5% de descuento por pagar en línea en enero y febrero: TV Azteca y adn40. No dicen si se aplica también
      // a los $100 de donativos: lo aplicamos solo a los $1,000 (o $600) del refrendo, como estimación.
      descuentoEnLinea: { porcentaje: 5, hasta: "2026-02-28" }
    },
    ver: {
      slug: "veracruz", corto: "Veracruz", cobraTenencia: true,
      // Control vehicular 2026, con el 15% de fomento a la educación: $1,239 autos (Uno TV, 7 ene 2026; La Silla
      // Rota, 3 ene 2026, con el precio de la Oficina Virtual de Hacienda) y $690 motos (Uno TV). Es el precio de
      // enero: se calcula en UMA y Todo Sobre Autos da $1,287 y $715 después de la UMA de febrero (una sola
      // fuente; la diferencia cuadra con la subida de la UMA de $113.14 a $117.31).
      refrendo: { auto: 1239, moto: 690 },
      // Sin tope de valor publicado para el estímulo de 100% (Al Calor Político, adn40, La Silla Rota).
      tope: null,
      // Estímulo del 1 de enero al 31 de marzo de 2026 (Al Calor Político, 31 dic 2025; adn40, 24 mar 2026).
      // Todo Sobre Autos dice hasta el 30 de abril: no lo usamos porque las otras dos fuentes dicen 31 de marzo.
      plazo: "2026-03-31",
      // Pide la verificación vehicular hecha (Al Calor Político y adn40).
      pideVerificacion: true,
      placas: null, extras: [], descuentoEnLinea: null,
      // Descuento al control vehicular por pagar antes: 15% en enero, 8% en febrero y 7% en marzo (La Silla
      // Rota, 3 ene 2026, y Todo Sobre Autos, con el art. 16 B del Código de Derechos). Lo aplicamos al precio de
      // enero como estimación.
      descuentosPorMes: { enero: 15, febrero: 8, marzo: 7 }
    },
    pue: {
      slug: "puebla", corto: "Puebla", cobraTenencia: true,
      // Control vehicular 2026: $700, igual para autos y motos (en 2025, $670). N+ (7 ene 2026), adn40 (2 mar y
      // 6 abr 2026), TV Azteca (30 mar 2026) y Todo Sobre Autos (autos y motos, art. 31 A de la Ley de Ingresos).
      // Uno TV (7 ene 2026) da $235 a $890 para motos según los cilindros, pero TV Azteca dice que esos montos
      // son de la tenencia completa: usamos $700, que dan adn40 y Todo Sobre Autos para motos.
      refrendo: { auto: 700, moto: 700 },
      tope: null,
      // Plazo del 31 de marzo ampliado al jueves 30 de abril de 2026 (N+, 1 abr 2026; adn40, 6 abr 2026).
      plazo: "2026-04-30", plazoOriginal: "2026-03-31",
      placas: null, extras: [], descuentoEnLinea: null
    },
    gto: {
      slug: "guanajuato", corto: "Guanajuato", cobraTenencia: true,
      // Refrendo 2026: $940 autos (en 2025, $672; el Congreso bajó la propuesta de $1,180). Uno TV (7 ene 2026),
      // Tus Buenas Noticias (18 dic 2025) y El Universal. Motos: $200 según Todo Sobre Autos y Eje Central
      // (propuesta, 11 dic 2025) y $198 según Uno TV: usamos $200 como estimación.
      refrendo: { auto: 940, moto: 200 },
      // Tenencia (impuesto a vehículos de mayor valor) solo si el vehículo vale más de $522,000 con IVA
      // ($450,000 sin IVA): calculadora 2026 de la Secretaría de Finanzas (vista en el buscador) y Todo Sobre Autos.
      // No hay subsidio que dependa del plazo: solo cuenta el valor.
      tope: { auto: 522000, moto: 522000 }, soloPorValor: true,
      // Plazo sin multa: 31 de marzo, ampliado al jueves 9 de abril de 2026 (Uno TV, 3 abr 2026; Todo Sobre Autos).
      plazo: "2026-04-09", plazoOriginal: "2026-03-31",
      placas: null, extras: [], descuentoEnLinea: null
    },
    nl: {
      slug: "nuevo-leon", corto: "Nuevo León", cobraTenencia: false,
      // Refrendo 2026 del Instituto de Control Vehicular, en UMA (con la UMA de enero, $113.14). Precio normal y
      // precio de enero (pronto pago), por modelo: 2011 o anterior $2,206 y $1,075; 2012 a 2016 $2,829 y $1,698;
      // 2017 o más nuevo $3,960 y $3,762; motos, remolques y todoterreno $792 y $752; eléctricos $1,980 y $1,881.
      // N+ (2 ene 2026), Tus Buenas Noticias (14 ene 2026), Posta y El Congresista (ene 2026); los de enero,
      // también adn40 (5 mar 2026). Todo Sobre Autos da $4,106, $2,933, $2,288, $821 y $2,053 con la UMA de
      // febrero ($117.31): una sola fuente, así que usamos los de enero. Uno TV (7 ene 2026) trae $3,368, $1,657 y
      // $1,030, que no coinciden con ninguna otra fuente de 2026: no los usamos.
      refrendo: { auto: 3960, moto: 792, electrico: 1980 },
      // Tarifa según el modelo (hasta = último año del rango). enero: lo que costaba pagando en enero.
      tarifas: {
        auto: [{ hasta: 2011, monto: 2206, enero: 1075 }, { hasta: 2016, monto: 2829, enero: 1698 }, { monto: 3960, enero: 3762 }],
        moto: [{ monto: 792, enero: 752 }],
        electrico: [{ monto: 1980, enero: 1881 }]
      },
      tope: null, placas: null, extras: [], descuentoEnLinea: null,
      // Sin recargos hasta el último día hábil de marzo: martes 31 de marzo de 2026 (adn40, 5 mar 2026, con el ICV;
      // Uno TV, 20 mar 2026; Todo Sobre Autos).
      plazo: "2026-03-31"
    },
    chis: {
      slug: "chiapas", corto: "Chiapas", cobraTenencia: false,
      // Refrendo 2026, servicio particular: $1,219 autos y $1,043 motos, ya con el 6% del art. 261 D del Código
      // Fiscal (Todo Sobre Autos y TV Azteca, 17 jun 2026). Uno TV (7 ene 2026) da $1,150 y $984, que son los mismos
      // montos sin ese 6% ($1,150 x 1.06 = $1,219). En 2025 eran $872 y $714 en la Ley de Derechos.
      refrendo: { auto: 1219, moto: 1043 },
      tope: null, placas: null, extras: [], descuentoEnLinea: null,
      // Se paga en los tres primeros meses del año (art. 6 de la Ley de Derechos; Uno TV, 20 mar 2026; Todo Sobre Autos).
      plazo: "2026-03-31",
      // Descuento por pronto pago: 15% en enero, 10% en febrero y 5% en marzo (art. 4 A, fr. III, de la Ley de
      // Ingresos 2026 y Todo Sobre Autos). Solo para quien no tiene adeudos (TV Azteca y Uno TV).
      descuentosPorMes: { enero: 15, febrero: 10, marzo: 5 }, descuentoPideAlCorriente: true
    },
    mich: {
      slug: "michoacan", corto: "Michoacán", cobraTenencia: false,
      // Refrendo 2026: $1,256 autos y camionetas y $401 motos (Uno TV, 7 ene 2026; adn40, 27 abr 2026; Todo Sobre
      // Autos, con el art. 20 de la Ley de Ingresos 2026). Los $1,256 también en Tus Buenas Noticias (6 ene 2026).
      refrendo: { auto: 1256, moto: 401 },
      tope: null, placas: null, extras: [], descuentoEnLinea: null,
      // Sin recargos hasta el jueves 30 de abril de 2026 (adn40, con la Secretaría de Finanzas; Tus Buenas Noticias;
      // Todo Sobre Autos).
      plazo: "2026-04-30",
      // 10% de descuento pagando en enero, en línea o en ventanilla: Tus Buenas Noticias, El Congresista (5 ene
      // 2026), Sobrecontexto (8 ene 2026) y Todo Sobre Autos.
      descuentosPorMes: { enero: 10 }
    },
    oax: {
      slug: "oaxaca", corto: "Oaxaca", cobraTenencia: true,
      // Paquete de derechos 2026 para autos particulares: placas, refrendo, tarjeta de circulación y verificación por
      // $2,299 en enero (NVI Noticias, 6 ene 2026; La Tinta Oaxaca, 6 ene 2026; El Universal Oaxaca, 8 ene 2026; Ecos
      // del Pacífico, 9 ene 2026). En 2025 fueron $2,316. Se cobra en UMA: desde febrero subió con la UMA nueva y
      // ninguna fuente da el monto; con $117.31 / $113.14 serían unos $2,384 (estimado nuestro). Motos: $723 al año,
      // solo Todo Sobre Autos (estimado).
      refrendo: { auto: 2299, moto: 723 },
      // Estímulo de 100% a la tenencia sin tope de valor publicado, para quien está al corriente (La Tinta Oaxaca).
      tope: null,
      // Plazo con estímulo para quien no tiene adeudos: 30 de junio de 2026 (Rastreator y Seguro Inteligente; también
      // MexiCenter). Ninguna nota de prensa ni fuente oficial lo da: estimado. Esas mismas páginas dan hasta el
      // 19 de diciembre de 2026 para regularizar adeudos de 2022 a 2025 con el estímulo.
      plazo: "2026-06-30", plazoEstimado: true, regularizarHasta: "2026-12-19",
      // Precio de febrero en adelante, estimado con la UMA de febrero (ver arriba).
      precioDesdeFebreroEstimado: 2384,
      placas: null, extras: [], descuentoEnLinea: null
    },
    chih: {
      slug: "chihuahua", corto: "Chihuahua", cobraTenencia: false,
      // Revalidación vehicular 2026 (tarjeta de circulación, Cruz Roja e impuesto universitario) por modelo, con
      // descuento por pronto pago en febrero, marzo y abril: comunicado de la Secretaría de Hacienda de Chihuahua del
      // 29 ene 2026 (chihuahua.gob.mx), N+ (29 ene 2026), adn40 (19 y 22 abr 2026, los de abril) y Chihuahua Hoy.
      // Desde el 1 de mayo, $2,749 para todos los modelos: comunicado del 29 abr 2026 y La Voz del Desierto (8 may
      // 2026). Uno TV (7 ene 2026) daba $2,649 antes del anuncio: no lo usamos. Motos: no se publica (Todo Sobre Autos).
      refrendo: { auto: 2749, moto: null },
      // Tarifa según el modelo (hasta = último año del rango); monto = desde el 1 de mayo.
      tarifas: {
        auto: [
          { hasta: 1995, monto: 2749, febrero: 1507, marzo: 1558, abril: 1609 },
          { hasta: 2000, monto: 2749, febrero: 1660, marzo: 1762, abril: 1864 },
          { hasta: 2005, monto: 2749, febrero: 1762, marzo: 1864, abril: 1966 },
          { hasta: 2010, monto: 2749, febrero: 1915, marzo: 2017, abril: 2119 },
          { hasta: 2015, monto: 2749, febrero: 2068, marzo: 2170, abril: 2272 },
          { hasta: 2020, monto: 2749, febrero: 2272, marzo: 2374, abril: 2476 },
          { monto: 2749, febrero: 2325, marzo: 2427, abril: 2529 }
        ]
      },
      tope: null, placas: null, extras: [], descuentoEnLinea: null,
      // Último día con descuento: jueves 30 de abril de 2026 (comunicado del 29 abr 2026; adn40, 22 abr 2026).
      plazo: "2026-04-30"
    },
    gro: {
      slug: "guerrero", corto: "Guerrero", cobraTenencia: true,
      // No encontramos el monto 2026 de los derechos de control vehicular con dos fuentes: Uno TV (7 ene 2026) da de
      // $500 a $1,500 según el vehículo, con precios de 2025; sitios de trámites dan $618 o unos $520.
      refrendo: { auto: null, moto: null },
      // Tenencia sin subsidio confirmado (ver TENENCIA_2026.gro): se paga completa, con descuento por pronto pago.
      tope: null, sinSubsidio: true,
      // Descuento sobre la tenencia: 10% en enero, 8% en febrero y 5% en marzo (Gobierno de Guerrero, 9 ene 2026;
      // Quadratín Guerrero; Uno TV, 20 mar 2026: "antes de finalizar marzo"; Rastreator).
      descuentosPorMes: { enero: 10, febrero: 8, marzo: 5 }, descuentoSobre: "tenencia",
      plazo: "2026-03-31",
      placas: null, extras: [], descuentoEnLinea: null
    }
  };
  // Meses en los que una tarifa por modelo puede traer su propio precio de pronto pago (Nuevo León, Chihuahua).
  const MESES_PRONTO_PAGO = ["enero", "febrero", "marzo", "abril"];
  const TIPOS_VEHICULO = ["auto", "moto"];
  const MAX_VALOR = 1e8, MAX_ATRASO = 20;

  // "Estado de México" -> "estado-de-mexico". Sirve para la dirección de la página de cada estado.
  function slugEstado(nombre) {
    return String(nombre).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // Los 32 estados para la lista de auto/tenencia/, en orden alfabético, con su dirección y si ya tiene página.
  function estadosTenencia() {
    return estadosOrdenados().map(e => {
      const p = PAGINAS_TENENCIA[e.clave];
      return { clave: e.clave, nombre: e.nombre, slug: p ? p.slug : slugEstado(e.nombre), lista: !!p };
    });
  }

  // Datos de la página de un estado (con su nombre), o null si todavía no tiene página.
  function paginaTenencia(clave) {
    const p = PAGINAS_TENENCIA[clave];
    const e = ESTADOS.find(x => x.clave === clave);
    if (!p || !e) return null;
    return Object.assign({ clave, nombre: e.nombre, nombreFrase: conArticulo(e), url: e.url }, p);
  }

  // Cuánto pagas en 2026 por tu auto o moto en un estado con página.
  // momento: "aTiempo" (antes del plazo), "tarde" (después del plazo) o "descuento" (en línea en enero o febrero,
  // solo donde hay descuento por pronto pago). valor: valor del vehículo con IVA (el de la factura).
  // alCorriente: sin adeudos de años anteriores. anioPlacas: año en que te dieron las placas (solo Edomex).
  // aniosAtrasados: refrendos de años anteriores que no pagaste (se estiman al costo de 2026, sin recargos).
  // verificado: ya hiciste la verificación vehicular (solo cuenta donde el subsidio la pide, como Veracruz).
  // En Veracruz, Chiapas y Michoacán, momento también puede ser "enero", "febrero" o "marzo" (descuento por mes de
  // pago). modelo: año del modelo del vehículo (solo donde el refrendo depende de él, como Nuevo León; sin modelo
  // se usa la tarifa de los más nuevos). tipo también puede ser "electrico" donde el estado tiene tarifa propia.
  // En Chihuahua, momento puede ser "febrero", "marzo" o "abril" (precio por modelo de cada mes); "tarde" es desde mayo.
  // montoTenencia: la tenencia que te da el portal, solo donde se paga completa con descuento por pronto pago
  // (Guerrero); ahí el descuento del mes se aplica a la tenencia y no al refrendo.
  function pagoTenencia2026(clave, { tipo = "auto", valor, alCorriente = true, momento = "aTiempo", anioPlacas, aniosAtrasados = 0, verificado = true, modelo, montoTenencia } = {}) {
    const p = paginaTenencia(clave);
    if (!p) return null;
    const t = TIPOS_VEHICULO.includes(tipo) || (typeof tipo === "string" && Object.prototype.hasOwnProperty.call(p.refrendo, tipo)) ? tipo : "auto";
    let refrendo = p.refrendo[t];
    // Tarifa por modelo (Nuevo León): la primera cuyo rango incluye el modelo; sin modelo válido, la última.
    let tarifa = null;
    if (p.tarifas && p.tarifas[t]) {
      const lista = p.tarifas[t];
      const m = modelo === undefined || modelo === null || modelo === "" ? NaN : Math.floor(+modelo);
      tarifa = Number.isFinite(m) ? lista.find(x => x.hasta === undefined || m <= x.hasta) : lista[lista.length - 1];
      refrendo = tarifa.monto;
    }
    const sinRefrendo = refrendo === null || refrendo === undefined;
    const v = acotar(valor, MAX_VALOR);
    const at = acotar(aniosAtrasados, MAX_ATRASO);
    const atrasados = Math.floor(at.valor);
    const tarde = momento === "tarde";
    let pctDescuento = 0;
    if (p.descuentosPorMes && p.descuentosPorMes[momento] !== undefined) pctDescuento = p.descuentosPorMes[momento];
    else if (p.descuentoEnLinea && momento === "descuento") pctDescuento = p.descuentoEnLinea.porcentaje;
    // Donde el descuento pide estar al corriente (Chiapas), con adeudos no hay descuento.
    const sinDescuentoPorAdeudo = !!(p.descuentoPideAlCorriente && pctDescuento && (!alCorriente || atrasados > 0));
    if (sinDescuentoPorAdeudo) pctDescuento = 0;

    const extras = p.extras.reduce((s, x) => s + x.monto, 0);
    const sobreTenencia = p.descuentoSobre === "tenencia";
    let descuento = pctDescuento && !sinRefrendo && !sobreTenencia ? Calc.redondear(refrendo * pctDescuento / 100) : 0;
    // Con tarifa por modelo, el precio de pronto pago de cada mes viene en pesos (no es un porcentaje parejo).
    if (tarifa && MESES_PRONTO_PAGO.includes(momento) && tarifa[momento] !== undefined) descuento = Calc.redondear(tarifa.monto - tarifa[momento]);

    // Subsidio a la tenencia: "noAplica" (el estado no cobra tenencia), "completo" (100%), "mitad" (50%),
    // "no" (lo pierdes) o "faltaValor" (falta escribir el valor). motivos: por qué no te toca completo.
    let subsidio = "noAplica";
    const motivos = [];
    // Sin tope (Veracruz, Puebla) no hace falta el valor. Con soloPorValor (Guanajuato) solo cuenta el valor.
    const tope = p.tope && p.tope[t] !== null && p.tope[t] !== undefined ? p.tope[t] : null;
    if (p.cobraTenencia && p.sinSubsidio) subsidio = "sinSubsidio";
    else if (p.cobraTenencia) {
      if (tope !== null && v.valor === 0) subsidio = "faltaValor";
      else {
        if (tope !== null && v.valor > tope) motivos.push("valor");
        if (!p.soloPorValor) {
          if (!alCorriente || atrasados > 0) motivos.push("adeudos");
          if (p.pideVerificacion && !verificado) motivos.push("verificacion");
          if (tarde) motivos.push("plazo");
        }
        let pct = 100;
        if (p.placas && anioPlacas !== undefined && anioPlacas !== "") {
          const a = +anioPlacas;
          if (a < p.placas.mitad) { motivos.push("placas"); pct = 0; }
          else if (a < p.placas.completo) pct = 50;
        }
        subsidio = motivos.length ? "no" : pct === 50 ? "mitad" : "completo";
      }
    }
    // Si no tienes el subsidio completo, además pagas la tenencia (o la mitad): el monto lo da el portal del estado.
    // "sinSubsidio" (Guerrero): la tenencia se paga completa, con el descuento del mes si lo hay.
    const pagasTenencia = subsidio === "no" || subsidio === "mitad" || subsidio === "sinSubsidio";
    const refrendoNeto = sinRefrendo ? 0 : refrendo - descuento;
    const adeudoEstimado = sinRefrendo ? 0 : atrasados * (refrendo + extras);
    const mt = acotar(montoTenencia, MAX_VALOR);
    const tenencia = subsidio === "sinSubsidio" ? mt.valor : 0;
    const descuentoTenencia = sobreTenencia && pctDescuento ? Calc.redondear(tenencia * pctDescuento / 100) : 0;
    const tenenciaNeta = tenencia - descuentoTenencia;
    const total = (sinRefrendo ? 0 : refrendoNeto + extras + adeudoEstimado) + tenenciaNeta;
    return {
      clave, nombre: p.nombre, tipo: t, valor: v.valor, refrendo: sinRefrendo ? null : refrendo, sinRefrendo, extras, descuento,
      refrendoNeto, subsidio, motivos, pagasTenencia, tope, plazo: p.plazo, sinDescuentoPorAdeudo,
      recargos: tarde, atrasados, adeudoEstimado, tenencia, descuentoTenencia, tenenciaNeta, total,
      recortado: v.recortado || at.recortado || mt.recortado
    };
  }

  const api = {
    DATOS, MESES, ESTADOS, HOLOGRAMAS, num, acotar, gasolinaViaje, digitoValido, engomado, turnoVerificacion,
    sabadosDelMes, hoyNoCircula, sabadosSinCircular, multaExtemporaneaCdmx, listaDias, tenenciaEstado, estadosOrdenados,
    PAGINAS_TENENCIA, slugEstado, estadosTenencia, paginaTenencia, pagoTenencia2026
  };
  if (enNode) module.exports = api;
  else raiz.Auto = api;
})(this);
