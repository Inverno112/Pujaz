# Pujaz · Sistema de subastas

<p align="center"><img src="docs/logo.png" alt="Logo de Pujaz" width="160"></p>

Pujaz es una plataforma web para una casa de subastas. Los usuarios registrados publican piezas y pujan por ellas en tiempo real: cuando alguien hace una oferta, todos los que están viendo esa subasta ven el nuevo precio sin recargar la página. Cada usuario tiene una billetera con saldo disponible y saldo reservado; al pujar, el monto ofrecido queda reservado, y si otra persona lo supera, vuelve automáticamente al saldo disponible.

Proyecto del curso Arquitectura de Software, Universidad Nacional de Colombia, 2026-II. Equipo **1C**.

La versión entregada en la primera entrega es la etiqueta **`v1.0-entrega1`**, y su documento es [p1_1c.md](p1_1c.md) ([PDF](p1_1c.pdf)).

## Arquitectura

![Vista C&C de Pujaz](docs/vista-cc.png)

| Componente | Carpeta | Tecnología | Responsabilidad |
| --- | --- | --- | --- |
| `Pz_spa_fe` | `frontend-spa/` | TypeScript, React | Pantallas de la aplicación. Corre en el navegador; un contenedor Nginx la entrega y reenvía `/graphql` al gateway. |
| `Pz_api_ag` | `gateway-bff/` | TypeScript, Node.js, GraphQL | Único punto de entrada: valida el JWT, llama a los componentes de lógica y publica las actualizaciones de las subastas por WebSocket. |
| `Pz_transaccional_cl` | `ms-transaccional/` | Go | Usuarios, billetera, subastas y pujas, con transacciones. |
| `Pz_catalogo_cl` | `ms-catalogo/` | Python, FastAPI | Fichas de las piezas y búsqueda. |
| `Pz_transaccional_db` | migraciones en `ms-transaccional/migrations/` | PostgreSQL 15 | Datos transaccionales. |
| `Pz_catalogo_db` | semillas en `mongo-init/` | MongoDB 6 | Catálogo de piezas. |

Más detalle:

- [Vista de componentes y conectores](docs/vista-cc.md)
- [Estilos arquitectónicos](docs/estilos_arquitectonicos.md)
- [Contrato GraphQL](docs/contrato/schema.graphql) y [contrato REST](docs/contrato/rest.md)
- [Modelo de datos](docs/modelo_de_datos.md)
- [Subarquitectura del gateway](docs/subarquitectura-gateway.md)
- [Infraestructura](docs/infraestructura.md)

## Cómo ejecutarlo

Requisitos: Git y Docker con Docker Compose v2.

```bash
git clone https://github.com/heider88/Pujaz.git
cd Pujaz
git checkout v1.0-entrega1
cp .env.example .env
```

Abre `.env` y da valor a estas tres variables:

```env
POSTGRES_PASSWORD=una_contrasena_para_postgres
JWT_SECRET=un_secreto_de_al_menos_32_caracteres_para_los_tokens
CORS_ORIGIN=http://localhost:8080
```

Luego construye y levanta los seis contenedores:

```bash
docker compose up --build
```

Abre <http://localhost:8080>. Para detenerlo: `docker compose down` (agrega `-v` para borrar los datos y volver a las semillas).

En Windows, usa `Copy-Item .env.example .env` en lugar de `cp`. La guía completa está en el [instructivo de despliegue](docs/Instructivo%20para%20desplegar%20PUJAZ.md).

## Datos de prueba

Ver [credenciales de prueba](docs/credenciales_prueba.md). En resumen: usuario `ana@correo.com`, contraseña `12345678`, y código de recarga `PROMO2026`.

## Pruebas

```bash
cd frontend-spa && npm install && npm test
cd gateway-bff && npm install && npm test
```

Las pruebas de extremo a extremo (Playwright) están en `tests/e2e/` y su plan en [plan-pruebas-e2e.md](docs/plan-pruebas-e2e.md).

## Equipo

- María Catalina Rodríguez Cardona (arquilíder)
- David Alejandro Sepúlveda Amaya
- Heider Hailober Navarro Quintero
- Frank Kenner Olmos Prada
- Yeiner Arwawingumu Zapata Vallejo
- Adrián Alberto Diosa Benavides
