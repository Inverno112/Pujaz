# Frontend móvil de Pujaz

Aplicación móvil Flutter para Android e iOS. Reutiliza el contrato GraphQL de
[`docs/contrato/schema.graphql`](../docs/contrato/schema.graphql) y mantiene la
paridad funcional con la SPA: explorar subastas, consultar el detalle de una
pieza, iniciar sesión, registrarse, ofertar, administrar la billetera y editar
el perfil.

## Stack

- Flutter con Dart y Material 3.
- `graphql_flutter` para queries, mutations y subscriptions.
- `flutter_secure_storage` para persistir el JWT en el almacenamiento seguro
  del dispositivo.
- `go_router` para navegación declarativa y protección de rutas.
- `intl` para moneda COP y fechas localizadas.
- `flutter_dotenv` o configuración de compilación (`--dart-define`) para las
  URLs por ambiente.

La dependencia de GraphQL debe configurar dos transportes:

| Operación | Desarrollo | Producción |
|---|---|---|
| Query/mutation | `http://10.0.2.2:8080/graphql` (Android emulator) | `https://api.pujaz.example/graphql` |
| Subscription | `ws://10.0.2.2:8080/graphql` | `wss://api.pujaz.example/graphql` |

En un dispositivo físico, `10.0.2.2` se reemplaza por la IP de la máquina que
ejecuta Docker. Las URLs no deben quedar codificadas en los widgets.

## Estructura propuesta

```text
frontend-movil/
├── android/
├── ios/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── bootstrap.dart
│   ├── config/
│   │   ├── app_config.dart
│   │   └── environment.dart
│   ├── core/
│   │   ├── errors/graphql_error_mapper.dart
│   │   ├── formatters/currency_formatter.dart
│   │   ├── formatters/date_formatter.dart
│   │   ├── graphql/graphql_client_factory.dart
│   │   ├── graphql/graphql_documents.dart
│   │   ├── router/app_router.dart
│   │   ├── theme/app_theme.dart
│   │   └── widgets/
│   │       ├── app_error_view.dart
│   │       ├── app_loading_view.dart
│   │       └── empty_state.dart
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/auth_repository.dart
│   │   │   ├── domain/auth_models.dart
│   │   │   └── presentation/
│   │   │       ├── login_page.dart
│   │   │       ├── register_page.dart
│   │   │       └── session_controller.dart
│   │   ├── auctions/
│   │   │   ├── data/auction_repository.dart
│   │   │   ├── domain/auction_models.dart
│   │   │   └── presentation/
│   │   │       ├── auction_list_page.dart
│   │   │       ├── auction_detail_page.dart
│   │   │       ├── auction_card.dart
│   │   │       └── bid_panel.dart
│   │   ├── wallet/
│   │   │   ├── data/wallet_repository.dart
│   │   │   ├── domain/wallet_models.dart
│   │   │   └── presentation/wallet_page.dart
│   │   └── profile/
│   │       ├── data/profile_repository.dart
│   │       └── presentation/profile_page.dart
│   └── shared/
│       ├── widgets/app_scaffold.dart
│       └── widgets/primary_button.dart
├── test/
│   ├── core/
│   ├── features/auth/
│   ├── features/auctions/
│   └── features/wallet/
├── pubspec.yaml
└── README.md
```

La regla de dependencias es unidireccional: `presentation` usa casos de uso o
repositorios de `data`, `data` usa los documentos GraphQL de `core`, y `core`
no conoce widgets ni reglas de negocio. Los modelos de dominio no deben
exponer directamente mapas JSON a la UI.

## Navegación y experiencia móvil

Rutas públicas:

- `/` — listado de subastas con búsqueda por nombre o descripción.
- `/items/:id` — detalle, galería, documentos y panel de puja.
- `/login` — inicio de sesión.
- `/registro` — creación de cuenta.

Rutas privadas:

- `/billetera` — saldos, recarga y movimientos.
- `/perfil` — actualización y eliminación de cuenta.

