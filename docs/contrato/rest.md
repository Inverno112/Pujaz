# Contrato de API · Pujaz · Parte REST (Gateway -> microservicios)

Complementa a `schema.graphql` (SPA <-> Gateway). Aquí se define lo que el **Gateway** le pide a los dos microservicios. Los nombres de errores son exactamente los del schema.

## 0. Reglas generales

- **Quién llama a quién:** solo el Gateway llama a los microservicios. Los microservicios no se publican fuera de la red de Docker Compose; el navegador nunca los ve.
- **Autenticación:** el Gateway valida el JWT y saca el `userId` del token. A los microservicios les pasa ese `userId` en la ruta o en el cuerpo. Los microservicios no validan JWT (confían en la red interna).
- **Formato:** JSON (`Content-Type: application/json`). Fechas en ISO-8601 UTC (`2026-10-12T15:00:00Z`). Montos como número JSON (`150000.00`).
- **Ids:** texto (`string`). En el MS catálogo es el `_id` de MongoDB; en el MS transaccional es el id generado por PostgreSQL, enviado como texto.
- **Puertos y host:** los define Heider en el `docker-compose.yml`. En este documento se escriben como `MS transaccional` y `MS catálogo`.
- **Contraseñas:** el Gateway envía la contraseña en texto plano al MS transaccional por la red interna; el MS transaccional guarda solo el hash. Nunca se devuelve.

### Formato de error (todos los endpoints)

```json
{ "code": "BID_TOO_LOW", "message": "La puja debe superar el precio actual (120000.00)" }
```

`code` es uno de: `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `EMAIL_TAKEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `BID_TOO_LOW`, `AUCTION_CLOSED`, `INSUFFICIENT_FUNDS`, `INTERNAL`. El Gateway copia `code` tal cual a `errors[].extensions.code` de GraphQL. `UNAUTHENTICATED` lo genera solo el Gateway (los microservicios no lo usan).

| HTTP | Cuándo |
|---|---|
| 400 | `BAD_USER_INPUT` |
| 401 | `INVALID_CREDENTIALS` |
| 404 | `NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `BID_TOO_LOW`, `AUCTION_CLOSED` |
| 422 | `INSUFFICIENT_FUNDS` |
| 500 | `INTERNAL` |

---

## 1. MS transaccional (PostgreSQL)

Dueño de: usuarios, billetera y movimientos, subastas y pujas.

### Objetos que devuelve

```json
// UserSummary (lo que se ve de otros usuarios)
{ "id": "7", "name": "Ana" }

// User (el propio usuario)
{ "id": "7", "name": "Ana", "email": "ana@correo.com", "createdAt": "2026-10-09T14:00:00Z" }

