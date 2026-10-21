# Cuentas Claras MX

Calculadoras y guías gratis para cualquier persona en México. Sitio estático (HTML, CSS y JS sin dependencias ni librerías). Se publica en https://miguel201009.github.io/cuentas-claras-mx/ (una subcarpeta), así que **todas las rutas internas son relativas** (`../assets/estilo.css`, `../../trabajo/aguinaldo/`). Nunca uses rutas que empiecen con `/`.

Reglas del sitio:

- Es **independiente**: no debe parecer página de gobierno. Cada página lo dice en el encabezado y en el pie.
- **No pide datos personales** (CURP, RFC, contraseñas) y **todo se calcula en el navegador**: no hay formularios que envíen datos, ni `fetch`, ni cookies.
- **Cada cifra oficial lleva su fuente y su vigencia.** Si no se pudo confirmar con una fuente oficial, se marca como pendiente o se vuelve un campo editable de ejemplo.
- Texto en español de México, sencillo y sin guiones largos.

## Estructura

```
index.html                 Portada: buscador y las 10 secciones con todas sus páginas
aviso-legal/               Aviso legal y privacidad
sitemap.xml, robots.txt    Para buscadores (base https://miguel201009.github.io/cuentas-claras-mx/)
assets/
  estilo.css               Estilos de todo el sitio (colores, modo oscuro, tarjetas, tablas, buscador)
  buscador.js              Buscador de la portada (sin dependencias; se prueba en Node)
  calc.js                  Base común: salario mínimo, UMA, ISR mensual, subsidio, IMSS, formato de pesos
  trabajo.js impuestos.js dinero.js retiro.js vivienda.js tramites.js auto.js casa.js familia.js negocio.js
                           Cálculos y datos de cada sección (cargan antes calc.js)
pruebas/                   Una prueba por archivo de assets, más sitio.test.js para todo el sitio
```

| Sección | Carpeta | Páginas |
|---|---|---|
| Trabajo | `trabajo/` | aguinaldo, finiquito, vacaciones, sueldo-neto, prima-de-antiguedad, ptu, horas-extra |
| Impuestos y SAT | `impuestos/` | rfc, resico, declaracion-anual |
| Dinero y ahorro | `dinero/` | cetes-vs-bancos, meses-sin-intereses, prestamo |
| Retiro e IMSS | `retiro/` | afore, semanas-cotizadas, ley-73-vs-ley-97 |
| Vivienda | `vivienda/` | credito-infonavit, rentar-o-comprar, predial |
| Trámites | `tramites/` | curp, ine, pasaporte, licencia-de-manejo |
| Auto | `auto/` | tenencia-y-refrendo, verificacion, gasolina-por-viaje |
| Casa y servicios | `casa/` | recibo-de-luz, consumo-de-aparatos, gas-lp |
| Familia y becas | `familia/` | becas, maternidad-y-paternidad, pension-alimenticia |
| Negocio propio | `negocio/` | precio-de-venta, punto-de-equilibrio, alta-en-el-sat |

Cada sección tiene su `index.html` y cada página vive en `seccion/pagina/index.html`. Al final de cada página hay un párrafo "También te puede servir" con enlaces a páginas relacionadas, también de otras secciones.

### Si agregas una página

1. Crea `seccion/pagina/index.html` copiando el encabezado y el pie de otra página de la sección.
2. Agrégala al índice de su sección y a la portada (`index.html`, dentro del bloque `data-seccion` que le toca, con palabras de búsqueda en `data-k`).
3. Agrega su URL a `sitemap.xml`.
4. Corre las pruebas: `pruebas/sitio.test.js` falla si la página no está en la portada o en el sitemap, si tiene una ruta absoluta o un enlace roto.

## Pruebas

Necesitas Node (sin instalar paquetes). Desde la carpeta del sitio:

```sh
for f in pruebas/*.test.js; do node "$f" || exit 1; done
```

Cada archivo imprime un mensaje de éxito o se detiene con el primer error. `sitio.test.js` revisa todo el sitio: que existan las 47 páginas, enlaces internos relativos y sin romper, títulos sin repetir, aviso de sitio independiente, que ninguna página pida datos personales ni use scripts externos, la portada (sin "Próximamente", con todas las páginas), el buscador, `sitemap.xml` y `robots.txt`.

