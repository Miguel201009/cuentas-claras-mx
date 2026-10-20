// Cálculos de la sección Negocio propio de Cuentas Claras MX: precio de venta con margen, IVA y comisión
// de terminal, y punto de equilibrio. Funciones puras, sin datos personales: todo se calcula en el navegador.
// En el navegador carga antes ../../assets/calc.js (de ahí salen el salario mínimo, el redondeo y mxn()).
(function (raiz) {
  const Calc = typeof module !== "undefined" && module.exports ? require("./calc.js") : raiz.Calc;
  const r2 = Calc.redondear;

  const DATOS = {
    anio: 2026,

    // Tasas de IVA que puede usar un negocio. Revisado en octubre de 2026.
    // general: 16%, art. 1 de la Ley del IVA (sin cambios desde 2010).
    // frontera: 8% efectivo. Decreto de estímulos fiscales región fronteriza norte (DOF 31 dic 2018) y región
    //   fronteriza sur (DOF 30 dic 2020): crédito de 50% de la tasa del IVA, solo para quien está inscrito en el
    //   padrón del SAT y vende o da el servicio en esa región. Prorrogados hasta el 31 dic 2026 por el decreto
    //   publicado en el DOF del 31 dic 2025 (edición vespertina). Confirmado en fuentes secundarias serias que
    //   citan esa nota del DOF; el portal del DOF no abrió desde nuestra red: pendiente cotejar el texto oficial.
    //   Revisar en enero de 2027 si hay nueva prórroga.
    // cero: 0%, art. 2-A de la Ley del IVA (por ejemplo, alimentos sin preparar y medicinas de patente). Los
    //   alimentos preparados pagan 16% aunque sean para llevar o a domicilio (art. 2-A, fr. I, último párrafo).
    // exento: no se cobra IVA (art. 9, 15 y 20 de la Ley del IVA), pero tampoco se recupera el IVA que pagas.
    iva: { general: 0.16, frontera: 0.08, cero: 0, exento: 0 },

    // Las terminales y ligas de pago cobran su comisión más IVA a la tasa general (art. 1 LIVA).
    // Si tu negocio está exento, ese IVA no lo recuperas y se vuelve costo.
    ivaComision: 0.16,

    // Límites para que una cifra absurda no rompa el resultado: lo que pase de aquí se recorta y se avisa.
    maximos: { monto: 1e9, margen: 99, comision: 50, unidades: 1e8, dias: 31 }
  };

  // Número válido, finito y positivo; vacío, texto, negativo o infinito cuenta como 0.
  function num(x) {
    const n = typeof x === "number" ? x : parseFloat(x);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Igual que num(), sin pasar de un máximo. Devuelve también si se recortó.
  function acotar(x, max) {
    const n = num(x);
    return n > max ? { valor: max, acotado: true } : { valor: n, acotado: false };
  }

  function tasaIva(clave) {
    return Object.prototype.hasOwnProperty.call(DATOS.iva, clave) ? clave : "general";
  }

  // Parte del cobro total (con IVA) que se queda la terminal y que es costo para ti.
  // Si cobras IVA (16%, 8% o 0%), el IVA de la comisión lo recuperas al declarar (acreditamiento): el costo es
  // solo la comisión. Si estás exento, el IVA de la comisión también es costo.
  function comisionEfectiva(comisionPct, clave) {
    const k = comisionPct / 100;
    return clave === "exento" ? k * (1 + DATOS.ivaComision) : k;
  }

  // Margen (ganancia / precio sin IVA) a markup (ganancia / costo). Ambos en porcentaje.
  function margenAMarkup(margenPct) {
    const m = Math.min(num(margenPct), DATOS.maximos.margen);
    return r2(m / (100 - m) * 100);
  }

  // Markup (ganancia / costo) a margen (ganancia / precio sin IVA). Ambos en porcentaje.
  function markupAMargen(markupPct) {
    const u = Math.min(num(markupPct), 1e6);
    return r2(u / (100 + u) * 100);
  }

  // Revisa un precio que ya tienes (con IVA incluido): cuánto es IVA, cuánto se lleva la terminal y cuánto ganas.
  function analizarPrecio({ precioFinal, costo, iva = "general", comision = 0 }) {
    const clave = tasaIva(iva);
    const t = DATOS.iva[clave];
    const total = acotar(precioFinal, DATOS.maximos.monto).valor;
    const c = acotar(costo, DATOS.maximos.monto).valor;
    const com = acotar(comision, DATOS.maximos.comision).valor;
    const sinIva = total / (1 + t);
    const comisionMonto = comisionEfectiva(com, clave) * total;
    const ganancia = sinIva - c - comisionMonto;
    return {
      precioFinal: r2(total), sinIva: r2(sinIva), iva: r2(total - sinIva), comision: r2(comisionMonto),
      costo: r2(c), ganancia: r2(ganancia), pierdes: ganancia < -0.004,
      margen: sinIva > 0 ? r2(ganancia / sinIva * 100) : 0
    };
  }

  // Precio de venta para lograr un margen sobre el precio sin IVA, con la comisión de la terminal incluida.
  // Precio sin IVA = costo / (1 - margen - comisión efectiva x (1 + IVA)), porque la terminal cobra sobre el
  // total que paga el cliente (con IVA). Si el denominador no es positivo, no hay precio que alcance.
  function precioVenta({ costo, margen, iva = "general", comision = 0 }) {
    const clave = tasaIva(iva);
    const t = DATOS.iva[clave];
    const C = acotar(costo, DATOS.maximos.monto);
    const M = acotar(margen, DATOS.maximos.margen);
    const K = acotar(comision, DATOS.maximos.comision);
    const c = C.valor, m = M.valor / 100;
    const kEf = comisionEfectiva(K.valor, clave);
    const denominador = 1 - m - kEf * (1 + t);
    const base = {
      costo: r2(c), margen: M.valor, comisionPct: K.valor, ivaClave: clave, tasaIva: t,
      comisionEfectivaPct: Math.round(kEf * 100 * 1e4) / 1e4,
      acotado: { costo: C.acotado, margen: M.acotado, comision: K.acotado }
    };
    if (denominador <= 0.0001) {
      return Object.assign(base, {
        posible: false, sinIva: 0, iva: 0, precioFinal: 0, comision: 0, ganancia: 0, markup: 0,
        sinTerminal: 0, redondeado: 0, margenRedondeado: 0, gananciaRedondeado: 0
      });
    }
    const sinIva = c / denominador;
    const total = sinIva * (1 + t);
    const comisionMonto = kEf * total;
    const ganancia = m * sinIva;
    // Markup sobre el costo total de cada venta (producto + comisión): equivale a margen / (1 - margen).
    const costoTotal = c + comisionMonto;
    const sinTerminal = m < 1 ? c / (1 - m) * (1 + t) : 0;
    const redondeado = c > 0 ? Math.ceil(r2(total) - 1e-9) : 0;
    // Lo que ganas si cobras el precio redondeado. Se calcula aquí, sin recortar: el precio con IVA puede pasar
    // del máximo de captura (por ejemplo, costo de mil millones con 35% de margen) y analizarPrecio() lo recortaría.
    const sinIvaR = redondeado / (1 + t);
    const ganR = sinIvaR - c - kEf * redondeado;
    return Object.assign(base, {
      posible: true, sinIva: r2(sinIva), iva: r2(total - sinIva), precioFinal: r2(total),
      comision: r2(comisionMonto), ganancia: r2(ganancia),
      markup: costoTotal > 0 ? r2(ganancia / costoTotal * 100) : 0,
      sinTerminal: r2(sinTerminal), redondeado,
      margenRedondeado: sinIvaR > 0 ? r2(ganR / sinIvaR * 100) : 0, gananciaRedondeado: r2(ganR)
    });
  }

  // Punto de equilibrio: cuántas unidades (y cuántos pesos) tienes que vender al mes para no perder ni ganar.
  // Unidades = gastos fijos / (precio - costo variable). Pesos = unidades x precio. Todo sin IVA.
  // gastosFijos puede ser un número o una lista (renta, sueldos, servicios, otros).
  // ventasActuales se redondea a unidades enteras (no se vende media pieza), para que la etiqueta y el cálculo
  // usen el mismo número.
  // Margen de seguridad = (ventas - equilibrio) / ventas. Si vendes menos que el equilibrio sale negativo y sin
  // sentido para el usuario: se marca debajoDelEquilibrio (la página lo dice con palabras) y la cifra se topa en -100.
  function puntoEquilibrio({ gastosFijos, precio, costoVariable, dias = 0, gananciaDeseada = 0, ventasActuales = 0 }) {
    const lista = Array.isArray(gastosFijos) ? gastosFijos : [gastosFijos];
    const mx = DATOS.maximos;
    const partes = lista.map(g => acotar(g, mx.monto));
    const P = acotar(precio, mx.monto), V = acotar(costoVariable, mx.monto);
    const D = acotar(dias, mx.dias), G = acotar(gananciaDeseada, mx.monto), U = acotar(ventasActuales, mx.unidades);
    const gf = partes.reduce((s, x) => s + x.valor, 0);
    const p = P.valor, v = V.valor, d = Math.floor(D.valor), meta = G.valor, ventas = Math.round(U.valor);
    const acotado = partes.some(x => x.acotado) || [P, V, D, G, U].some(x => x.acotado);
    const contribucion = p - v;
    const base = {
      gastosFijos: r2(gf), precio: r2(p), costoVariable: r2(v), dias: d, gananciaDeseada: r2(meta), ventasActuales: ventas,
      contribucion: r2(contribucion), razonContribucion: p > 0 ? r2(Math.max(0, contribucion) / p * 100) : 0, acotado
    };
    if (p === 0 || contribucion <= 0) {
      return Object.assign(base, {
        alcanzable: false, sinPrecio: p === 0, unidades: 0, unidadesRedondeadas: 0, pesos: 0, porDia: 0, porDiaRedondeado: 0,
        unidadesMeta: 0, unidadesMetaRedondeadas: 0, pesosMeta: 0,
        resultadoActual: r2(ventas * contribucion - gf), margenSeguridad: 0, debajoDelEquilibrio: false
      });
    }
    const unidades = gf / contribucion;
    const unidadesMeta = (gf + meta) / contribucion;
    const arriba = x => Math.ceil(x - 1e-9);
    return Object.assign(base, {
      alcanzable: true, sinPrecio: false,
      unidades: Math.round(unidades * 100) / 100, unidadesRedondeadas: arriba(unidades), pesos: r2(unidades * p),
      porDia: d > 0 ? Math.round(unidades / d * 100) / 100 : 0, porDiaRedondeado: d > 0 ? arriba(unidades / d) : 0,
      unidadesMeta: Math.round(unidadesMeta * 100) / 100, unidadesMetaRedondeadas: arriba(unidadesMeta), pesosMeta: r2(unidadesMeta * p),
      resultadoActual: r2(ventas * contribucion - gf),
      margenSeguridad: ventas > 0 ? r2(Math.max(-100, (ventas - unidades) / ventas * 100)) : 0,
      debajoDelEquilibrio: ventas > 0 && ventas * contribucion - gf < -1e-9
    });
  }

  // Salario mínimo diario vigente (de calc.js), para recordar que el sueldo de quien contratas no puede ser menor.
  function salarioMinimo() {
    return { anio: Calc.DATOS.anio, general: Calc.DATOS.salarioMinimo.general, frontera: Calc.DATOS.salarioMinimo.frontera };
  }

  const api = { DATOS, num, acotar, comisionEfectiva, margenAMarkup, markupAMargen, analizarPrecio, precioVenta, puntoEquilibrio, salarioMinimo };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Negocio = api;
})(this);
