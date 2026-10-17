# Rastro Solidario

Donaciones para emergencias en **Monad** donde cada peso es rastreable **y la comunidad tiene la última palabra**.

> **El dinero nunca pasa por la fundación.** Queda en el contrato y, cuando se aprueba una etapa, va directo
> a la wallet del proveedor (el supermercado, la ferretería). La fundación solo **propone** cómo gastarlo;
> no puede gastarlo ella misma. Y para aprobar una etapa no bastan los verificadores: **las propias familias
> damnificadas confirman, con el QR de su tarjeta, que recibieron la ayuda.**

Guion de la presentación: [docs/PITCH.md](docs/PITCH.md).

## Qué lo hace distinto

| | Cómo funciona | Dónde vive |
|---|---|---|
| **Voz de la comunidad** | Un verificador (p. ej. la Junta de Acción Comunal) carga el censo de familias. Cada familia recibe una tarjeta con un QR; al recibir la ayuda lo escanea con la cámara del celular y toca «Sí, la recibí». Sin el quórum de la comunidad (p. ej. 30 % del censo) **el pago no sale**, aunque los verificadores aprueben. | `registrarBeneficiarios`, `confirmarRecepcion` |
| **Evidencia visible** | Factura, foto de la entrega y acta se suben a IPFS con fecha y ubicación GPS. En la cadena quedan `ipfs://<cid>` y el keccak256 del documento; la app muestra la foto y el sello **✓ Íntegra** si coincide byte a byte. | `uriEvidencia`, `uriVotoDe` |
| **Alerta de sobrecosto** | Cada etapa puede tener un precio de referencia por unidad (mercado familiar, kit de techo). Si la factura supera la referencia en más del 10 %, la etapa queda **en rojo**, exige **un verificador más** (3 de 3) y un solo rechazo la tumba. El sobrecosto queda en la reputación de la fundación y del proveedor. | `proponerDesembolso` |
| **Conteo en campo** | Al confirmar, cada verificador reporta **cuántas unidades contó** en el sitio. Si contó menos de las que dice la factura, el contrato registra su voto **como rechazo** (entrega incompleta) y la etapa queda marcada «el conteo no cuadra». Así la fundación no puede inflar las unidades de la factura para esquivar la alerta de sobrecosto. | `confirmarEntrega`, `unidadesContadasDe` |
| **Donar sin cripto** | «Donar con Nequi o PSE» (pasarela simulada): se crea una **billetera invisible** en el navegador, la pasarela acredita MockCOP, la billetera firma y un **patrocinador paga el gas** (ERC-2771). Sin MetaMask, sin frase semilla, sin comisiones. Lo mismo usan las familias para confirmar. | `ReenviadorGas`, `scripts/servidor.mjs` |
| **Reputación on-chain** | Historial público de cada fundación, proveedor, verificador y empresa entre campañas: etapas pagadas, rechazadas, vencidas, sobrecostos, monto. Lo escriben **solo** los contratos de las campañas oficiales. Índice de confianza = pagadas ÷ (pagadas + rechazadas + vencidas + sobrecostos). | `HistorialReputacion` |
| **Avisos al donante** | «Hoy se usaron $60.000 de tu donación en mercados para «Inundación…»». Campanita en la app, notificación del navegador y bot de Telegram opcional. | `lib/avisos.ts`, `scripts/notificador.mjs` |
| **Página pública** | Sin wallet: línea de tiempo, mapa de entregas (OpenStreetMap), galería de evidencias, QR para compartir, WhatsApp/X y **datos abiertos** (CSV/JSON) para periodistas y veedurías. | `#/campana/<dirección>` |
| **Empresas aliadas** | Una empresa registrada dona como cualquier persona: el aporte queda a su nombre, recibe su recibo NFT, rastrea en qué se gastó cada peso y aparece destacada en la campaña, en la página pública y en Reputación. Si hay reembolso, recupera su parte. | `donar` / `donarConPermit` |

## Actores (todos simulados con wallets de prueba)

| Actor | Qué hace |
|---|---|
| Donante | Dona con Nequi/PSE (sin cripto) o con MetaMask, ve el rastro de su dinero y recibe avisos |
| Fundación | Crea la campaña, define etapas y precios de referencia, propone cada desembolso con factura |
| Proveedor | Está registrado y recibe el pago directo al entregar |
| Verificador | Confirma con foto, fecha y GPS que la entrega ocurrió (2 de 3; 3 de 3 si hay sobrecosto). Uno de ellos carga el censo |
| Familia damnificada | Confirma con el QR de su tarjeta que recibió la ayuda (sin wallet, sin gas) |
| Empresa aliada | Dona con su nombre y sigue en qué se gasta su aporte |
| Patrocinador de gas | Paga las transacciones de quien no tiene cripto (solo hacia campañas oficiales y acciones permitidas) |
| Administrador | Habilita fundaciones, verificadores, proveedores y empresas en el registro |

