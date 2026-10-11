# Gateway (BFF) · Pujaz

El Gateway es **el único punto de entrada de la SPA**. Recibe consultas GraphQL y suscripciones por WebSocket, valida el JWT y traduce cada operación a llamadas REST al **MS transaccional** y al **MS catálogo**. No tiene base de datos: todo lo que se guarda vive en los MS.

```
SPA  --GraphQL / WebSocket-->  Gateway  --REST-->  MS transaccional (PostgreSQL)
                                        --REST-->  MS catálogo (MongoDB)
```

Este README es para **quien usa el Gateway** (la SPA, los MS o quien levanta el proyecto). Los contratos están en [docs/contrato/](../docs/contrato/). Para probarlo (pruebas automáticas, casos a mano y escenarios e2e), ver [PRUEBAS.md](PRUEBAS.md).

---

## Estado actual

El Gateway se construye por etapas. Esta tabla dice qué funciona hoy con los **clientes falsos**. Con los MS reales (lo que levanta `docker-compose.yml`), ver [Con los MS reales](#con-los-ms-reales).

| Etapa | Operaciones | Estado |
|---|---|---|
| 0 · Base | Servidor, schema, errores, Docker | ✅ Lista |
| 1 · Autenticación | `register`, `login`, `me` | ✅ Lista |
| 2 · Lecturas | `items`, `item`, `auction`, `Item.auction` | ✅ Lista |
| 3 · Pujas y tiempo real | `placeBid`, `auctionUpdated` | ✅ Lista |
| 4 · Billetera | `wallet`, `deposit` | ✅ Lista |
| 5a · Perfil | `updateUser`, `deleteUser` | ✅ Lista |
| 5b · Crear ítem | `createItem` | ✅ Lista |
| 6 · MS reales | Clientes HTTP hacia los MS | ✅ Conectado por defecto en `docker-compose.yml`. Pendientes del MS: `createItem` y `WalletMovement.auction` ([ver abajo](#con-los-ms-reales)) |

> Con **clientes falsos** (`USE_MOCKS=true`, solo para desarrollar el Gateway aislado), el Gateway usa datos en memoria que imitan a los MS y que se reinician cada vez que arranca. Datos de prueba:
>
> | Usuario | Contraseña |
> |---|---|
> | `ana@correo.com` | `secreto123` |
>
> Billetera de Ana: `available` 380000 y `reserved` 120000, con una recarga de 500000 y una reserva de 120000 en la subasta del reloj. Cada usuario nuevo (`register`) empieza con la billetera vacía. Las pujas mueven la billetera como el MS: reservan el monto a quien puja y le devuelven el suyo a quien iba ganando.
>
> | Ítem | id | Subasta |
> |---|---|---|
> | Reloj de bolsillo 1920 | `64f1c0aa9b1e8a0012ab34cd` | Abierta (termina 3 días después de arrancar el Gateway), va ganando Ana con 120000 |
> | Lámpara de bronce art déco | `64f1c0aa9b1e8a0012ab34ce` | Cerrada, sin pujas |
> | Pintura al óleo de paisaje | `64f1c0aa9b1e8a0012ab34cf` | Sin subasta (`auction` es `null`) |

---

## Con los MS reales

Con `USE_MOCKS=false`, el Gateway llama a los MS (`MS_TRANSACCIONAL_URL` y `MS_CATALOGO_URL`) siguiendo [rest.md](../docs/contrato/rest.md) **al pie de la letra** y valida cada respuesta:

- Si el MS responde con todo lo que pide el contrato, la operación funciona.
- Si falta algo obligatorio o el endpoint no existe, la operación responde `INTERNAL` y el log del Gateway dice qué falta, por ejemplo: `[gateway] MS transaccional GET /users/1: falta User.createdAt (contrato rest.md)`. El Gateway **no inventa** datos ni rutas alternativas: cuando el MS se complete, la operación funciona sin cambiar el Gateway.
- Lo que el MS envíe de más (por ejemplo `role` y `status` del usuario) no llega a la SPA.
- Los errores de los MS conservan su código. Los del MS catálogo, que vienen en formato de FastAPI (`{ "detail": ... }`), se traducen: 404 → `NOT_FOUND`, 400/422 → `BAD_USER_INPUT`.
- Un usuario que el MS marca con `status: "inactiva"` (borrado) se trata como `NOT_FOUND`.
- `createItem` envía `description` tal cual. El schema la deja opcional, pero el MS catálogo la exige: sin descripción, el MS responde `BAD_USER_INPUT`.
- Si un MS no responde en 5 segundos o está caído, la SPA recibe `INTERNAL`.

### Qué funciona hoy (11 de octubre)

| Operación | Con los MS reales | Qué falta y de quién depende |
|---|---|---|
| `items`, `item`, `auction`, `Item.auction`, `Auction.item` | ✅ | — |
| `placeBid`, `auctionUpdated` | ✅ | La puja reserva y reintegra saldo en el MS; el evento llega a quienes siguen esa subasta |
| `wallet`, `deposit` | ✅ | Recarga, reserva al pujar y reintegro al ser superado, con sus movimientos |
| `WalletMovement.auction` | 🟡 Sale `null` | `wallet_movements` no tiene `auction_id`, así que las reservas llegan con `auctionId: null` (Heider) |
| `register`, `login`, `me`, `updateUser`, `deleteUser` | ✅ | — |
| `login` con los usuarios de la semilla | ❌ `INVALID_CREDENTIALS` | Sus contraseñas en la semilla no son hashes bcrypt válidos: `000004_expand_seeds` solo corrige hashes vacíos y la semilla trae `hash_password123` (Frank / Heider). Mientras tanto, se crea un usuario con `register` |
| `createItem` | ❌ `INTERNAL`, sin llamar a ningún MS | No existe `POST /auctions` (Heider). El Gateway no crea el ítem para no dejarlo sin subasta en el catálogo. Cuando exista, se descomenta la llamada en `infrastructure/clients/http/auction.http.ts` |

Verificado el 11 de octubre con `docker compose up --build` y volúmenes nuevos, a través de Nginx (`http://localhost:8080/graphql`): 32 de 33 casos pasan (catálogo, registro, login, perfil, billetera, pujas con sus errores, reintegro y `auctionUpdated` con dos usuarios). El que falla es `WalletMovement.auction`.

`docker-compose.yml` usa los MS reales (`USE_MOCKS=false`). Para volver a los clientes falsos, se pone `USE_MOCKS=true` en `.env`.

---

## Bloqueos resueltos

Los dos bloqueos del contrato se resolvieron en `schema.graphql` (PR #9):

- **B1:** `Bid.bidder` y `Auction.participants` son ahora del tipo `Bidder { id, name }`, sin correo. Desbloquea la etapa 3.
- **B2:** `CreateItemInput` tiene `endsAt` opcional. Si la SPA no lo envía, la subasta dura **14 días**. El Gateway no pone tope ni valida la fecha: esas reglas son del MS (por ejemplo, `endsAt` en el pasado → `BAD_USER_INPUT`).

Si aparece otro bloqueo, se resuelve igual: el equipo acuerda la solución, se cambia el contrato en un Pull Request propio (rama `docs/...`) y se actualiza este README.

---

## Para la SPA

### Dónde conectarse

| Qué | Dirección |
|---|---|
| Consultas y mutaciones | `POST http://localhost:4000/graphql` |
| Suscripciones | `ws://localhost:4000/graphql` (o `ws://localhost:8080/graphql` a través de Nginx), protocolo `graphql-ws`, sin token |
| Tipos y operaciones | [schema.graphql](../docs/contrato/schema.graphql) (el contrato) |

CORS: por defecto se acepta el origen `http://localhost:5173` (Vite). Si la SPA corre en otro origen, se cambia con `CORS_ORIGIN`.

```bash
curl -s http://localhost:4000/graphql \
  -H 'content-type: application/json' \
  -d '{"query":"{ __typename }"}'
# {"data":{"__typename":"Query"}}
```

### Autenticación

1. `login` o `register` devuelven `{ token, user }`.
2. En cada operación protegida, la SPA envía el encabezado `Authorization: Bearer <token>`.
3. El token dura **24 horas**. Cuando vence, las operaciones protegidas responden `UNAUTHENTICATED` y hay que iniciar sesión de nuevo.

| Públicas (sin token) | Protegidas (con token) |
|---|---|
| `register`, `login` | `me`, `updateUser`, `deleteUser` |
| `items`, `item`, `auction` | `wallet`, `deposit` |
| Suscripción `auctionUpdated` | `placeBid`, `createItem` |

- El usuario sale **siempre del token**. Ninguna operación recibe un `userId` como argumento.
- Si una operación pública recibe un token inválido, se ejecuta igual, como si no hubiera token.

### Errores

Todos los errores llegan en `errors[].extensions.code` con **uno de estos 9 valores**. Usa el `code` para armar los mensajes de la interfaz, no el `message`.

| Código | Cuándo aparece |
|---|---|
| `UNAUTHENTICATED` | Operación protegida sin token, o con un token inválido o vencido |
| `INVALID_CREDENTIALS` | `login` con un correo o una contraseña incorrectos (mismo mensaje en los dos casos) |
| `EMAIL_TAKEN` | `register` o `updateUser` con un correo que ya existe |
| `BAD_USER_INPUT` | Datos inválidos (por ejemplo, `register` con un campo vacío, un correo inválido o una contraseña de menos de 8 caracteres, o `deposit` con monto <= 0) o una consulta GraphQL mal escrita |
| `NOT_FOUND` | El recurso no existe (`item(id)` inexistente devuelve `null`, no este error) |
| `BID_TOO_LOW` | La puja no supera el precio actual |
| `AUCTION_CLOSED` | La subasta ya terminó |
| `INSUFFICIENT_FUNDS` | No hay saldo disponible suficiente para pujar |
| `INTERNAL` | Fallo inesperado. El mensaje siempre es genérico y nunca trae detalles internos |

```json
{
  "errors": [
    { "message": "La puja debe superar el precio actual.", "path": ["placeBid"], "extensions": { "code": "BID_TOO_LOW" } }
  ],
  "data": null
}
```

---

## Para los MS

- **Solo el Gateway llama a los MS.** El navegador nunca los ve.
- Los MS **no validan el JWT**: el Gateway ya lo hizo y les pasa el `userId` en la ruta o en el cuerpo.
- El contrato completo (endpoints, cuerpos y códigos HTTP) está en [rest.md](../docs/contrato/rest.md). El Gateway lo sigue al pie de la letra.
- Cuando algo falla, el MS responde en este formato, con un `code` de la tabla de errores (todos menos `UNAUTHENTICATED`, que solo lo genera el Gateway):

  ```json
  { "code": "BID_TOO_LOW", "message": "La puja debe superar el precio actual (120000.00)" }
  ```

  El Gateway reenvía ese `code` a la SPA tal cual. Si el MS responde en otro formato, no responde o se cae, la SPA recibe `INTERNAL`.
- Las consultas en lote (`GET /auctions?itemIds=`, `GET /auctions?ids=`, `GET /items?ids=`) devuelven `[]` cuando no encuentran nada, no un 404. El Gateway hace **una sola** llamada por listado, no una por elemento.
- El Gateway encuentra a los MS con `MS_TRANSACCIONAL_URL` y `MS_CATALOGO_URL`, que se definen en `docker-compose.yml`.

---

## Cómo correrlo

### Con Docker Compose (la forma oficial)

Desde la raíz del repositorio:

```bash
cp .env.example .env
# Pon en .env un JWT_SECRET de al menos 32 caracteres, por ejemplo el que genera:
openssl rand -hex 32
docker compose up --build
```

La SPA queda en `http://localhost:8080` y el Gateway responde en `http://localhost:8080/graphql` a través de Nginx. El `docker-compose.yml` lo deja con `USE_MOCKS=false`: arranca después de que los dos MS estén sanos y usa sus bases de datos. Para levantar solo el Gateway con clientes falsos: `USE_MOCKS=true docker compose up --build gateway-bff --no-deps`.

El Gateway **no arranca**, y explica por qué en `docker compose logs gateway-bff`, si:
- falta `JWT_SECRET` o tiene menos de 32 caracteres;
- `USE_MOCKS=false` y falta `MS_TRANSACCIONAL_URL` o `MS_CATALOGO_URL`.

El schema vive en `docs/contrato/` de la raíz, fuera de `gateway-bff/`. Por eso el servicio lo recibe como contexto adicional:

```yaml
gateway-bff:
  build:
    context: ./gateway-bff
    additional_contexts:
      contrato: ./docs/contrato
```

Para construir solo la imagen, sin Compose (desde la raíz): `docker build --build-context contrato=docs/contrato -t pujaz-gateway gateway-bff`.

### Para desarrollar (sin Docker)

```bash
cd gateway-bff
npm install
cp .env.example .env   # y pon un JWT_SECRET
npm run dev
```

`npm run dev` y `npm start` leen `gateway-bff/.env` automáticamente. Con `USE_MOCKS=true` (el valor que trae `.env.example`) no hace falta levantar los MS. Ojo: fuera de Docker, `false` es el valor por defecto si la variable no está definida.

### Variables de entorno

| Variable | Para qué | Obligatoria | Por defecto |
|---|---|---|---|
| `JWT_SECRET` | Firmar y verificar el JWT (mínimo 32 caracteres) | Sí | — |
| `JWT_EXPIRES_IN` | Duración del token | No | `24h` |
| `USE_MOCKS` | `true`: clientes falsos; `false`: MS reales | No | `false` |
| `MS_TRANSACCIONAL_URL` | Dirección del MS transaccional | Si `USE_MOCKS=false` | — |
| `MS_CATALOGO_URL` | Dirección del MS catálogo | Si `USE_MOCKS=false` | — |
| `PORT` | Puerto del Gateway | No | `4000` |
| `CORS_ORIGIN` | Origen permitido de la SPA | No | `http://localhost:5173` |

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca en modo desarrollo y se reinicia con cada cambio |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Arranca la versión compilada |
| `npm test` | Corre las pruebas (Vitest) |
| `npm run typecheck` | Revisa los tipos sin compilar |

---

## Cosas a tener en cuenta

- **Una sola copia del Gateway.** Los eventos en vivo (`auctionUpdated`) se publican en memoria. Con dos copias, un suscriptor no vería las pujas hechas en la otra.
- **El contrato manda.** [schema.graphql](../docs/contrato/schema.graphql) (SPA ↔ Gateway) y [rest.md](../docs/contrato/rest.md) (Gateway ↔ MS) son la fuente de verdad. Para cambiarlos se abre un Pull Request propio que aprueban los dueños de ambos lados.
- **Preguntas abiertas** ([rest.md §4](../docs/contrato/rest.md#4-preguntas-abiertas-para-el-equipo)):
  - Al cerrar una subasta, el dinero del ganador se queda en `reserved`: no hay un movimiento que lo cobre. Es una limitación conocida que queda fuera del prototipo, no un bloqueo.
- **Flujo de Git:** la rama de integración del equipo es `developcito` en heider88/Pujaz. Las ramas de trabajo salen de `develop` del fork, vuelven ahí y de ahí se abre el PR a `upstream/developcito`.