Para verlo en el navegador como en GitHub Pages, sirve la carpeta de arriba y abre la subcarpeta:

```sh
cd .. && python3 -m http.server 8000
# abre http://localhost:8000/cuentas-claras-mx/
```

Nota: los buscadores solo leen `robots.txt` en la raíz del dominio (`miguel201009.github.io/robots.txt`). El de esta carpeta sirve si el sitio se mueve a un dominio propio. Mientras tanto, da de alta `sitemap.xml` en Google Search Console.

## Cifras oficiales que hay que actualizar cada año

Al cambiar una cifra en `assets/*.js`, búscala también en las páginas (`grep -rn "117.31" .`): varias guías la repiten en su texto con su fuente. Corre las pruebas después, porque algunas revisan los ejemplos de las páginas. En octubre de 2026 muchos portales oficiales no abrieron desde nuestra red: las cifras marcadas en el código como "pendiente de cotejar" se confirmaron con al menos dos fuentes secundarias y hay que revisarlas en la fuente oficial.

| Cuándo | Cifra (valor 2026) | Archivo | Fuente oficial |
|---|---|---|---|
| Diciembre o enero | Salario mínimo general y de la frontera norte ($315.04 y $440.87 diarios) | `assets/calc.js` (`salarioMinimo`); se repite en páginas de trabajo, familia, retiro, vivienda y negocio | CONASAMI, resolución en el DOF (9 dic 2025) |
| Enero (vigente desde el 1 de febrero) | UMA diaria y mensual ($117.31 y $3,566.22) | `assets/calc.js` (`uma`, `umaMensual`); se repite en trabajo, auto, dinero y retiro | INEGI, publicación en el DOF (9 ene 2026) |
| Diciembre o enero | Tarifa mensual del ISR (art. 96 LISR) | `assets/calc.js` (`isrMensual`) | Anexo 8 de la Resolución Miscelánea Fiscal, DOF (28 dic 2025) |
| Diciembre o enero | Tarifa anual del ISR (art. 152 LISR) | `assets/impuestos.js` (`tarifaAnual`) | Anexo 8 de la RMF, DOF |
| Enero y febrero | Subsidio para el empleo ($535.65 al mes; tope $11,492.66) | `assets/calc.js` (`subsidioEmpleo`); `trabajo/sueldo-neto/` | Decreto del subsidio para el empleo en el DOF (modificado el 31 dic 2025) |
| Cada año | Cuotas obreras del IMSS y tope de 25 UMA | `assets/calc.js` (`imss`) | Ley del Seguro Social, Cámara de Diputados |
| Cada año | RESICO: tablas mensual y anual, tope de $3,500,000, retención de 1.25% | `assets/impuestos.js` (`resico`) | Ley del ISR, arts. 113-E a 113-J. Revisar si se publica en el DOF la reforma que la prensa anunció para 2027 |
| Cada año | Topes de colegiaturas y de deducciones personales; reglas de devolución del saldo a favor | `assets/impuestos.js` (`colegiaturas`, `deducciones`, `devolucion`) | Decreto DOF 26 dic 2013 y página de deducciones del SAT; RMF del año |
| Enero | Retención de ISR sobre intereses (0.90% en 2026; para 2027 se propuso 0.68%) | `assets/dinero.js` (`retencionIsr`); `dinero/` | Ley de Ingresos de la Federación del año, DOF |
| Cuando se cite | Valor de la UDI (seguro del IPAB de 400,000 UDIS) | `assets/dinero.js` (`udi`) | Banxico, serie SIE CP150 |
| Enero | Cuota patronal de cesantía y vejez por año (sube cada año hasta 2030) | `assets/retiro.js` (`ceavPatron`) | LSS art. 168 y transitorios, DOF 16 dic 2020 |
| Cada trimestre | Cuota social del gobierno (se actualiza con el INPC) | `assets/retiro.js` (`cuotaSocial`; hoy son montos base) | LSS art. 168 fr. IV; IMSS |
| Noviembre o diciembre | Comisión de las Afore (0.54% en 2026) | `assets/retiro.js` (`comision`); `retiro/afore/` | CONSAR, Junta de Gobierno |
| Enero | Semanas que pide la Ley 97 (875 en 2026, 25 más cada año) | `assets/retiro.js` (`semanasLey97`); `retiro/` | LSS y transitorios, DOF 16 dic 2020 |
| Enero | Pensión mínima de la Ley 73 ($10,636.54) | `retiro/ley-73-vs-ley-97/` (se calcula con el salario mínimo) | IMSS; LSS 1973 y decreto DOF 20 dic 2001 |
| Cada año | Aportación del patrón al Infonavit y puntos para el crédito (1,080) | `assets/vivienda.js` (`infonavit`); `vivienda/credito-infonavit/` | Ley del Infonavit art. 29; portal del Infonavit |
| Enero a marzo | Descuentos del predial por ciudad; tasa de Nuevo León y descuento de Monterrey | `assets/vivienda.js` (`predial`); tabla de `vivienda/predial/` | Leyes de ingresos y portales de cada municipio o estado |
| Enero | Costo del pasaporte por vigencia (de $920 a $4,280) y con 50% de descuento | `assets/tramites.js` (`pasaporte`); `tramites/pasaporte/` | SRE (gob.mx/pasaporte) y Ley Federal de Derechos, art. 20 |
| Cada proceso electoral | Fecha límite para trámites del INE y fecha de la elección | `assets/tramites.js` (`ine`); `tramites/ine/` | INE, acuerdo del Consejo General |
| Cada año | Portales oficiales de licencias de manejo por estado | `assets/tramites.js` (`ESTADOS`); `tramites/licencia-de-manejo/` | Portal oficial de cada estado |
| Enero | Tenencia y refrendo por estado (subsidio de CDMX y Edomex hasta $638,000) | `assets/auto.js` (`TENENCIA_2026`, `ESTADOS`); `auto/tenencia-y-refrendo/` | Secretarías de finanzas de cada estado y gacetas oficiales |
| Enero y julio | Calendario de verificación, Hoy No Circula y multa (20 UMA) | `assets/auto.js` (`verificacion`); `auto/verificacion/` | Programa de Verificación Vehicular de cada semestre, Gaceta Oficial de la CDMX |
| Cada año | Tarifas domésticas de CFE (rangos y límite DAC) | `assets/casa.js` (`tarifas`); `casa/recibo-de-luz/` | CFE, tarifas para el hogar |
| Enero | IVA de 8% en la frontera (estímulo prorrogado hasta el 31 dic 2026) | `assets/casa.js` (`ivaFrontera`) y `assets/negocio.js` (`iva.frontera`) | Decretos de estímulos fiscales región fronteriza norte y sur, DOF |
| Cuando cambie | Densidad del gas LP y fuente de precios máximos | `assets/casa.js` (`gas`); `casa/gas-lp/` | CNE, precios máximos semanales en el DOF |
| Cada año | PTU: porcentaje, tope y fechas de pago | `assets/trabajo.js` (`ptu`) | LFT arts. 117 a 131; Comisión Nacional para la PTU (DOF); manual PTU del SAT y la STPS |
| Enero (hasta 2030) | Horas extra al doble y jornada semanal por año | `assets/trabajo.js` (`horasExtra`, `verificadoDOF: false`) | Reforma a la LFT y al art. 123 constitucional, DOF 3 mar y 1 may 2026. Cotejar el decreto |
| Cada año | Montos de becas y pensiones del Bienestar (hoy son ejemplos editables) | `assets/familia.js` (`apoyos`); `familia/becas/` | Secretaría de Bienestar y Coordinación de Becas Benito Juárez (gob.mx) |
| Cuando cambie la ley | Licencia de maternidad (42 + 42 días) y paternidad (5 días) | `assets/familia.js` (`maternidad`, `paternidad`) | LFT arts. 170 y 132 fr. XXVII Bis; LSS arts. 101 y 102 |

Después de actualizar, cambia el año en los títulos y textos ("2026") y la fecha `lastmod` de `sitemap.xml`.

## Google y vista previa en redes

`scripts/seo.js` agrega a cada página la dirección canónica, las etiquetas de vista previa (WhatsApp, Facebook) y los datos estructurados, y rehace `sitemap.xml` y `robots.txt`. Córrelo después de agregar o cambiar páginas:

```
node scripts/seo.js --imagenes                       # con la dirección de GitHub Pages
node scripts/seo.js https://cuentasclarasmexico.com/ --imagenes   # cuando el dominio propio esté conectado
```

`--imagenes` rehace las imágenes de `assets/compartir/` (necesita Playwright).
