# Simulación en Monad Testnet

Fecha: 2026-10-17T19:01:15.157Z  
Chain ID: 10143  
Duración total: 92.2 s

## Escenario completo

- Campaña: `0x8C8ad7437C3abB362192986D4d2e49E20BC69817`
- Donantes: 50 · matching de la empresa aliada: 2.000.000 MockCOP (meta 10.000.000)
- Censo: 20 familias registradas por la Junta de Acción Comunal; cada etapa exige que el 30 % confirme con su QR
- **49 donaciones en paralelo en 12.67 s → 3.9 tx/s**
- Latencia de confirmación (envío → bloque): p50 956 ms · p95 1300 ms · máx 1407 ms
- Bloques usados: 14 (hasta 6 donaciones en un mismo bloque)
- Gas por donación: límite 526.167 · usado 526.167 · costo ≈ 0.053669 MON

| Etapa | Proveedor | Monto (MockCOP) | Unidades | Sobrecosto | Verificadores | Familias | Pago (ms) | Tx del pago |
|---|---|---:|---:|:-:|:-:|:-:|---:|---|
| 1 | Supermercado La Cosecha | 3.000.000 | 20 | no | 2 de 3 | 7 (mín. 6) | 907 | https://testnet.monadvision.com/tx/0x8153e156f718d0426e570047042ef410266035ff28473e3ff69ead7daae7b889 |
| 2 | Ferretería El Constructor | 4.000.000 | 8 | ⚠ sí | 3 de 3 | 7 (mín. 6) | 830 | https://testnet.monadvision.com/tx/0x95861ed4908313dcf733b05e5aed659eec81f17137e1f6e6d3a1acb015a0bc0f |
| 3 | Constructora Comunitaria | 3.000.000 | 4 | no | 2 de 3 | 7 (mín. 6) | 750 | https://testnet.monadvision.com/tx/0xa47be383ef09cec0bc471deb28ca76debe826945fe40b408e7b52908fa0d5241 |

**A dónde fue cada peso (ejemplos):**

- `0x5289a4c036e30e74CD43a4C5a608B2ba82ac067A`: De tus 134.000: 40.200 en mercados, 53.600 en materiales, 40.200 en reconstrucción; además la empresa aliada sumó 134.000 gracias a ti
- `0xc138Eb22460879Ac2A5528af06DB179d86B29c2b`: De tus 101.000: 30.300 en mercados, 40.400 en materiales, 30.300 en reconstrucción; además la empresa aliada sumó 101.000 gracias a ti
- `0xbAD3eeDC12B9A58734BE8A5FaC8f4B54C14E46DD`: De tus 180.000: 54.000 en mercados, 72.000 en materiales, 54.000 en reconstrucción; además la empresa aliada sumó 180.000 gracias a ti

## Escenario de falla (etapa rechazada)

- Campaña: `0x0f6627D6740C1e2bD311b09fFf3c6ED2de7a1a57`
- Etapa 1 pagada, etapa 2 rechazada por 2 de 3 verificadores: uno con foto de la bodega vacía y otro que contó 1 de 2 kits facturados (el contrato convirtió su confirmación en rechazo)
- 10 donantes reclamaron en total 1.400.000 MockCOP

- `0xCc8D28A218cb73a6eA80F2BDda1B980527A5250B`: De tus 117.000: 35.100 en mercados, 46.800 en materiales (no pagado), 35.100 en reconstrucción (no pagado); reembolsados 81.900
- `0xDf86f9bc44725059d103E32bd67A80d06cB2f46F`: De tus 178.000: 53.400 en mercados, 71.200 en materiales (no pagado), 53.400 en reconstrucción (no pagado); reembolsados 124.600
- `0x823F7522C8889f183Ff4Fd7a144b87FE0ecf5886`: De tus 90.000: 27.000 en mercados, 36.000 en materiales (no pagado), 27.000 en reconstrucción (no pagado); reembolsados 63.000

## Campaña abierta para la demo en vivo

- Campaña: `0xbe7b500fDa284C61F043f6b78DED734430f8d61e`
- Recaudado: 4.800.000 de 20.000.000 MockCOP (incluye matching)
- 20 tarjetas QR de familias listas en el Panel

## Reputación on-chain

| Actor | Rol | Índice | Pagadas | Rechazadas | Sobrecostos |
|---|---|---:|---:|---:|---:|
| Fundación Antioquia Solidaria | Fundación | 66.66 % | 4 | 1 | 1 |
| Supermercado La Cosecha | Proveedor | 100 % | 2 | 0 | 0 |
| Ferretería El Constructor | Proveedor | 33.33 % | 1 | 1 | 1 |
| Constructora Comunitaria | Proveedor | 100 % | 1 | 0 | 0 |