## Contratos (`contracts/src`)

| Contrato | Rol |
|---|---|
| `CampanaEmergencia.sol` | El núcleo: meta, etapas, verificadores, censo y quórum de la comunidad, sobrecosto, pagos automáticos, reembolsos y "a dónde fue cada peso". ERC-2771: todas las acciones aceptan gas patrocinado |
| `CampanaFactory.sol` | Crea una campaña por emergencia (solo fundaciones registradas). Es la lista oficial de campañas |
| `HistorialReputacion.sol` | Reputación acumulada entre campañas, con índice de confianza consultable por otros contratos |
| `ReenviadorGas.sol` | `ERC2771Forwarder` de OpenZeppelin: verifica firma EIP-712, nonce y plazo de cada solicitud patrocinada |
| `RegistroActores.sol` | Roles con `AccessControlEnumerable` (fundación, verificador, proveedor, empresa aliada) y nombres públicos |
| `MockCOP.sol` | Peso simulado (ERC-20 + **ERC-2612 permit**). Faucet público y `mintLote` |
| `ReciboDonacion.sol` | NFT de recibo **intransferible**, con imagen SVG generada en la cadena y enlace al rastreo |
| `Dispersor.sol` | Utilidad de la simulación: reparte MON a muchas wallets en una sola transacción |

### Ciclo de vida

```
Campaña:  Recaudando ──► EnEjecucion ──► Finalizada
               │               │
               └──────► Reembolso ◄──┘   (etapa rechazada · plazo vencido · cancelada)

Etapa:    Pendiente ──► Propuesta ──► Aprobada ──────────────► Pagada
                             │       (verificadores OK,     (quórum de la
                             │        espera a la comunidad)  comunidad)
                             └──────► Rechazada
```

Cada etapa guarda: descripción, porcentaje, proveedor, evidencia (`ipfs://` + hash), unidades, precio de
referencia, si hubo sobrecosto, confirmaciones requeridas y recibidas (verificadores y familias), estado,
plazo, monto y fecha/bloque de propuesta y pago. El voto, el hash y el `ipfs://` del acta de cada verificador
también quedan en la cadena (`votos(etapa)`).

### Reglas clave (todas probadas)

- **Donar**: `donarConPermit` (firma gratis + **1 sola transacción**, también vía `ReenviadorGas`) o `approve` +
  `donar`. Si alguien dona más de lo que falta, solo se cobra lo que falta, y la meta cerrada cierra el recaudo.
- **Empresas aliadas**: donan con `donar`/`donarConPermit` como cualquiera. El Panel no deja proponer como
  proveedor a quien donó a la campaña (conflicto de interés). Nota: el contrato desplegado conserva
  `comprometerMatching` (una versión anterior en la que la empresa multiplicaba cada donación); la app ya no
  lo usa, y su bloqueo on-chain de conflicto de interés solo cubre a las empresas con matching. En un
  próximo despliegue conviene quitarlo y bloquear en el contrato a cualquier donante como proveedor.
- **Censo**: solo un verificador de la campaña lo carga (la fundación no puede inventarse beneficiarios). Una
  familia no puede ser fundación, verificador, empresa aliada ni proveedor registrado.
- **Proponer**: solo la fundación, solo la etapa actual, solo a un proveedor registrado, con evidencia. La
  fundación, un verificador, una empresa aliada o una familia **no pueden ser el proveedor**. Si la etapa tiene
  precio de referencia, hay que declarar las unidades. Si el campo quórum está activo, debe existir censo.
- **Sobrecosto**: precio por unidad = monto de la etapa ÷ unidades. Si supera la referencia en más del 10 %:
  confirmaciones requeridas = umbral + 1 (sin pasar el total de verificadores) y rechazos para tumbarla = total −
  requeridas + 1.
- **Conteo en campo**: si la factura declaró unidades, cada verificador debe reportar cuántas contó al
  confirmar (`ConteoRequerido` si manda 0). Si contó **menos** de las facturadas, su voto se guarda como
  rechazo con el acta como motivo (`UnidadesNoCuadran`) y la etapa queda con `unidadesNoCuadran = true`. Contar
  de más no es problema. Un solo verificador no basta para tumbar la etapa: hacen falta los rechazos requeridos.
