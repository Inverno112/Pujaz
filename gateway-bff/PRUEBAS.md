# Pruebas del Gateway (BFF)

Guía para revisar qué está probado en el Gateway y cómo probarlo a mano o con pruebas end-to-end.

- **Automáticas:** 169 pruebas con Vitest, todas en verde. No necesitan Docker ni los microservicios.
- **Contra los MS reales:** lo que levanta `docker compose`, a través de Nginx en `http://localhost:8080/graphql`. Ver la [sección 5](#5-con-los-microservicios-reales).
- **A mano con datos falsos:** el Gateway solo, sin los MS ([sección 3](#3-probar-a-mano-datos-falsos)).

---

## 1. Correr las pruebas automáticas

Requiere Node.js 22 o superior.

```bash
cd gateway-bff
npm install
npm test                 # las 169 pruebas
npm run typecheck        # revisión de tipos de TypeScript
```

Para correr un solo archivo o un solo caso:

```bash
npx vitest run test/integration/bids.test.ts
npx vitest run -t "BID_TOO_LOW"
```

Las pruebas usan los **clientes falsos** (datos en memoria que imitan a los MS). Cada prueba arranca con los datos iniciales, así que no dependen unas de otras ni del orden.

---

## 2. Qué tipos de prueba hay

| Tipo | Qué prueba | Dónde |
|---|---|---|
| **Integración (GraphQL completo)** | Consultas y mutaciones de punta a punta dentro del Gateway: petición GraphQL → resolver → servicio → cliente falso → respuesta. Verifican datos, errores y que el usuario salga del token | `test/integration/*.test.ts` |
| **Tiempo real** | Un servidor real (HTTP + WebSocket) en un puerto libre y clientes `graphql-ws` suscritos, como la SPA | `test/integration/realtime.test.ts` |
| **Arranque** | El proceso del Gateway se inicia con distintas variables de entorno y se revisa si arranca o falla con un mensaje claro | `test/integration/startup.test.ts` |
| **Unitarias** | Piezas sueltas: JWT, configuración, clientes falsos y clientes HTTP (sin red: se simulan las respuestas de los MS, copiadas de las respuestas reales) | `test/unit/*.test.ts` |

### Qué cubre cada archivo

| Archivo | Casos | Qué verifica |
|---|---|---|
| `integration/auth.test.ts` | 12 | `register`, `login`, `me`: token válido, `EMAIL_TAKEN`, `INVALID_CREDENTIALS` (mismo mensaje si falla el correo o la contraseña), `BAD_USER_INPUT`, token vencido o inválido → `UNAUTHENTICATED`, la contraseña nunca sale en la respuesta |
| `integration/catalog.test.ts` | 14 | `items` (todos y con búsqueda), `item` inexistente → `null`, `auction(itemId)` con su ítem, ítem sin subasta → `null`, **una sola llamada** al MS para todo el listado, nada pide token |
| `integration/bids.test.ts` | 11 | `placeBid`: sin token, puja válida (reserva saldo), reintegro al ganador anterior, `BID_TOO_LOW`, `AUCTION_CLOSED`, `INSUFFICIENT_FUNDS`, `NOT_FOUND`, el usuario sale del token |
| `integration/realtime.test.ts` | 3 | `auctionUpdated`: dos suscriptores reciben el evento, uno de otra subasta no, una puja fallida no publica nada, no pide token |
| `integration/wallet.test.ts` | 13 | `wallet` y `deposit`: sin token, saldos y orden de movimientos, monto ≤ 0 → `BAD_USER_INPUT`, la subasta de cada reserva en **una sola llamada** |
| `integration/profile.test.ts` | 11 | `updateUser` y `deleteUser`: sin token, solo cambia lo enviado, `EMAIL_TAKEN`, validaciones, cambio de contraseña, cuenta borrada |
| `integration/create-item.test.ts` | 9 | `createItem`: sin token, crea ítem y subasta, duración por defecto de 14 días, `BAD_USER_INPUT`, falla de la subasta |
| `integration/server.test.ts` | 5 | El schema se sirve, errores con los códigos del contrato, error inesperado → `INTERNAL` sin detalles |
| `integration/startup.test.ts` | 3 | Sin `JWT_SECRET` o con uno corto no arranca; con `USE_MOCKS=false` arranca con los clientes HTTP |
| `unit/http-client.test.ts` | 11 | Traducción de errores de los MS, MS caído, tiempo de espera de 5 s, rutas que no existen |
| `unit/http-clients.test.ts` | 22 | Cada cliente HTTP con respuestas reales de los MS: validación del contrato (por ejemplo, usuario sin `createdAt` → `INTERNAL`) |
| `unit/*.mock.test.ts`, `token.service`, `config`, `auth.service` | 55 | Reglas de los clientes falsos, firma y vencimiento del JWT, variables de entorno |


---

## 3. Probar a mano (datos falsos)

### Levantar

Desde la raíz del repositorio, con el `.env` creado (ver el README de la raíz) y `USE_MOCKS=true` agregado a ese `.env`:

```bash
docker compose up -d --build
```

Todo entra por **Nginx en `http://localhost:8080`**: la SPA en `/` y el Gateway en `/graphql`. Con `USE_MOCKS=true`, el Gateway usa **datos falsos** y no llama a los MS. Sin esa línea (el valor por defecto), usa los MS reales: ver la [sección 5](#5-con-los-microservicios-reales).

Las peticiones se pueden hacer con Postman, Insomnia, `curl` o abriendo `http://localhost:8080/graphql` en el navegador (GraphiQL). Para las operaciones que piden token, se agrega el encabezado:

```
Authorization: Bearer <token>
```

### Datos de prueba

| Dato | Valor |
|---|---|
| Usuario | `ana@correo.com` / `secreto123` (id `7`) |
| Billetera de Ana | 380000 disponibles, 120000 reservados en la subasta del reloj |
| Reloj de bolsillo 1920 | ítem `64f1c0aa9b1e8a0012ab34cd`, subasta `12` **abierta**, va ganando Ana con 120000 |
| Lámpara de bronce art déco | ítem `64f1c0aa9b1e8a0012ab34ce`, subasta `13` **cerrada** |
| Pintura al óleo de paisaje | ítem `64f1c0aa9b1e8a0012ab34cf`, **sin subasta** |

Los datos se reinician cada vez que se reinicia el contenedor del Gateway (`docker compose restart gateway-bff`).

### Casos listos para copiar

**Iniciar sesión** (guardar el `token`):
```graphql
mutation { login(email: "ana@correo.com", password: "secreto123") { token user { id name } } }
```

**Registrar un segundo usuario** para pujar contra Ana:
```graphql
mutation { register(input: { name: "Luis", email: "luis@correo.com", password: "secreto456" }) { token } }
```

**Listado y detalle** (sin token):
```graphql
{ items { id name basePrice auction { id currentPrice status } } }
{ auction(itemId: "64f1c0aa9b1e8a0012ab34cd") { id currentPrice status endsAt winningBid { amount bidder { name } } participants { name } item { name } } }
```

**Billetera** (con token):
```graphql
{ wallet { available reserved movements { type amount auction { id } } } }
mutation { deposit(amount: 500000) { available } }
```

**Pujar** (con el token de Luis, después de recargar):
```graphql
mutation { placeBid(auctionId: "12", amount: 130000) { id amount createdAt bidder { name } } }
```
Después de pujar, la billetera de Luis tiene 130000 reservados y la de Ana recibe un `REFUND` de 120000.

**Perfil y crear ítem** (con token):
```graphql
mutation { updateUser(input: { name: "Luis Felipe" }) { name email } }
mutation { createItem(input: { name: "Radio Philips 1950", description: "De tubos", basePrice: 150000 }) { id auction { id status endsAt } } }
mutation { deleteUser }
```

### Casos negativos (qué error debe salir)

Todo error llega en `errors[0].extensions.code`.

| Caso | Código esperado |
|---|---|
| `wallet`, `deposit`, `placeBid`, `me`, `updateUser`, `deleteUser` o `createItem` sin token, o con un token inválido o vencido | `UNAUTHENTICATED` |
| `login` con contraseña o correo incorrectos | `INVALID_CREDENTIALS` |
| `register` con un correo ya usado, o `updateUser` con el correo de otro | `EMAIL_TAKEN` |
| `register` con contraseña de menos de 8 caracteres, `deposit(amount: 0)`, `createItem` con precio base 0 | `BAD_USER_INPUT` |
| `placeBid` en la subasta `12` por 120000 o menos | `BID_TOO_LOW` |
| `placeBid` en la subasta `13` | `AUCTION_CLOSED` |
| `placeBid` por más del saldo disponible | `INSUFFICIENT_FUNDS` |
| `placeBid` en la subasta `999` | `NOT_FOUND` |
| `item(id: "no-existe")` o `auction` de la pintura | `null`, **sin error** |
| Consulta mal escrita o campo que no existe | `BAD_USER_INPUT` |

---

## 4. Probar el tiempo real

La suscripción `auctionUpdated` es pública (no pide token) y va por **WebSocket** con el protocolo `graphql-ws` en `ws://localhost:8080/graphql`.

**La forma más fácil:** abrir el detalle del reloj en la SPA en **dos ventanas** (una puede ser de incógnito, con otro usuario). Al pujar en una, el precio, la puja ganadora y los participantes cambian solos en la otra.

Qué revisar:
- El evento llega a todas las ventanas que ven **esa** subasta, y no a las que ven otra.
- Si la puja falla (`BID_TOO_LOW`, falta de saldo), **no** cambia nada en las otras ventanas.
- Se puede ver sin iniciar sesión.

Para una prueba automática con Playwright, sirven dos contextos de navegador (`browser.newContext()`), uno para quien puja y otro para quien observa.

---

## 5. Con los microservicios reales

`docker-compose.yml` conecta el Gateway con los MS (`USE_MOCKS=false`). Para empezar con las bases recién cargadas (migraciones y semillas de PostgreSQL y MongoDB):

```bash
docker compose down -v          # borra los volúmenes: se pierden los datos de pruebas anteriores
docker compose up -d --build
```

Las semillas solo se cargan cuando los volúmenes están vacíos. Las subastas de la semilla cierran **3 días después** de ese arranque, así que antes de una demo conviene recrearlos.

### Datos de la semilla

| Ítem (MongoDB) | id | Subasta (PostgreSQL) |
|---|---|---|
| Reloj Vintage | `60d5ec49f1b2c3d4e5f60001` | `1`, abierta |
| Pintura Abstracta … Porsche 911 Clásico | `60d5ec49f1b2c3d4e5f60002` … `…60010` | `2` … `10`, abiertas |

Usuarios: Ana, Heider y Cata (`ana@correo.com`, `heider@correo.com`, `cata@correo.com`), pero **no pueden iniciar sesión** (ver la tabla). Para probar se registra un usuario nuevo, se recarga su billetera con `deposit` y se puja.

### Qué funciona hoy

| Operación | Con los MS reales |
|---|---|
| `items`, `item`, `auction`, la subasta de cada ítem | ✅ |
| `placeBid`, `auctionUpdated` | ✅ |
| `wallet`, `deposit` | ✅ (las reservas llegan sin su subasta: el MS las guarda con `auctionId: null`) |
| `register`, `login`, `me`, `updateUser`, `deleteUser` | ✅ con usuarios registrados |
| `login` de Ana, Heider o Cata (semilla) | ❌ `INVALID_CREDENTIALS`: sus contraseñas en la semilla no son hashes bcrypt |
| `createItem` | ❌ `INTERNAL`: el MS transaccional no tiene `POST /auctions` |

Además, las semillas no coinciden en el precio: el ítem en MongoDB tiene `basePrice` 100000 y su subasta en PostgreSQL arranca en `currentPrice` 100, así que se puede pujar por debajo del precio base.

Lo más simple es **registrar un usuario nuevo** y usar su token. Si hace falta un token de un usuario de la semilla (que no pueden iniciar sesión), se puede firmar uno a mano, por ejemplo para el `1`:

```bash
docker compose exec gateway-bff node -e "import('/app/dist/modules/auth/token.service.js').then(async m => console.log(await new m.TokenService(process.env.JWT_SECRET, '1h').sign('1')))"
```

### Leer el log del Gateway

Cuando algo responde `INTERNAL`, el log dice exactamente qué falló, sin mostrárselo a la SPA:

```bash
docker compose logs gateway-bff | grep '\[gateway\]'
```

Ejemplo: `[gateway] MS transaccional POST /users: falta User.createdAt (contrato rest.md)`.

---

## 6. Escenarios sugeridos para las e2e

Estos son los flujos que más valor tienen en las pruebas end-to-end de la SPA, porque cruzan Nginx, Gateway y MS:

1. **Catálogo:** el listado muestra los ítems con su precio y estado; la búsqueda filtra; el detalle muestra la subasta.
2. **Sesión:** registro → login → perfil; un login con contraseña incorrecta muestra el error.
3. **Billetera:** recargar y ver el saldo actualizado; una recarga de 0 muestra el error.
4. **Puja:** con saldo, pujar más que el precio actual → la puja aparece como ganadora y el saldo queda reservado.
5. **Puja inválida:** pujar menos que el precio actual → mensaje de puja baja; sin saldo suficiente → mensaje de saldo insuficiente.
6. **Tiempo real:** dos usuarios en la misma subasta; cuando uno puja, el otro ve el cambio sin recargar.
7. **Protección:** sin sesión, la billetera y el botón de pujar no deben estar disponibles (o deben pedir iniciar sesión).

Con datos falsos se pueden correr todos. Con los MS reales también, registrando usuarios nuevos (los de la semilla no pueden iniciar sesión).

---

## 7. Lo que no está probado o no aplica

- **Varias copias del Gateway:** los eventos en vivo se publican en memoria; el prototipo corre una sola copia.
- **Cierre de una subasta en vivo:** no se emite un evento cuando llega `endsAt`; el estado `CLOSED` se calcula al consultar.
- **Pruebas contra los MS reales dentro de `npm test`:** las automáticas usan datos falsos o respuestas reales copiadas. Las de punta a punta con los MS se hacen con Docker (sección 5).
