# Estilos arquitectónicos · Pujaz

Estilos usados en la primera entrega ([p1_1c.md](../p1_1c.md), sección 3.2). Los patrones (API Gateway, base de datos por servicio, publicar-suscribir) y las tácticas (JWT, limitar la exposición, bloqueo en la transacción) apoyan estos estilos, pero no son estilos.

Un estilo arquitectónico es una colección con nombre de decisiones de diseño que se aplican en un contexto, restringen las decisiones propias del sistema y producen cualidades beneficiosas. En Pujaz usamos tres estilos.

## Cliente-servidor

La SPA actúa como cliente: es la que inicia todas las peticiones. El gateway actúa como servidor: recibe esas peticiones y responde. La misma relación se repite hacia adentro, porque el gateway es cliente de los dos componentes de lógica, y cada uno de ellos es cliente de su propia base de datos.

Lo usamos porque separa la interfaz del procesamiento y del almacenamiento. Así cada parte puede cambiar sin afectar a las demás, y en el futuro otro cliente, como una aplicación móvil, podría usar el mismo gateway.

## Estilo híbrido: SOFEA sobre microservicios

El estilo principal de Pujaz combina SOFEA (Service-Oriented Front-End Architecture) en la presentación con microservicios en el backend.

Por el lado de SOFEA, la aplicación se descarga una sola vez desde un servidor web estático, y a partir de ahí todo el flujo de pantallas ocurre en el navegador: la SPA, hecha en React, maneja las rutas, las vistas y el estado. El servidor nunca genera HTML; solo envía y recibe datos por GraphQL.

Por el lado de los microservicios, esos datos vienen de dos servicios independientes. Cada uno corre en su propio contenedor, está escrito en un lenguaje distinto y es el único que accede a su base de datos:

- Pz_transaccional_cl (Go) con Pz_transaccional_db (PostgreSQL): usuarios, billetera, subastas y pujas.
- Pz_catalogo_cl (Python con FastAPI) con Pz_catalogo_db (MongoDB): fichas de las piezas, fotos, documentos y búsqueda.

El gateway une las dos partes: la SPA solo conoce el contrato GraphQL, y el gateway reparte cada petición entre los servicios que necesita.

Dividimos el backend así porque la billetera y las pujas tienen que cambiar juntas. Aceptar una puja implica bloquear la subasta, revisar el monto y el saldo, reservar el dinero del nuevo postor, devolver el del anterior y guardar la puja, y todo eso debe pasar en una sola transacción. El catálogo, en cambio, necesita un esquema flexible para las fichas y los documentos, y por eso usa una base NoSQL.

Escogimos esta combinación porque una subasta necesita actualizar el precio sin recargar la página, y porque deja cada parte independiente: el frontend se puede cambiar sin tocar el backend, y cada servicio se puede desplegar, probar y modificar por separado. Además, los dos servicios no se llaman entre sí, así que si uno falla el otro sigue funcionando.

## Capas

El sistema se organiza en capas lógicas, cada una con un conjunto coherente de servicios. Entre ellas hay una relación *allowed-to-use* en un solo sentido: cada capa solo puede usar la capa inmediatamente inferior, y ninguna capa inferior usa a una superior.

| Capa | Componentes |
|---|---|
| Presentación | Pz_spa_fe |
| Lógica de negocio | Pz_api_ag, Pz_transaccional_cl y Pz_catalogo_cl |
| Datos | Pz_transaccional_db y Pz_catalogo_db |

La SPA nunca llama directamente a un componente de lógica, y un componente de lógica nunca lee la base de datos del otro. Dentro de cada servicio también hay capas: en Go, `routes`, `controllers`, `services` y `repositories`; en Python, `api`, `core` e `infrastructure`.

Esta organización separa las responsabilidades, facilita modificar una capa sin afectar a las demás y hace más fácil explicar la estructura del sistema.