- **Pagar**: se paga en la transacción que completa **las dos señales**: verificadores y quórum de familias
  (redondeado hacia arriba: 30 % de 20 = 6). Si el proveedor fue dado de baja entretanto, no se paga.
- **Plazo vencido**: si la etapa actual no se paga a tiempo (aunque los verificadores ya aprobaran),
  **cualquiera** llama a `activarReembolsoPorVencimiento()`.
- **Reembolso**: `reclamarReembolso()` devuelve `aporte × (recaudado − pagado) / recaudado`; también sin gas.

### "A dónde fue cada peso"

Las donaciones se cierran antes del primer pago, así que la participación de cada donante queda fija.
Si donaste el 2 % del total, el 2 % de cada pago "es tuyo". `resumenDonante(dirección)` lo calcula en una
sola llamada y el frontend lo muestra así:

> **De tus 200.000 MockCOP:** 60.000 en mercados (Supermercado La Cosecha), 80.000 en materiales
> (Ferretería El Constructor), 60.000 pendientes. 🎁 Gracias a tu donación, Aliados por Antioquia sumó 200.000 más.

## Decisiones específicas para Monad

| Hecho de Monad | Qué hicimos |
|---|---|
| El gas se cobra sobre el **gas limit**, no sobre el gas usado | El frontend y los scripts fijan `gas = estimación + 10 %` antes de enviar |
| **Reserve balance**: una cuenta con menos de 10 MON solo puede mandar 1 tx cada 3 bloques | Donación en **una sola tx** (permit); fondeo de 50 wallets con **un solo tx** (`Dispersor` + `mintLote`); las confirmaciones de 7 familias van en **un solo `executeBatch`** patrocinado |
| El RPC público limita `eth_getLogs` a **100 bloques** | Todo lo que muestra la app (y el notificador) se lee con **funciones `view`**, incluidas las fechas de la línea de tiempo. El tx de un pago se busca con un `getLogs` de 1 bloque usando `bloquePago` |
| Contratos de hasta **128 KB** (Ethereum: 24 KB) | Toda la lógica anticorrupción vive en la cadena. `foundry.toml`, Anvil y el despliegue usan el límite de Monad |
| Bloques de ~400 ms | Lecturas cada 2,5 s y recibos cada 500 ms |
| Multicall3 desplegado en testnet | Las lecturas del frontend se agrupan |

## Estructura

```
contracts/      src/ (Solidity) · test/ (Foundry) · script/Deploy.s.sol
scripts/        deploy · simular · servidor (evidencias, pasarela, gas patrocinado) · notificador · wallets · verificar
frontend/       React + Vite + wagmi + viem + Tailwind + Leaflet
                vistas: Donar · Campaña pública · Rastreo · Reputación · Panel · Recibir (familias) · Tarjetas QR
pruebas-e2e/    Prueba del producto completo en Chromium (Playwright) contra Anvil
reports/        deploy-<chainId>.json y simulacion-<chainId>.{json,md}
evidencias/     almacén local de evidencias por CID (se crea solo; no va a git)
docs/           PITCH.md
```

## Requisitos

- Node 20+ y pnpm 9 (`npm i -g pnpm@9`)
- Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup` (Linux, macOS o WSL).
  **Windows sin WSL:** descarga `foundry_stable_win32_amd64.zip` de
  [las releases de Foundry](https://github.com/foundry-rs/foundry/releases), descomprímelo y define
  `FOUNDRY_BIN` con esa carpeta. Los scripts encuentran Foundry en `FOUNDRY_BIN`, el PATH, `~/.foundry/bin` o WSL.
- MetaMask (solo para actuar como fundación, verificador, empresa o admin; para donar no hace falta)

```bash
pnpm install
pnpm test:contracts     # 107 tests: unitarios, fuzz e invariantes
```

## Correr en local (Anvil)

```bash
# Terminal 1
pnpm anvil

# Terminal 2
pnpm deploy:local       # despliega, registra actores y escribe frontend/.env
pnpm simular:local      # 3 campañas: completa (censo, empresa aliada, sobrecosto), falla y una ABIERTA para la demo
pnpm dev                # http://localhost:5173  (incluye evidencias, pasarela y gas patrocinado)