// Auction
{
  "id": "12",
  "itemId": "64f1c0aa9b1e8a0012ab34cd",
  "basePrice": 100000.00,
  "currentPrice": 120000.00,
  "winningBid": { "id": "55", "amount": 120000.00, "bidder": { "id": "7", "name": "Ana" }, "createdAt": "2026-10-09T14:05:00Z" },
  "participants": [ { "id": "7", "name": "Ana" }, { "id": "9", "name": "Luis" } ],
  "endsAt": "2026-10-12T15:00:00Z",
  "status": "OPEN"
}
```

- `winningBid` es `null` si no hay pujas; entonces `currentPrice` = `basePrice`.
- `status` se calcula al leer: `OPEN` si ahora < `endsAt`, si no `CLOSED`.

### 1.1 Usuarios

**POST `/users`** — registrar usuario (crea también su billetera en 0).

```json
// Request
{ "name": "Ana", "email": "ana@correo.com", "password": "secreto123" }
// 201
{ "id": "7", "name": "Ana", "email": "ana@correo.com", "createdAt": "2026-10-09T14:00:00Z" }
```
Errores: 409 `EMAIL_TAKEN`, 400 `BAD_USER_INPUT` (campo vacío, correo inválido, contraseña de menos de 8 caracteres).

**POST `/users/verify-credentials`** — comprobar login. El Gateway firma el JWT si responde 200.

```json
// Request
{ "email": "ana@correo.com", "password": "secreto123" }
// 200
{ "id": "7", "name": "Ana", "email": "ana@correo.com", "createdAt": "2026-10-09T14:00:00Z" }
```
Errores: 401 `INVALID_CREDENTIALS` (correo no existe o contraseña incorrecta; mismo mensaje en ambos casos).

**GET `/users/{userId}`** — usuario por id (`me`).
- 200: objeto `User`. Errores: 404 `NOT_FOUND`.

**PATCH `/users/{userId}`** — actualizar. Solo se envían los campos que cambian.

```json
// Request
{ "name": "Ana María" }
// 200: objeto User actualizado
```
Errores: 404 `NOT_FOUND`, 409 `EMAIL_TAKEN`, 400 `BAD_USER_INPUT` (mismas reglas que en `POST /users` para los campos que se envíen).

**DELETE `/users/{userId}`** — borrar usuario.
- 204 sin cuerpo. Errores: 404 `NOT_FOUND`.
- Las pujas y movimientos históricos se conservan (el usuario se anonimiza, no se borran filas), para no romper subastas.

### 1.2 Billetera

**GET `/users/{userId}/wallet`**

```json
// 200
{
  "userId": "7",
  "available": 380000.00,
  "reserved": 120000.00,
  "movements": [
    { "id": "301", "type": "RESERVE", "amount": 120000.00, "auctionId": "12", "createdAt": "2026-10-09T14:05:00Z" },
    { "id": "300", "type": "DEPOSIT", "amount": 500000.00, "auctionId": null, "createdAt": "2026-10-09T13:50:00Z" }
  ]
}
```
- `type` es `DEPOSIT`, `RESERVE` o `REFUND`. Orden: del más reciente al más antiguo.
- Errores: 404 `NOT_FOUND`.

**POST `/users/{userId}/wallet/deposits`** — recargar.

```json
// Request
{ "amount": 500000.00 }
// 200: misma forma que GET /users/{userId}/wallet (ya con el depósito)
```
Errores: 400 `BAD_USER_INPUT` (`amount` <= 0), 404 `NOT_FOUND`.

### 1.3 Subastas

**POST `/auctions`** — crear la subasta de un ítem (el Gateway la llama justo después de crear el ítem en el MS catálogo).

```json
// Request
{ "itemId": "64f1c0aa9b1e8a0012ab34cd", "basePrice": 100000.00, "endsAt": "2026-10-12T15:00:00Z" }
// 201: objeto Auction (sin pujas)
```
Errores: 400 `BAD_USER_INPUT` (`endsAt` en el pasado, `basePrice` <= 0, o ya existe una subasta para ese `itemId`).

**GET `/auctions/{auctionId}`** — una subasta por id.
- 200: objeto `Auction`. Errores: 404 `NOT_FOUND`.

**GET `/auctions?itemIds=a,b,c`** — subastas de varios ítems en una sola llamada (para el listado y para `auction(itemId)`).
- 200: `[ Auction, ... ]`. Los ítems sin subasta simplemente no aparecen. Si ninguno existe, responde `[]` (no 404).

**GET `/auctions?ids=12,13`** — subastas por id (para `WalletMovement.auction`).
- 200: `[ Auction, ... ]`.

**POST `/auctions/{auctionId}/bids`** — pujar.

```json
// Request
{ "userId": "7", "amount": 130000.00 }
// 201
{
  "bid": { "id": "56", "amount": 130000.00, "bidder": { "id": "7", "name": "Ana" }, "createdAt": "2026-10-09T14:10:00Z" },
  "auction": { /* objeto Auction ya actualizado */ }
}
```

Todo ocurre en **una sola transacción de PostgreSQL**, con la fila de la subasta bloqueada (`SELECT ... FOR UPDATE`), en este orden:
1. Si la subasta no existe: 404 `NOT_FOUND`.
2. Si `status` es `CLOSED`: 409 `AUCTION_CLOSED`.
3. Si `amount` <= `currentPrice`: 409 `BID_TOO_LOW`.
4. Si el saldo disponible del usuario (más lo que ya tiene reservado en esta misma subasta, si ya iba ganando) es menor que `amount`: 422 `INSUFFICIENT_FUNDS`.
5. Se reserva `amount` al usuario (movimiento `RESERVE`).
6. Si había un ganador anterior, se le devuelve su monto (movimiento `REFUND`: pasa de `reserved` a `available`).
7. Se guarda la puja y se devuelve la subasta actualizada.

Con esto, si dos personas pujan al mismo tiempo, solo una gana y la otra recibe `BID_TOO_LOW`. El Gateway usa el campo `auction` de la respuesta para publicar `auctionUpdated` (ver sección 3).

---

## 2. MS catálogo (MongoDB)

Dueño de: ítems y sus documentos. No sabe nada de subastas.

### Objeto Item

```json
{
  "id": "64f1c0aa9b1e8a0012ab34cd",
  "name": "Reloj de bolsillo 1920",
  "description": "Plata, funcionando",
  "category": "Relojes",
  "images": ["https://.../1.jpg"],
  "documents": ["https://.../certificado.pdf"],
  "basePrice": 100000.00
}
```

**GET `/items?search=reloj`** — listado; `search` es opcional y busca en nombre y descripción (sin distinguir mayúsculas).
- 200: `[ Item, ... ]` (puede ser `[]`).

**GET `/items?ids=a,b,c`** — varios ítems por id en una sola llamada (para `Auction.item` cuando se piden varias subastas).
- 200: `[ Item, ... ]`. Los ids que no existen no aparecen.

**GET `/items/{itemId}`** — un ítem.
- 200: `Item`. Errores: 404 `NOT_FOUND`. (El Gateway convierte este 404 en `null` en `Query.item`.)

**POST `/items`** — crear ítem.

```json
// Request
{ "name": "Reloj de bolsillo 1920", "description": "Plata", "category": "Relojes",
  "images": ["https://.../1.jpg"], "documents": [], "basePrice": 100000.00 }
