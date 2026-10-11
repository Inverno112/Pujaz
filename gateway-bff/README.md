# Gateway (BFF) · Pujaz

El Gateway es **el único punto de entrada de la SPA**. Recibe consultas GraphQL y suscripciones por WebSocket, valida el JWT y traduce cada operación a llamadas REST al **MS transaccional** y al **MS catálogo**. No tiene base de datos: todo lo que se guarda vive en los MS.

```
SPA  --GraphQL / WebSocket-->  Gateway  --REST-->  MS transaccional (PostgreSQL)
                                        --REST-->  MS catálogo (MongoDB)
```

Este README es para **quien usa el Gateway** (la SPA, los MS o quien levanta el proyecto). Los contratos están en [docs/contrato/](../docs/contrato/).

---

## Estado actual

El Gateway se construye por etapas. Esta tabla dice qué funciona hoy.

| Etapa | Operaciones | Estado |
|---|---|---|
| 0 · Base | Servidor, schema, errores, Docker | ✅ Lista |
| 1 · Autenticación | `register`, `login`, `me` | ✅ Lista |
| 2 · Lecturas | `items`, `item`, `auction`, `Item.auction` | ✅ Lista |
| 3 · Pujas y tiempo real | `placeBid`, `auctionUpdated` | 🔒 Bloqueada por [B1](#b1) |
| 4 · Billetera | `wallet`, `deposit` | ✅ Lista |
| 5a · Perfil | `updateUser`, `deleteUser` | ✅ Lista |
| 5b · Crear ítem | `createItem` | 🔒 Bloqueada por [B2](#b2) |
| 6 · MS reales | Clientes HTTP hacia los MS | ⏳ Pendiente |

> El schema completo ya se sirve (sirve para explorar tipos), pero solo funcionan las operaciones de las etapas marcadas como listas. Las demás, si las llamas, devuelven `null` (las que pueden ser nulas, como `item` o `auction`) o responden `INTERNAL`.
>
> Hasta la etapa 6, el Gateway trabaja con **clientes falsos** (`USE_MOCKS=true`): datos en memoria que imitan a los MS y que se reinician cada vez que el Gateway arranca. Datos de prueba:
>
> | Usuario | Contraseña |
> |---|---|
> | `ana@correo.com` | `secreto123` |
>
> Billetera de Ana: `available` 380000 y `reserved` 120000, con una recarga de 500000 y una reserva de 120000 en la subasta del reloj. Cada usuario nuevo (`register`) empieza con la billetera vacía.
>
> | Ítem | id | Subasta |
> |---|---|---|
> | Reloj de bolsillo 1920 | `64f1c0aa9b1e8a0012ab34cd` | Abierta (termina 3 días después de arrancar el Gateway), va ganando Ana con 120000 |
> | Lámpara de bronce art déco | `64f1c0aa9b1e8a0012ab34ce` | Cerrada, sin pujas |
> | Pintura al óleo de paisaje | `64f1c0aa9b1e8a0012ab34cf` | Sin subasta (`auction` es `null`) |
>
> Mientras no se resuelva [B1](#b1), en `winningBid.bidder` y `participants` pide solo `id` y `name`: si pides `email`, la respuesta trae un error `INTERNAL`.

---

## Bloqueos

Un bloqueo es una **decisión del contrato** que falta tomar en equipo. Mientras no se tome, la etapa que depende de ella no empieza, porque implementarla obligaría a inventar algo que la SPA o los MS no esperan. El detalle está en [rest.md §4 · Preguntas abiertas](../docs/contrato/rest.md#4-preguntas-abiertas-para-el-equipo).

<a id="b1"></a>
### B1 · Datos de otros usuarios en pujas y subastas (bloquea la etapa 3)

- **Qué pasa:** en [schema.graphql](../docs/contrato/schema.graphql), `Bid.bidder` (quién hizo la puja) y `Auction.participants` (quiénes han pujado) son del tipo `User`, que tiene `email` obligatorio. Pero el MS transaccional, según [rest.md](../docs/contrato/rest.md), solo entrega `{ id, name }` de los otros usuarios (`UserSummary`).
- **Por qué importa:**
  - El Gateway no tiene de dónde sacar el `email` de otros usuarios. Si la SPA lo pide, la respuesta falla.
  - Además, `auctionUpdated` es pública (no pide token): si devolviera `User` completo, cualquiera vería el correo de todos los que pujan.
- **Propuesta:** crear en `schema.graphql` un tipo con solo `id` y `name` (por ejemplo `Bidder`) y usarlo en `Bid.bidder` y `Auction.participants`.
- **Quién decide:** Catalina (dueña del schema GraphQL) junto con Heider (MS). Afecta a la SPA: las consultas que pidan `bidder { email }` dejarán de ser válidas.

<a id="b2"></a>
### B2 · Fecha de cierre al crear un ítem (bloquea la etapa 5b)

- **Qué pasa:** `createItem` crea el ítem en el MS catálogo y luego su subasta en el MS transaccional (`POST /auctions`), que exige `endsAt` (cuándo termina la subasta). Pero `CreateItemInput` en [schema.graphql](../docs/contrato/schema.graphql) no tiene ese campo.
- **Por qué importa:** sin `endsAt`, el Gateway no puede crear la subasta, y un ítem sin subasta no se puede pujar.
- **Propuesta:** agregar `endsAt: DateTime` **opcional** a `CreateItemInput`. Si la SPA no lo envía, el Gateway usa una duración por defecto (propuesta: 24 horas, aún sin decidir).
- **Quién decide:** Catalina (schema). Afecta al formulario de crear ítem en la SPA, que podría pedir la fecha de cierre.

### Cómo se resuelve un bloqueo

1. El equipo acuerda la solución.
2. Se cambia el contrato (`schema.graphql` y, si aplica, `rest.md`) en un Pull Request propio, en una rama `docs/...`.
3. Se actualiza esta sección del README y la etapa se desbloquea.

---

## Para la SPA

### Dónde conectarse

| Qué | Dirección |
|---|---|
| Consultas y mutaciones | `POST http://localhost:4000/graphql` |
| Suscripciones (desde la etapa 3) | `ws://localhost:4000/graphql`, protocolo `graphql-ws` |
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
docker compose up --build gateway-bff
```

El Gateway queda en `http://localhost:4000/graphql`. Por ahora corre con `USE_MOCKS=true`, así que no necesita los MS; cuando se conecte a los MS reales (etapa 6), el servicio pasará a depender de ellos.

El Gateway **no arranca**, y explica por qué en `docker compose logs gateway-bff`, si:
- falta `JWT_SECRET` o tiene menos de 32 caracteres;
- `USE_MOCKS=false`, porque los clientes HTTP hacia los MS llegan en la etapa 6.

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
  - [B1](#b1) y [B2](#b2) bloquean las etapas 3 y 5b (ver [Bloqueos](#bloqueos)).
  - Al cerrar una subasta, el dinero del ganador se queda en `reserved`: no hay un movimiento que lo cobre. Es una limitación conocida que queda fuera del prototipo, no un bloqueo.
- **Flujo de Git:** la rama de integración del equipo es `developcito` en heider88/Pujaz. Las ramas de trabajo salen de `develop` del fork, vuelven ahí y de ahí se abre el PR a `upstream/developcito`.