La pantalla principal usa `NavigationBar` con **Subastas**, **Billetera** y
**Perfil**. Si la persona no está autenticada, Billetera y Perfil muestran una
pantalla de acceso y conservan la ruta destino para volver después del login.
El detalle usa `CustomScrollView`, imágenes adaptables y un panel de puja
anclado al final de la pantalla en lugar del layout de dos columnas de la SPA.

Estados que toda pantalla debe contemplar:

- carga inicial y refresco con `RefreshIndicator`;
- error de red con acción **Reintentar**;
- resultado vacío;
- sesión expirada (`UNAUTHENTICATED`);
- estados de negocio de puja (`BID_TOO_LOW`, `AUCTION_CLOSED`,
  `INSUFFICIENT_FUNDS`);
- botón deshabilitado mientras una mutation está en curso.

## Cliente GraphQL y sesión

`graphql_client_factory.dart` debe construir un `GraphQLClient` con:

1. `HttpLink` apuntando a la URL HTTP configurada.
2. `AuthLink` que lea el token desde una abstracción `TokenStorage` y envíe
   `Authorization: Bearer <token>` solo cuando exista.
3. `WebSocketLink` con protocolo `graphql-ws` para `auctionUpdated`.
4. `Link.split` para enrutar subscriptions por WebSocket y el resto por HTTP.
5. `GraphQLCache` con normalización por `__typename` e `id`.

El token se guarda únicamente en `flutter_secure_storage`. Al iniciar la app,
`SessionController` lee el token y ejecuta `me`; si recibe
`UNAUTHENTICATED`, borra el token y devuelve la sesión a estado anónimo.
Cerrar sesión también debe limpiar la caché para no dejar datos privados
visibles a otra persona que use el dispositivo.

## Operaciones GraphQL requeridas

Los documentos deben vivir en `core/graphql/graphql_documents.dart` o en
archivos por feature. Como mínimo, la app implementa:

```graphql
query GetItems($search: String) {
  items(search: $search) {
    id name category images basePrice
    auction { id currentPrice status endsAt }
  }
}

query GetItem($id: ID!) {
  item(id: $id) {
    id name description category images documents basePrice
    auction {
      id currentPrice status endsAt
      winningBid { id amount createdAt bidder { id name } }
      participants { id name }
    }
  }
}

subscription AuctionUpdated($auctionId: ID!) {
  auctionUpdated(auctionId: $auctionId) {
    id currentPrice status endsAt
    winningBid { id amount createdAt bidder { id name } }
    participants { id name }
  }
}
```

También se requieren `login`, `register`, `me`, `placeBid`, `wallet`,
`deposit`, `updateUser` y `deleteUser`, solicitando únicamente los campos
definidos en el contrato. La subscription del detalle se cancela en `dispose`
o al salir de la pantalla.

## `pubspec.yaml` mínimo

```yaml
name: pujaz_mobile
description: Cliente móvil del sistema de subastas Pujaz.
publish_to: none

environment:
  sdk: ">=3.4.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_secure_storage: ^9.2.2
  go_router: ^14.8.1
  graphql_flutter: ^5.2.0
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^5.0.0
  mocktail: ^1.0.4
```

Las versiones son una referencia de compatibilidad; deben resolverse con
`flutter pub get` y actualizarse juntas según el SDK instalado.

## Criterios de aceptación

- La app arranca en Android e iOS y permite cambiar HTTP/WS por ambiente.
- El listado consulta `items`, permite buscar y muestra precio/estado de cada
  subasta.
- El detalle muestra galería, documentos y precio actualizado en tiempo real
  mediante `auctionUpdated`.
- Una persona autenticada puede pujar, recargar su billetera, editar su perfil
  y eliminar su cuenta.
- Un token inválido no deja acceder a datos privados ni permanece almacenado.
- Los errores GraphQL se convierten en mensajes en español sin mostrar
  detalles internos del servidor.
- Repositorios, controladores y widgets tienen pruebas unitarias o de widget
  para éxito, carga, error y resultado vacío.