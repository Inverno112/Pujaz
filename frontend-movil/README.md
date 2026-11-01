# Pujaz Mobile

Cliente Flutter para el sistema de subastas Pujaz. Usa el contrato GraphQL
compartido en [`../docs/contrato/schema.graphql`](../docs/contrato/schema.graphql).

## Requisitos

- Flutter 3.22 o superior.
- Android SDK o Xcode según la plataforma.
- Gateway de Pujaz disponible en el dispositivo o emulador.

## Ejecutar

Desde esta carpeta:

```bash
flutter pub get
flutter run \
  --dart-define=PUJAZ_GRAPHQL_HTTP=http://10.0.2.2:8080/graphql \
  --dart-define=PUJAZ_GRAPHQL_WS=ws://10.0.2.2:8080/graphql
```

`10.0.2.2` apunta al host desde el emulador Android. En un teléfono físico
debe usarse la IP local de la máquina que ejecuta Docker. Para iOS Simulator,
normalmente se puede usar `127.0.0.1`.

El token se almacena con `flutter_secure_storage`; no se guarda en preferencias
ni se imprime en logs.

## Validación

```bash
flutter analyze
flutter test
```

La app separa el transporte HTTP de queries/mutations del transporte WebSocket
de la subscription pública `auctionUpdated`. Las pantallas privadas limpian la
sesión y la caché de GraphQL cuando el token expira.
