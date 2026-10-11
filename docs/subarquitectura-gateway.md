# Subarquitectura del API Gateway (BFF) - Pujaz

## Descripción

Esta vista abre el componente **API Gateway BFF** de la [vista C&C](vista-cc.md) y muestra cómo está organizado por dentro. El Gateway es el único punto de entrada de la SPA: recibe GraphQL por HTTP y suscripciones por WebSocket, valida el JWT y traduce cada operación a llamadas REST a los dos microservicios. No tiene base de datos.

Está escrito en **Node.js + TypeScript** con **GraphQL Yoga** y se organiza en tres niveles: el **servidor** recibe las peticiones, los **módulos** resuelven cada operación y los **clientes HTTP** hablan con cada microservicio.

## Diagrama

```mermaid
graph TB
    Nginx["Nginx<br/>reverse proxy /graphql"]

    subgraph GW ["API Gateway BFF (Node.js + TypeScript)"]
        direction TB

        Server["Servidor GraphQL<br/>HTTP: consultas y mutaciones<br/>WebSocket: suscripciones"]

        subgraph Modulos ["Módulos"]
            Auth["auth<br/>login · register"]
            Users["users<br/>me · updateUser · deleteUser"]
            Wallet["wallet<br/>wallet · deposit"]
            Auctions["auctions<br/>auction · placeBid · createItem<br/>auctionUpdated"]
            Catalog["catalog<br/>items · item"]
        end

        subgraph Clientes ["Clientes HTTP"]
            UserC["Cliente de usuarios"]
            WalletC["Cliente de billetera"]
            AuctionC["Cliente de subastas"]
            ItemC["Cliente de ítems"]
        end
    end

    MST["MS Transaccional<br/>Go · puerto 8080"]
    MSC["MS Catálogo<br/>FastAPI · puerto 8000"]

    Nginx -->|"HTTP y WebSocket /graphql"| Server
    Server --> Modulos

    Auth --> UserC
    Users --> UserC
    Wallet --> WalletC
    Auctions --> AuctionC
    Auctions --> Catalog
    Catalog --> ItemC

    UserC -->|"REST /users"| MST
    WalletC -->|"REST /users/{id}/wallet"| MST
    AuctionC -->|"REST /auctions"| MST
    ItemC -->|"REST /items"| MSC
```

## Elementos

| Elemento | Responsabilidad |
|---|---|
| **Servidor GraphQL** | Recibe consultas y mutaciones por HTTP y suscripciones por WebSocket (`graphql-ws`) en `/graphql`. Lee el JWT de cada petición y obtiene el usuario. Todo error sale con uno de los códigos del contrato |
| **auth** | `login` y `register`: verifica credenciales en el MS transaccional y firma el JWT (HS256, 24 horas) |
| **users** | Perfil del usuario del token: `me`, `updateUser`, `deleteUser` |
| **wallet** | Billetera del usuario del token: `wallet` y `deposit` |
| **auctions** | Subastas y pujas: `auction`, `placeBid`, `createItem` y la suscripción `auctionUpdated`. Usa `catalog` para traer el ítem de cada subasta. Cuando una puja se acepta, avisa a quienes siguen esa subasta |
| **catalog** | Listado, búsqueda y detalle de ítems: `items`, `item` |
| **Clientes HTTP** | Uno por recurso del contrato REST (`docs/contrato/rest.md`). Envían JSON, esperan como máximo 5 s y validan cada respuesta contra el contrato |

## Relaciones

| Origen → destino | Conector | Para qué |
|---|---|---|
| Nginx → Servidor | HTTP y WebSocket en `/graphql` | Entrada única de la SPA; el JWT llega en `Authorization: Bearer` |
| Servidor → módulos | Llamada en el mismo proceso | Ejecutar cada operación con el usuario del token |
| `auctions` → `catalog` | Llamada en el mismo proceso | Completar el ítem de cada subasta y crear el ítem antes de su subasta |
| Módulos → clientes HTTP | Llamada en el mismo proceso | Pedir los datos al microservicio que corresponde |
| Clientes de usuarios, billetera y subastas → MS Transaccional | HTTP / REST JSON, puerto 8080 | Usuarios, saldo, subastas y pujas |
| Cliente de ítems → MS Catálogo | HTTP / REST JSON, puerto 8000 | Ítems |

Para desarrollar y probar sin los microservicios, cada cliente HTTP tiene una versión en memoria con los mismos datos de entrada y salida. La variable `USE_MOCKS` decide cuál se usa al arrancar, sin cambiar los módulos.

## Flujo de una puja en tiempo real

```mermaid
sequenceDiagram
    participant A as SPA de quien puja
    participant B as SPA de quien observa
    participant G as Gateway
    participant T as MS Transaccional

    B->>G: WebSocket: subscription auctionUpdated(auctionId)
    G->>G: se suscribe al tema de esa subasta
    A->>G: HTTP: mutation placeBid(auctionId, amount) + JWT
    G->>G: requireUser: userId sale del token
    G->>T: POST /auctions/{id}/bids { userId, amount }
    alt puja aceptada
        T-->>G: 201 { bid, auction }
        G->>G: publica auctionUpdated en el tema de la subasta
        G-->>A: Bid
        G-->>B: Auction (precio, puja ganadora, participantes)
    else puja rechazada
        T-->>G: 409 BID_TOO_LOW / AUCTION_CLOSED · 422 INSUFFICIENT_FUNDS · 404 NOT_FOUND
        G-->>A: error con el mismo código
        Note over G,B: no se publica nada
    end
```

## Decisiones y limitaciones

- **Una sola copia del Gateway.** Los eventos se publican en memoria del proceso; con varias copias, un observador no vería las pujas hechas en otra. Escalar requeriría un bus de eventos externo.
- **El contrato manda.** Con los MS reales, cada respuesta se valida contra `rest.md`. Si falta algo obligatorio o el endpoint no existe, la operación responde `INTERNAL` y el log del Gateway indica qué falta; el Gateway no inventa datos.
- **El Gateway no guarda nada.** Usuarios, saldos, subastas, pujas e ítems viven en los MS. El Gateway solo firma y valida el JWT (HS256, 24 horas).