// 201: objeto Item
```
Errores: 400 `BAD_USER_INPUT` (`name` vacío, `basePrice` <= 0).

---

## 3. Qué endpoint usa cada cosa del schema

### Queries

| Schema | Llamadas del Gateway |
|---|---|
| `items(search)` | MS catálogo `GET /items?search=` |
| `Item.auction` (en el listado) | MS transaccional `GET /auctions?itemIds=` (una sola llamada para todo el listado) |
| `item(id)` | MS catálogo `GET /items/{itemId}` |
| `auction(itemId)` | MS transaccional `GET /auctions?itemIds={itemId}` (lista vacía -> `null`) + MS catálogo `GET /items/{itemId}` para `Auction.item` |
| `me` | MS transaccional `GET /users/{userId}` |
| `wallet` | MS transaccional `GET /users/{userId}/wallet` + (si piden `movements.auction`) `GET /auctions?ids=` |

### Mutations

| Schema | Llamadas del Gateway |
|---|---|
| `login` | MS transaccional `POST /users/verify-credentials` -> el Gateway firma el JWT |
| `register` | MS transaccional `POST /users` -> el Gateway firma el JWT |
| `updateUser` | MS transaccional `PATCH /users/{userId}` |
| `deleteUser` | MS transaccional `DELETE /users/{userId}` |
| `placeBid` | MS transaccional `POST /auctions/{auctionId}/bids` -> luego publica `auctionUpdated` |
| `deposit` | MS transaccional `POST /users/{userId}/wallet/deposits` |
| `createItem` | MS catálogo `POST /items` -> luego MS transaccional `POST /auctions` |

### Subscription

| Schema | Cómo funciona |
|---|---|
| `auctionUpdated(auctionId)` | No usa un endpoint propio. El Gateway mantiene los WebSocket abiertos y, cuando `placeBid` responde 201, toma el `auction` de la respuesta, le agrega `item` desde el MS catálogo (`GET /items/{itemId}`) y lo envía a los suscriptores de esa subasta. |

### Campos de tipos que el Gateway completa

| Campo | De dónde sale |
|---|---|
| `Auction.item` | MS catálogo (`GET /items/{itemId}` o `GET /items?ids=`) |
| `Auction.winningBid`, `Auction.participants`, `Bid.bidder` | Vienen dentro del `Auction` del MS transaccional |
| `WalletMovement.auction` | MS transaccional `GET /auctions?ids=` |

---

## 4. Preguntas abiertas para el equipo

1. **`createItem` no trae `endsAt`.** Para crear la subasta hace falta saber cuándo termina. Propuesta: agregar `endsAt: DateTime` (opcional) a `CreateItemInput` y, si no viene, el Gateway usa una duración por defecto (por ejemplo 24 horas).
2. **Datos visibles de otros usuarios.** `Bid.bidder` y `Auction.participants` son de tipo `User`, que incluye `email`, y `auctionUpdated` no pide JWT. Propuesta: que en esos dos campos se devuelva solo `id` y `name` (por eso el MS transaccional entrega `UserSummary`).
3. **Cierre de la subasta.** El schema no tiene un movimiento para el dinero del ganador al cerrar (hoy queda en `reserved`). Queda fuera del prototipo.
4. **Sin el conector "Eventos".** Si se levanta más de una copia del Gateway, las suscripciones no se enteran de pujas hechas por otra copia. Para el prototipo se usa una sola copia.
