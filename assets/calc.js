// Cálculos laborales de Cuentas Claras MX. Funciones puras, sin datos personales:
// todo se calcula en el navegador de la persona.
(function (raiz) {
  // Valores oficiales vigentes. Actualizar cada enero (salario mínimo) y febrero (UMA).
  const DATOS = {
    anio: 2026,
    salarioMinimo: { general: 315.04, frontera: 440.87 }, // CONASAMI, vigente desde 1 ene 2026
    uma: 117.31 // INEGI, vigente desde 1 feb 2026
  };

  const DIA = 864e5;

  function fecha(texto) {
    const d = new Date(texto + "T00:00:00");
    return isNaN(d) ? null : d;
  }

  function diasEntre(a, b) {
    return Math.round((b - a) / DIA);
  }

  function aniosCompletos(ingreso, salida) {
    let n = salida.getFullYear() - ingreso.getFullYear();
    const aniversario = new Date(salida.getFullYear(), ingreso.getMonth(), ingreso.getDate());
    if (salida < aniversario) n--;
    return Math.max(0, n);
  }

  // Art. 76 LFT (reforma 2023): días de vacaciones al cumplir n años de servicio.
  function diasVacaciones(n) {
    if (n < 1) return 0;
    if (n <= 5) return 12 + 2 * (n - 1);
    return 20 + 2 * Math.ceil((n - 5) / 5);
  }

  // Art. 87 LFT: aguinaldo proporcional a los días trabajados en el año.
  function aguinaldo({ salarioMensual, ingreso, diasAguinaldo = 15, anio = DATOS.anio, corte }) {
    const sd = salarioMensual / 30;
    const inicio = new Date(anio, 0, 1);
    const fin = corte || new Date(anio, 11, 31);
    const desde = ingreso > inicio ? ingreso : inicio;
    const diasAnio = (new Date(anio, 11, 31) - inicio) / DIA + 1;
    const trabajados = desde > fin ? 0 : diasEntre(desde, fin) + 1;
    const diasProp = diasAguinaldo * trabajados / diasAnio;
    const bruto = sd * diasProp;
    const exento = 30 * DATOS.uma; // Art. 93 fr. XIV LISR
    return { sd, trabajados, diasAnio, diasProp, bruto, exento, gravado: Math.max(0, bruto - exento) };
  }

  // Finiquito (renuncia) o liquidación (despido injustificado). Usa salario diario base;
  // la ley pide salario integrado para indemnizaciones, así que el resultado es un mínimo.
  function finiquito({ salarioMensual, ingreso, salida, diasAguinaldo = 15, primaVacacional = 0.25,
    vacacionesTomadas = 0, vacacionesPendientes = 0, diasSinPagar = 0, motivo = "renuncia",
    zona = "general", veinteDias = false }) {
    const sd = salarioMensual / 30;
    const anios = aniosCompletos(ingreso, salida);
    const ultimoAniv = new Date(ingreso.getFullYear() + anios, ingreso.getMonth(), ingreso.getDate());
    const fraccion = Math.min(1, diasEntre(ultimoAniv, salida) / 365);
    const antiguedad = anios + fraccion;

    const ag = aguinaldo({ salarioMensual, ingreso, diasAguinaldo, anio: salida.getFullYear(), corte: salida });
    const diasVacAnio = diasVacaciones(anios + 1) * fraccion;
    const diasVac = Math.max(0, diasVacAnio - vacacionesTomadas) + vacacionesPendientes;

    const tope = 2 * DATOS.salarioMinimo[zona];
    const sdPrima = Math.min(sd, tope);
    const aplicaPrimaAnt = motivo === "despido" || anios >= 15; // Art. 162 LFT

    const conceptos = [
      { nombre: "Días trabajados sin pagar", monto: sd * diasSinPagar, ley: "Art. 84 LFT" },
      { nombre: "Aguinaldo proporcional", monto: ag.bruto, ley: "Art. 87 LFT" },
      { nombre: "Vacaciones no disfrutadas", monto: sd * diasVac, ley: "Arts. 76 y 79 LFT" },
      { nombre: "Prima vacacional", monto: sd * diasVac * primaVacacional, ley: "Art. 80 LFT" },
      { nombre: "Prima de antigüedad", monto: aplicaPrimaAnt ? 12 * antiguedad * sdPrima : 0, ley: "Art. 162 LFT" }
    ];
    if (motivo === "despido") {
      conceptos.push({ nombre: "Indemnización de 3 meses", monto: 90 * sd, ley: "Arts. 48 y 50 LFT" });
      if (veinteDias) conceptos.push({ nombre: "20 días por año trabajado", monto: 20 * antiguedad * sd, ley: "Art. 50 fr. II LFT" });
    }
    const total = conceptos.reduce((s, c) => s + c.monto, 0);
    return { sd, anios, antiguedad, diasVac, aplicaPrimaAnt, conceptos, total };
  }

  const api = { DATOS, fecha, aniosCompletos, diasVacaciones, aguinaldo, finiquito };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Calc = api;
})(this);

// Formato de pesos y utilidades de página.
function mxn(n) {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
