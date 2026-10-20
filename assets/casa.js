// Cálculos de la sección Casa y servicios de Cuentas Claras MX: recibo de luz de CFE, consumo de aparatos y gas LP.
// Funciones puras, sin datos personales: todo se calcula en el navegador de la persona.
// No usa la UMA ni el salario mínimo. En el navegador carga antes ../../assets/calc.js para tener mxn().
(function (raiz) {
  // Rangos de consumo de un bloque: hasta cuántos kWh AL MES llega (acumulado). El último no tiene tope.
  const tres = (basico, intermedio) => [
    { clave: "basico", nombre: "Básico", hasta: basico },
    { clave: "intermedio", nombre: "Intermedio", hasta: intermedio },
    { clave: "excedente", nombre: "Excedente", hasta: Infinity }
  ];
  const cuatro = (basico, bajo, alto) => [
    { clave: "basico", nombre: "Básico", hasta: basico },
    { clave: "intermedio", nombre: "Intermedio bajo", hasta: bajo },
    { clave: "intermedioAlto", nombre: "Intermedio alto", hasta: alto },
    { clave: "excedente", nombre: "Excedente", hasta: Infinity }
  ];

  const DATOS = {
    anio: 2026,
    revisado: "octubre de 2026",

    // IVA: tasa general de 16% (Ley del Impuesto al Valor Agregado, art. 1). Se cobra sobre el importe de la energía.
    iva: 0.16,
    // IVA de 8% en la región fronteriza norte y sur: no es una tasa de la ley, es un estímulo fiscal (crédito de 50%
    // del IVA) de los decretos de estímulos fiscales región fronteriza norte (DOF, 31 de diciembre de 2018) y sur
    // (DOF, 30 de diciembre de 2020), prorrogados hasta el 31 de diciembre de 2026 (DOF, 31 de diciembre de 2025).
    // PENDIENTE: verificar con el DOF o el SAT (no abrieron desde nuestra red en octubre de 2026). La prórroga y la
    // tasa efectiva de 8% las confirman fuentes secundarias (AMCPDF, Trade Law College, IDC Online); que CFE la aplique
    // en recibos domésticos solo lo reporta la prensa local (La Voz de la Frontera). Por eso la persona elige la tasa
    // que trae su recibo y por omisión usamos 16%.
    ivaFrontera: 0.08,

    // Tarifas domésticas de CFE (1 y 1A a 1F). Rangos de consumo AL MES en kWh; en un recibo bimestral se duplican.
    // clima: temperatura media mínima en verano (°C) de las localidades donde aplica la tarifa.
    // dac: límite de alto consumo, en kWh al mes, medido como promedio de los últimos 12 meses.
    // Fuente: tarifas para uso doméstico publicadas por CFE (app.cfe.mx > Tarifas > Casa). Estructura sin cambios
    // en años recientes. PENDIENTE: cotejar con la página oficial de CFE; no abrió desde nuestra red en octubre de 2026.
    // Los precios por kWh NO se guardan aquí: cambian con el tiempo y la persona los copia de su recibo.
    tarifas: {
      "1": { clima: null, dac: 250, todoElAnio: tres(75, 140) },
      "1A": { clima: 25, dac: 300, verano: tres(100, 150), fuera: tres(75, 150) },
      "1B": { clima: 28, dac: 400, verano: tres(125, 225), fuera: tres(75, 175) },
      "1C": { clima: 30, dac: 850, verano: cuatro(150, 300, 450), fuera: tres(75, 175) },
      "1D": { clima: 31, dac: 1000, verano: cuatro(175, 400, 600), fuera: tres(75, 200) },
      "1E": { clima: 32, dac: 2000, verano: cuatro(300, 750, 900), fuera: tres(75, 200) },
      "1F": { clima: 33, dac: 2500, verano: cuatro(300, 1200, 2500), fuera: tres(75, 200) }
    },
    // Avisamos que te acercas a la DAC cuando tu promedio llega a 80% del límite (criterio propio, no oficial).
    avisoDac: 0.8,

    // Precios de EJEMPLO por kWh (sin IVA) para que la calculadora arranque con números. No son tarifas oficiales.
    preciosEjemplo: { basico: 1.10, intermedio: 1.35, intermedioAlto: 1.70, excedente: 3.90 },
    // Precio promedio de EJEMPLO por kWh ya con IVA para la calculadora de aparatos (no es una tarifa oficial).
    precioKwhEjemplo: 1.60,

    // Aparatos comunes con potencias TÍPICAS de ejemplo (watts) y un uso de ejemplo. Son valores de referencia
    // editables: la potencia real viene en la etiqueta o placa de cada aparato.
    aparatos: [
      { id: "focos", nombre: "Focos LED", cantidad: 6, watts: 9, horas: 5, dias: 30 },
      { id: "refri", nombre: "Refrigerador", cantidad: 1, watts: 150, horas: 8, dias: 30, nota: "El motor no trabaja todo el día: 8 horas es un ejemplo del tiempo que está encendido." },
      { id: "tv", nombre: "Televisión", cantidad: 1, watts: 80, horas: 5, dias: 30 },
      { id: "ventilador", nombre: "Ventilador", cantidad: 1, watts: 60, horas: 8, dias: 30 },
      { id: "minisplit", nombre: "Aire acondicionado minisplit", cantidad: 0, watts: 1100, horas: 8, dias: 30, nota: "Viene en 0. Pon 1 si tienes uno. Los 1,100 W son un ejemplo para un equipo de 1 tonelada." },
      { id: "lavadora", nombre: "Lavadora", cantidad: 1, watts: 500, horas: 1, dias: 12 },
      { id: "plancha", nombre: "Plancha", cantidad: 1, watts: 1000, horas: 1, dias: 8 },
      { id: "microondas", nombre: "Horno de microondas", cantidad: 1, watts: 1200, horas: 0.25, dias: 30 },
      { id: "laptop", nombre: "Computadora portátil", cantidad: 1, watts: 60, horas: 4, dias: 30 },
      { id: "modem", nombre: "Módem de internet", cantidad: 1, watts: 10, horas: 24, dias: 30 },
      { id: "cargador", nombre: "Cargador de celular", cantidad: 2, watts: 10, horas: 2, dias: 30 },
      { id: "bomba", nombre: "Bomba de agua", cantidad: 1, watts: 500, horas: 0.5, dias: 30 },
      { id: "licuadora", nombre: "Licuadora", cantidad: 1, watts: 400, horas: 0.1, dias: 30 },
      { id: "otro", nombre: "Otro aparato", cantidad: 0, watts: 0, horas: 0, dias: 30 }
    ],

    gas: {
      // Densidad de REFERENCIA del gas LP líquido para pasar de kilos a litros. El propano pesa cerca de 0.51 kg
      // por litro y el butano cerca de 0.58; la mezcla que se vende en México queda en medio. Los precios máximos
      // semanales de la CNE de 2026, según la prensa (UnoTV), guardan esa relación: CDMX del 11 al 17 de octubre de
      // 2026, $20.34 por kilo y $10.98 por litro (10.98 ÷ 20.34 = 0.540); del 25 al 31 de enero de 2026, $19.12 y
      // $10.32 (0.540). PENDIENTE: confirmarlo en la publicación oficial de la CNE (no abrió en octubre de 2026).
      densidad: 0.54,
      densidadMin: 0.4, densidadMax: 0.7,
      // Tamaños comunes de cilindro, en kilos de gas.
      cilindros: [10, 20, 30, 45],
      // Precio de EJEMPLO por kilo. No es el precio máximo oficial de ninguna región.
      precioKiloEjemplo: 20,
      // Uso de EJEMPLO para estimar cuánto te dura: estimaciones propias, no oficiales.
      // Un quemador de estufa mediano a fuego alto gasta alrededor de 0.2 kg por hora.
      // Un calentador de paso con una regadera de unos 10 litros por minuto gasta alrededor de 0.025 kg por minuto.
      kgHoraEstufa: 0.2,
      kgMinutoCalentador: 0.025
    },

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: {
      kwh: 100000, kwhAnual: 1200000, precioKwh: 50,
      cantidad: 100, watts: 20000, horas: 24, dias: 31,
      precioGas: 1000, kilos: 1000, litros: 100000, porcentaje: 100,
      horasEstufa: 24, kgHora: 2, minutos: 1440, kgMinuto: 0.5, diasDura: 3650
    }
  };
  const MAX = DATOS.maximos;

  // Número dentro de [min, max]. Vacío, texto o NaN cuenta como 0; lo que se sale del rango se recorta.
  // Devuelve { valor, recortado } para poder avisar en la página.
  function rango(x, min, max) {
    const crudo = x === "" || x === null || x === undefined ? 0 : +x;
    const n = Number.isNaN(crudo) ? 0 : crudo;
    if (n > max) return { valor: max, recortado: true };
    if (n < min) return { valor: min, recortado: true };
    return { valor: n, recortado: false };
  }

  // Redondeo a centavos, como en un recibo.
  function r2(n) {
    return Math.round(n * 100 + 1e-6) / 100;
  }

  // ---------- Recibo de luz ----------

  // Bloques de una tarifa y temporada ("verano" o "fuera"). La tarifa 1 es igual todo el año.
  function bloquesLuz(tarifa, temporada) {
    const t = DATOS.tarifas[tarifa] || DATOS.tarifas["1"];
    if (t.todoElAnio) return t.todoElAnio;
    return temporada === "fuera" ? t.fuera : t.verano;
  }

  // Estimación del importe de energía de un recibo doméstico: reparte los kWh en bloques (básico, intermedio,
  // excedente), multiplica cada bloque por su precio, suma y agrega el IVA. Cada renglón se redondea a centavos.
  // meses: 2 para recibo bimestral (los rangos se duplican) o 1 para mensual.
  // kwhAnual (opcional): suma de kWh de los últimos 12 meses, para revisar el límite de la tarifa DAC.
  // Sin kwhAnual, el promedio mensual se estima suponiendo que todo el año consumes como en este recibo.
  // tasaIva: 0.16 (general) o 0.08 (región fronteriza, si así viene en el recibo). Cualquier otro valor usa 0.16.
  // No incluye el Derecho de Alumbrado Público (DAP) del municipio, adeudos ni otros cargos.
  function reciboLuz({ tarifa = "1", temporada = "verano", meses = 2, kwh, precios = {}, kwhAnual, tasaIva } = {}) {
    const clave = DATOS.tarifas[tarifa] ? String(tarifa) : "1";
    const info = DATOS.tarifas[clave];
    const m = +meses === 1 ? 1 : 2;
    const conTemporada = !info.todoElAnio;
    const temp = conTemporada ? (temporada === "fuera" ? "fuera" : "verano") : "todo";
    const k = rango(kwh, 0, MAX.kwh);
    let recortado = k.recortado, sinPrecio = false, antes = 0, energia = 0;

    const filas = bloquesLuz(clave, temp).map(b => {
      const tope = b.hasta * m;
      const enBloque = Math.max(0, Math.min(k.valor, tope) - antes);
      const desde = antes + 1;
      antes = tope;
      const p = rango(precios[b.clave], 0, MAX.precioKwh);
      if (p.recortado) recortado = true;
      if (enBloque > 0 && p.valor === 0) sinPrecio = true;
      const subtotal = r2(enBloque * p.valor);
      energia += subtotal;
      return { clave: b.clave, nombre: b.nombre, desde, hasta: Number.isFinite(tope) ? tope : null, kwh: enBloque, precio: p.valor, subtotal };
    });

    energia = r2(energia);
    const tasa = +tasaIva === DATOS.ivaFrontera ? DATOS.ivaFrontera : DATOS.iva;
    const iva = r2(energia * tasa);
    const total = r2(energia + iva);

    const anual = rango(kwhAnual, 0, MAX.kwhAnual);
    if (anual.recortado) recortado = true;
    const usaAnual = anual.valor > 0;
    const promedioMensual = usaAnual ? anual.valor / 12 : k.valor / m;
    const limiteDac = info.dac;
    const estadoDac = promedioMensual > limiteDac ? "pasa" : promedioMensual >= DATOS.avisoDac * limiteDac ? "cerca" : "dentro";

    return {
      tarifa: clave, temporada: temp, conTemporada, meses: m, kwh: k.valor, filas, energia, tasaIva: tasa, iva, total,
      precioPromedio: k.valor > 0 ? total / k.valor : 0,
      usaAnual, promedioMensual, limiteDac, margenDac: limiteDac - promedioMensual, estadoDac,
      sinKwh: k.valor === 0, sinPrecio, recortado
    };
  }

  // ---------- Consumo de aparatos ----------

  // kWh al mes de un aparato: cantidad × watts × horas al día × días al mes ÷ 1,000.
  function consumoAparato({ cantidad, watts, horas, dias } = {}) {
    const c = rango(cantidad, 0, MAX.cantidad), w = rango(watts, 0, MAX.watts);
    const h = rango(horas, 0, MAX.horas), d = rango(dias, 0, MAX.dias);
    const kwhMes = c.valor * w.valor * h.valor * d.valor / 1000;
    return {
      cantidad: c.valor, watts: w.valor, horas: h.valor, dias: d.valor, kwhMes,
      recortado: c.recortado || w.recortado || h.recortado || d.recortado
    };
  }

  // Suma de una lista de aparatos y su costo con un precio por kWh (lo escribe la persona).
  function consumoAparatos(lista, precioKwh) {
    const p = rango(precioKwh, 0, MAX.precioKwh);
    let recortado = p.recortado;
    const aparatos = (lista || []).map(a => {
      const r = consumoAparato(a);
      if (r.recortado) recortado = true;
      return Object.assign({ id: a.id, nombre: a.nombre || "Aparato" }, r, { costoMes: r.kwhMes * p.valor });
    });
    const kwhMes = aparatos.reduce((s, a) => s + a.kwhMes, 0);
    const costoMes = kwhMes * p.valor;
    let mayor = null;
    aparatos.forEach(a => { if (a.kwhMes > 0 && (!mayor || a.kwhMes > mayor.kwhMes)) mayor = a; });
    return {
      precio: p.valor, aparatos, kwhMes, costoMes, kwhBimestre: kwhMes * 2, costoBimestre: costoMes * 2,
      mayor: mayor ? { id: mayor.id, nombre: mayor.nombre, kwhMes: mayor.kwhMes, porcentaje: mayor.kwhMes / kwhMes * 100 } : null,
      sinPrecio: p.valor === 0, recortado
    };
  }

  // ---------- Gas LP ----------

  function kilosALitros(kilos, densidad = DATOS.gas.densidad) {
    return densidad > 0 ? kilos / densidad : 0;
  }
  function litrosAKilos(litros, densidad = DATOS.gas.densidad) {
    return litros * densidad;
  }

  // Densidad válida: vacío o 0 usa la de referencia; fuera de 0.4 a 0.7 se recorta.
  function densidadGas(x) {
    const g = DATOS.gas;
    const n = rango(x, 0, 10).valor;
    if (n === 0) return { valor: g.densidad, porOmision: true, recortado: false };
    const r = rango(n, g.densidadMin, g.densidadMax);
    return { valor: r.valor, porOmision: false, recortado: r.recortado };
  }

  // Gasto de gas LP.
  // tipo "cilindro": compras cilindroKg kilos. tipo "tanque": cargas de "actual"% a "llenado"% de un tanque de
  // "capacidad" litros. precio por "kilo" o por "litro"; la densidad convierte entre los dos.
  // modo "uso": estima los kilos al día con la estufa y la regadera. modo "dias": usas diasDura que te dura la compra.
  function gasLP({ tipo = "cilindro", cilindroKg, capacidad, actual, llenado, precio, unidad = "kilo", densidad,
    modo = "uso", horasEstufa, kgHoraEstufa, minutosRegadera, kgMinutoCalentador, diasDura } = {}) {
    const dens = densidadGas(densidad);
    const d = dens.valor;
    const p = rango(precio, 0, MAX.precioGas);
    let recortado = dens.recortado || p.recortado;
    const porLitro = unidad === "litro";
    const precioKilo = porLitro ? p.valor / d : p.valor;
    const precioLitro = porLitro ? p.valor : p.valor * d;

    let kilos, litros, tanqueLleno = false;
    if (tipo === "tanque") {
      const cap = rango(capacidad, 0, MAX.litros), a = rango(actual, 0, MAX.porcentaje), l = rango(llenado, 0, MAX.porcentaje);
      recortado = recortado || cap.recortado || a.recortado || l.recortado;
      tanqueLleno = cap.valor > 0 && a.valor >= l.valor;
      litros = cap.valor * Math.max(0, l.valor - a.valor) / 100;
      kilos = litrosAKilos(litros, d);
    } else {
      const c = rango(cilindroKg, 0, MAX.kilos);
      recortado = recortado || c.recortado;
      kilos = c.valor;
      litros = kilosALitros(kilos, d);
    }
    const costo = kilos * precioKilo;

    let kgDia;
    if (modo === "dias") {
      const dd = rango(diasDura, 0, MAX.diasDura);
      recortado = recortado || dd.recortado;
      kgDia = dd.valor > 0 ? kilos / dd.valor : 0;
    } else {
      const h = rango(horasEstufa, 0, MAX.horasEstufa), kh = rango(kgHoraEstufa, 0, MAX.kgHora);
      const mi = rango(minutosRegadera, 0, MAX.minutos), km = rango(kgMinutoCalentador, 0, MAX.kgMinuto);
      recortado = recortado || h.recortado || kh.recortado || mi.recortado || km.recortado;
      kgDia = h.valor * kh.valor + mi.valor * km.valor;
    }
    const dias = kgDia > 0 ? kilos / kgDia : 0;
    const gastoDia = kgDia * precioKilo;

    return {
      tipo: tipo === "tanque" ? "tanque" : "cilindro", densidad: d, densidadPorOmision: dens.porOmision,
      precioKilo, precioLitro, kilos, litros, costo, kgDia, dias, gastoDia, gastoMes: gastoDia * 30,
      tanqueLleno, sinPrecio: p.valor === 0, sinUso: kgDia === 0, recortado
    };
  }

  const api = {
    DATOS, rango, redondear: r2, bloquesLuz, reciboLuz, consumoAparato, consumoAparatos,
    kilosALitros, litrosAKilos, densidadGas, gasLP
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Casa = api;
})(this);
