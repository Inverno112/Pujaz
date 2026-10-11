# Infraestructura del prototipo: KAN-7, KAN-36 y KAN-49

## Arranque

Requiere Docker Desktop con motor Linux y Docker Compose con soporte de
`build.additional_contexts` (Compose 2.17 o posterior).
Desde la raíz, suministrar JWT_SECRET (aleatorio, mínimo 32 caracteres) y
POSTGRES_PASSWORD mediante el entorno del proceso. No versionar sus valores.
No pasar secretos como argumentos de build ni variables VITE_*.
La configuración falla si cualquiera de esos dos valores está ausente o vacío;
el Gateway valida además la longitud de JWT_SECRET al arrancar.

Ejemplo PowerShell para un laboratorio NUEVO (guardar los secretos en un gestor
si se desea reutilizar el volumen; no regenerar la contraseña en cada arranque):

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)
$rng.GetBytes($bytes)
$env:POSTGRES_PASSWORD = [Convert]::ToBase64String($bytes)
$rng.Dispose()
$env:NGINX_PORT = '8080'
$env:CORS_ORIGIN = 'http://localhost:8080'
docker compose config --quiet
docker compose up -d --build --wait
docker compose ps
```

Abrir http://localhost:8080. Si cambia NGINX_PORT o se usa otro dominio,
actualizar CORS_ORIGIN al origen exacto del navegador (esquema, host y puerto).
No usar `docker compose config` sin `--quiet` en registros compartidos: puede
mostrar secretos interpolados. `docker compose stop` detiene sin borrar datos.
No usar `docker compose down -v`.

## Topología y variables

- `frontend-spa`: build reproducible con Node 22 y npm ci; imagen final Nginx,
  sin Node ni fuentes de la SPA. Monta la plantilla Nginx de este repositorio.
  Único puerto publicado: NGINX_PORT (8080 por defecto).
- Red `public`: acceso a Nginx. Red `backend` interna: Nginx, Gateway y catálogo.
  Red `data` interna: catálogo, PostgreSQL y MongoDB. Ninguna base publica puertos.
- `gateway-bff`: contexto adicional `contrato=./docs/contrato`; NODE_ENV=production,
  PORT (4000 por defecto), CORS_ORIGIN, JWT_SECRET y JWT_EXPIRES_IN (24h).
  USE_MOCKS=true fijo hasta que el equipo implemente clientes HTTP.
  JWT_SECRET se entrega únicamente a este servicio. Nginx recibe solo GATEWAY_PORT
  derivado de PORT; no recibe secretos ni el archivo de entorno completo.
- PostgreSQL 15: POSTGRES_USER (pujaz_user), POSTGRES_DB (pujaz_transaccional),
  POSTGRES_PASSWORD obligatorio y volumen `postgres_data`.
- MongoDB 6: volumen `mongo_data`, sin autenticación en este prototipo local y sin
  puerto publicado. El catálogo recibe MONGO_URI (mongodb://mongo-db:27017).
- Healthchecks reales: HTTP local para Nginx/catálogo, consulta GraphQL para Gateway,
  pg_isready para PostgreSQL y ping con mongosh para MongoDB.

KAN-37 sigue siendo una entrega independiente. No se incluye ni recrea su plantilla
raíz. Los nombres usados son compatibles con su propuesta; después de su integración,
completar sus secretos y cambiar CORS_ORIGIN de 5173 al origen público de Nginx.
En Compose, PORT determina el puerto interno del Gateway. API_GATEWAY_PORT, SPA_PORT,
GRAPHQL_URL, WS_URL y DB_* no son consumidos por esta infraestructura; no sustituyen
PORT, las variables POSTGRES_* ni las rutas relativas del navegador.

## HTTP, CORS y WebSocket

La SPA conserva `/graphql` relativo al origen actual. Nginx reenvía método, cuerpo,
query string y Authorization a gateway-bff, y prepara Upgrade/Connection para
WebSocket. El Gateway gestiona CORS; Nginx no agrega cabeceras CORS duplicadas.
El proxy Vite a localhost:4000 se conserva exclusivamente para desarrollo fuera
de Compose. En ese modo el Gateway debe permitir http://localhost:5173.

El fallback permite abrir directamente `/items/a101`, `/login` y otras rutas SPA.
`/healthz` verifica Nginx. El proxy de `/graphql` no cae en el fallback de la SPA.

## Datos existentes e inicialización

Se conservan los nombres de volúmenes y el nombre de proyecto Compose por defecto;
no cambiar el nombre de proyecto si se pretende reutilizar los datos existentes.
PostgreSQL no aplica todavía las migraciones de ms-transaccional automáticamente.
POSTGRES_PASSWORD inicializa una base nueva; cambiar la variable no cambia la
contraseña de un volumen ya inicializado.

`mongo-init/init.js` crea un índice e inserta diez documentos con IDs fijos; no contiene
borrados. Se monta en `/docker-entrypoint-initdb.d/init.js` de solo lectura: la imagen
oficial lo ejecuta al inicializar un directorio de datos vacío. No se ejecuta al
reiniciar o recrear un contenedor con datos existentes. No ejecutarlo manualmente
sobre una base inicializada: los IDs fijos pueden provocar duplicados.

## Limitaciones del equipo

- El Gateway usa datos simulados en memoria y no tiene clientes HTTP hacia los MS.
- ms-transaccional tiene migraciones y pruebas, pero no servidor ejecutable ni
  Dockerfile funcional: no se agrega un contenedor ficticio.
- El Gateway no implementa servidor WebSocket ni resolvers de suscripción.
  Nginx queda preparado, pero no hay flujo de subastas en tiempo real verificable.
- El catálogo retorna datos fijos y aún no utiliza MONGO_URI para conectarse a MongoDB.
- El workflow CI preexistente no se modifica en esta entrega.
- El acceso HTTP es para laboratorio; un despliegue público requiere TLS.

## Comprobaciones de aceptación

1. `docker compose config --quiet`, build, `up -d --wait` y `ps`.
2. `docker compose exec -T frontend-spa nginx -t`.
3. GET `/` y ruta SPA directa: ambos devuelven el HTML compilado.
4. POST `/graphql` con `{ __typename }`: Query; GET con query string equivalente.
5. OPTIONS con Origin y Access-Control-Request-Headers: authorization,content-type:
   comprobar origen permitido y cabeceras; comprobar también un origen distinto.
6. Login con usuario de prueba del Gateway; consultar `me` con Bearer y sin él.
   El primer caso autentica y el segundo devuelve UNAUTHENTICATED.
7. Intentar Upgrade WebSocket en `/graphql`: registrar la ausencia esperada de 101
   hasta que el Gateway implemente graphql-ws; no declarar tiempo real operativo.
8. En un proyecto de validación aislado, escribir un marcador en cada DB, recrear
   los contenedores SIN borrar volúmenes y comprobar los mismos marcadores.

## Resultados de validación de esta entrega

- `docker compose config --quiet`: correcto; Compose 5.5.1.
- Modelo Compose inspeccionado: único servicio con puerto publicado frontend-spa;
  única inyección de JWT_SECRET en gateway-bff. Secretos vacíos rechazados.
- Build de frontend-spa, gateway-bff y ms-catalogo: correcto, incluidos npm ci,
  compilación TypeScript y build de Vite. Primer intento falló transitoriamente
  durante el arranque de Docker Desktop; la repetición terminó correctamente.
- `nginx -t`: correcto tanto en contenedor temporal como en el servicio arrancado.
- Proyecto aislado `pujaz-infra-validation`, puerto 18080: SPA y Gateway healthy.
- GET `/` y `/items/a101`: HTTP 200 y mismo HTML compilado con rutas /assets/.
- POST `/graphql` y GET con query string: `data.__typename = Query`.
- OPTIONS: HTTP 204, origen permitido exacto y Authorization permitido.
  Un origen diferente no recibe autorización CORS para su propio origen.
- Login mock y consulta `me`: id 7 con JWT; UNAUTHENTICATED sin JWT.
- Gateway rechaza JWT_SECRET de menos de 32 caracteres con salida 1.
- Contenedor Nginx: sin JWT_SECRET; imagen frontend sin fuentes ni archivo .env.
- Handshake WebSocket: HTTP 200 en vez de 101. Limitación esperada del Gateway,
  no se declara funcionamiento de suscripciones.
- Arranque completo: los cinco servicios quedaron healthy en `docker compose ps`.
- Persistencia: marcador SQL 49 y documento MongoDB 49 conservados después de
  recrear ambos contenedores; los diez documentos semilla de MongoDB permanecieron.
- Al finalizar se retiraron contenedores y redes del proyecto de validación mediante
  `docker compose down` sin `-v`. Se conservaron los volúmenes de prueba
  `pujaz-infra-validation_postgres_data` y `pujaz-infra-validation_mongo_data`.
  No se usaron ni alteraron volúmenes del proyecto normal Pujaz.
