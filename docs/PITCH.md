# Rastro Solidario · Guion para el jurado

## 1. El problema (30 s)

> "Después de la inundación donaste 50.000 pesos. ¿Sabes en qué se gastaron? Nadie lo sabe."

- Cuando hay una emergencia, la gente dona en las primeras horas y después pierde el rastro del dinero.
- En Colombia hay casos públicos de corrupción con la ayuda humanitaria (por ejemplo, el escándalo de la UNGRD
  con contratos de emergencia). La consecuencia es que la gente **deja de donar**.
- Las plataformas actuales publican informes al final. Un PDF no se puede verificar.

## 2. La idea en una frase (15 s)

> **El dinero vive en un contrato, sale por etapas directo al proveedor y solo se libera cuando
> verificadores independientes Y las propias familias damnificadas confirman que la ayuda llegó.**

La fundación no tiene ningún botón para cobrar.

## 3. Demo (3 min)

| # | Qué mostrar | Frase |
|---|---|---|
| 1 | **Donar con Nequi** en la campaña de Mocoa (sin MetaMask). Arriba se ve la empresa aliada con su aporte | "Mi mamá puede donar sin saber qué es blockchain. Y las empresas donan con su nombre: también pueden seguir cada peso." |
| 2 | Pantalla de éxito → «Ver a dónde va mi dinero» | "Esta es mi plata, en un contrato que nadie puede tocar." |
| 3 | Panel: la fundación cierra el recaudo y propone la etapa 1 con **pocas unidades** → banner rojo de **sobrecosto** | "Si la factura infla el precio, el contrato lo detecta solo y exige un verificador más." |
| 4 | Verificadores confirman con **foto y GPS** | "La evidencia queda pública y con hash: no se puede cambiar después." |
| 5 | Estado **«Esperando a la comunidad»** → un celular escanea la **tarjeta QR** y toca «Sí, la recibí» → **pago automático** | "Los verificadores solos no bastan. El pago sale cuando las familias dicen que recibieron." |
| 6 | **Página pública**: línea de tiempo, mapa, fotos con ✓ Íntegra, QR para compartir, CSV | "Esto es lo que ve un periodista o la Contraloría. Sin wallet." |
| 7 | 🔔 Campanita del donante: «Hoy se usaron $X de tu donación en mercados» | "No tienes que venir a buscar: te avisamos." |
| 8 | **Reputación**: la ferretería que facturó con sobrecosto y no entregó tiene 33 % | "Quien hace trampa queda marcado para la próxima emergencia." |

Si algo falla en vivo: `reports/simulacion-31337.md` y las capturas de `pruebas-e2e/shots/`.

## 4. ¿Por qué blockchain y por qué Monad? (45 s)

- **Blockchain**: el dinero lo custodia código, no una persona. Las reglas (etapas, quórum, sobrecosto,
  reembolso) no se pueden saltar ni cambiar después. La reputación no se puede borrar.
- **Monad**:
  - Después de un desastre llegan **miles de donaciones en minutos**: ejecución en paralelo y bloques de ~400 ms.
    En la simulación entran 49 donaciones en un mismo bloque.
  - **Comisiones casi nulas**: una donación de $5.000 no puede perder la mitad en gas. Y además lo paga un
    patrocinador (ERC-2771), así que el donante y las familias pagan **cero**.
  - **Contratos de 128 KB**: toda la lógica anticorrupción vive en la cadena, no en un servidor.

## 5. Preguntas difíciles

| Pregunta | Respuesta |
|---|---|
| "¿Y si el verificador miente?" | Problema del oráculo. Por eso hay **señales independientes que tendrían que coludir todas**: 2 de 3 verificadores de instituciones distintas, las familias, la evidencia pública, el precio de referencia y la reputación. |
| "¿Y si la fundación pone más unidades en la factura para que no salte el sobrecosto?" | Cada verificador reporta **cuántas unidades contó** al confirmar. Si contó menos de las facturadas, el contrato convierte su confirmación en **rechazo** y la etapa queda marcada públicamente: «el conteo en campo no cuadra». |
| "¿Y si la fundación inventa familias?" | No puede: el censo lo carga un verificador (la Junta), la fundación tiene prohibido hacerlo en el contrato. En producción se cruza con el Registro Único de Damnificados. |
| "¿Quién paga el gas?" | Un patrocinador (en producción, un paymaster). Solo patrocina campañas oficiales y acciones específicas. |
| "¿Es plata real?" | En la demo, MockCOP. En producción, una stablecoin en pesos o dólares con un on-ramp regulado (Nequi/PSE → stablecoin). |
| "¿Qué pasa si no se entrega?" | Se rechaza o vence el plazo y **cada donante recupera su parte** de lo no gastado, también sin gas. |
| "¿Cómo lo prueban?" | 107 tests de contratos (incluye fuzz e invariantes), simulación de 3 escenarios y una prueba E2E en navegador real de todo el flujo. |

## 6. Cierre (10 s)

> "Rastro Solidario no le pide a nadie que confíe en la fundación. Le da a cada donante y a cada familia
> la prueba de que la ayuda llegó."