# Opcional, Terminal 3
pnpm notificador        # avisos a donantes (consola, o Telegram con TELEGRAM_BOT_TOKEN)
```

La simulación deja la campaña **«Avenida torrencial en Mocoa»** recaudando, con censo de 20 familias y
el aporte de una empresa aliada: es la que se usa en la demo en vivo. Sus tarjetas QR están en Panel → Censo → 🖨 Tarjetas
(entrando con la cuenta de la Junta de Acción Comunal).

**Celular en la demo:** `pnpm dev` muestra una dirección «Network» (p. ej. `http://192.168.1.20:5173`).
Ponla en el campo «Dirección de la app dentro del QR» de la hoja de tarjetas; el celular de la "familia",
conectado al mismo Wi-Fi, abre el QR con la cámara. La app usa el proxy `/rpc` para hablar con Anvil.

En MetaMask: agrega la red `http://127.0.0.1:8545` (chain id 31337) o deja que la app la agregue al conectar.
Importa las cuentas de prueba de Anvil (son públicas, **solo para local**):

| Rol | Índice Anvil | Dirección |
|---|---|---|
| Administrador (deployer) | 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` |
| Fundación | 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Verificadores (Defensa Civil, Junta de Acción Comunal, Personería) | 2, 3, 4 | `0x3C44…93BC`, `0x90F7…b906`, `0x15d3…6A65` |
| Proveedores | 5, 6, 7 | `0x9965…A4dc`, `0x976E…0aa9`, `0x14dC…9955` |
| Empresa aliada | 8 | `0x2361…1E8f` |
| Patrocinador de gas (lo usa el servidor) | 9 | `0xa0Ee…9720` |

Las llaves privadas las muestra `pnpm wallets -- --red local --llaves`.

### Variables opcionales (`.env` de la raíz)

| Variable | Para qué |
|---|---|
| `PINATA_JWT` | Fijar las evidencias en IPFS real (Pinata). Sin ella se guardan en `evidencias/` con el mismo tipo de CID |
| `IPFS_GATEWAY` | Gateway para CIDs que no están en local (por defecto `ipfs.io`) |
| `TELEGRAM_BOT_TOKEN` | Bot de avisos (`pnpm notificador`). En `frontend/.env` pon `VITE_TELEGRAM_BOT=<usuario_del_bot>` para mostrar el botón |

## Desplegar en Monad testnet

1. Copia `.env.example` a `.env` y pon en `DEPLOYER_PRIVATE_KEY` una wallet **nueva, solo de pruebas**, con
   MON de testnet ([faucet.monad.xyz](https://faucet.monad.xyz)).
2. `pnpm wallets:nuevo` (guarda `SIM_MNEMONIC` en `.env`).
3. `pnpm deploy:monad` y `pnpm verify:monad`.
4. `pnpm simular:monad -- --estimar`, luego `pnpm simular:monad` y al final `pnpm simular:monad -- --recuperar`.
5. `pnpm dev`. El patrocinador de gas es el índice 9 de `SIM_MNEMONIC` (la simulación lo fondea).

Opciones de la simulación: `--escenario completo|falla|abierta|vencimiento|todos` · `--donantes N` ·
`--familias N` · `--concurrencia N` · `--semilla N`.

Mantenimiento en vivo: `pnpm recargar:monad` sube el saldo de la pasarela, el patrocinador de gas y
los actores (cada donación con Nequi/PSE cuesta ≈ 0,07 MON porque Monad cobra el gas límite).

**RPC de respaldo.** El servidor y el navegador usan Ankr y dRPC si el RPC oficial se cae o se pone
lento (`MONAD_RPC_RESPALDO` / `VITE_RPC_RESPALDO`). El servidor mide cada 15 s qué nodo responde mejor.

## Publicar en Vercel

La app es estática salvo los servicios de la demo (`/api/*`, `/ipfs/*`), que en Vercel corren en la
función [`api/servicios.mjs`](api/servicios.mjs) (el mismo código de `pnpm dev`). [`vercel.json`](vercel.json)
ya trae el build, la función y las reescrituras; las direcciones públicas de los contratos van en
`frontend/.env.production` (lo actualiza `pnpm deploy:monad`).

Una sola vez, en este computador:

1. `pnpm pasarela:monad`: pasa la propiedad de MockCOP a una cuenta propia de la pasarela
   (`SIM_MNEMONIC` índice 10) y le deja 1 MON. Así el servidor público no guarda la llave del deployer,
   que administra el registro de actores.
2. `pnpm evidencias:publicar`: copia a `evidencias-publicas/` las facturas, fotos y actas de las
   campañas en Monad (Vercel no tiene la carpeta local `evidencias/`). Haz commit de esa carpeta.
3. `pnpm vercel:env`: escribe `.env.vercel` (ignorado por git) con las variables para Vercel.
   Solo contiene las llaves de la pasarela y del patrocinador de gas.

En [vercel.com](https://vercel.com/new): importa el repositorio, deja la raíz del proyecto en la
carpeta del repo (Vercel toma `vercel.json`) y en *Environment Variables* pega el contenido de
`.env.vercel`. Después del primer despliegue:

4. `pnpm url:monad -- https://<tu-app>.vercel.app/` para que los NFT de recibo enlacen a la app publicada.
5. `cd pruebas-e2e && BASE_URL=https://<tu-app>.vercel.app node monad.mjs` (dona 2 veces de verdad).

| Variable en Vercel | Para qué |
|---|---|
| `CHAIN_ID` | `10143` |
| `PASARELA_PRIVATE_KEY` | Dueña de MockCOP: acuña los pesos de Nequi / PSE |
| `PATROCINADOR_PRIVATE_KEY` | Paga el gas de quien dona sin cripto, de las familias y de los reembolsos |
| `PINATA_JWT` | Opcional. Sin ella todo funciona menos **subir evidencias nuevas** desde el Panel de actores (el disco de Vercel no persiste) |
| `MONAD_RPC_URL`, `MONAD_RPC_RESPALDO` | Opcionales (RPC principal y de respaldo) |
| `LIMITE_PAGOS_IP`, `LIMITE_REENVIOS_IP`, `LIMITE_EVIDENCIAS_IP` | Tope por IP cada 10 min. `pnpm vercel:env` los deja en 60, 150 y 60 para que una sala con la misma red wifi pueda donar (sin ellos: 10, 30 y 30) |

## Pruebas

| Qué | Cómo | Resultado |
|---|---|---|
| Contratos | `pnpm test:contracts` | **107 tests**: camino feliz con 50 donantes, conteo en campo (menos unidades = rechazo), comunidad (quórum, orden, plazo), gas patrocinado (familia y donante sin gas, firma alterada), sobrecosto (3 de 3, un rechazo basta), matching heredado del contrato (tope, meta, devolución, conflicto de interés), reputación entre campañas, 20+ accesos no autorizados, NFT, fuzz e **invariantes** (el saldo siempre cuadra, incluido el matching bloqueado; nunca sale más de lo que entró; la fundación nunca cobra) |
| Simulación | `pnpm simular:local` | 3 escenarios con wallets simuladas, evidencias con imágenes y reputación final |
| Monad testnet | `cd pruebas-e2e && node monad.mjs` (o `BASE_URL=… node monad.mjs`) | Contra la app real en Monad (local o Vercel): API, 5 pestañas sin errores, evidencia publicada, donación con Nequi y con PSE y su rastreo |
| Frontend | `cd pruebas-e2e && npm run instalar && npm run prueba` | Chromium real: censo y tarjetas QR, aporte de empresa aliada, donación con Nequi sin wallet, donación con MetaMask, sobrecosto, evidencia con foto y GPS, 3 de 3 verificadores, familia confirma desde el celular, página pública (línea de tiempo, mapa, integridad), reputación, avisos, rechazo, reembolso sin gas y vista móvil |

## Límites que conviene reconocer en la sustentación

La blockchain garantiza que **el dinero se mueve según las reglas**, pero no que alguien diga la verdad (el
**problema del oráculo**). Lo atacamos con **señales independientes que tendrían que coludir todas**:

- **Verificadores 2 de 3** (3 de 3 si hay sobrecosto) de instituciones distintas.
- **Las familias**: el quórum de la comunidad es una segunda señal que la fundación no controla.
- **Evidencia pública** con foto, fecha y GPS, verificable contra el hash de la cadena.
- **Precios de referencia**: el sobrecosto no se puede esconder.
- **Conteo en campo**: inflar las unidades de la factura para bajar el precio unitario no sirve, porque cada
  verificador reporta lo que contó y, si no cuadra, su voto es un rechazo.
- **Reputación permanente**: quien hace trampa queda marcado para la próxima emergencia.
- **Plazos y reembolso**: si nadie aprueba a tiempo, el dinero vuelve a los donantes.

Otros límites honestos: el verificador que carga el censo podría inflarlo (por eso el censo se cruzaría con
el Registro Único de Damnificados y lo pueden auditar los otros verificadores); quien tenga la tarjeta de una
familia puede confirmar por ella; la pasarela Nequi/PSE y el patrocinador de gas corren en el servidor de la
demo (en producción: un on-ramp regulado a stablecoin y un paymaster/relayer); el administrador del registro
es una sola cuenta (en producción, una multifirma o DAO); MockCOP no tiene valor; el reembolso proporcional
puede dejar unos wei de redondeo.
