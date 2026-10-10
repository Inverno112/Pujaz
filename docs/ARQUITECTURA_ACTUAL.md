# Arquitectura Actual del Sistema Pujaz

Este documento ilustra la arquitectura general del sistema hasta el día de hoy, basándonos en los avances de todo el equipo (SPA, API Gateway, Microservicios y Bases de Datos).

> **Nota:** Puedes visualizar este diagrama gráficamente si subes este archivo a GitHub (que soporta Mermaid nativamente) o usando una extensión de previsualización de Markdown en tu editor de código (como VS Code).

```mermaid
flowchart TD
    %% Definición de Actores
    Cliente((Usuario Final))

    %% Frontend
    subgraph Capa_Presentacion ["Capa de Presentación / Frontend"]
        SPA["SPA (Esqueleto y Rutas)
        Gestión de Vistas: Listado y Detalle"]
        GQL_Client["Cliente GraphQL"]
        
        SPA <--> GQL_Client
    end

    Cliente -->|Navegador Web| SPA

    %% API Gateway / BFF
    subgraph Capa_Gateway ["Capa API Gateway / BFF"]
        Gateway["Gateway Central"]
        Auth["Módulo de Autenticación"]
        GQL_Server["Resolución Contrato GraphQL"]
        
        Gateway --- Auth
        Gateway --- GQL_Server
    end

    GQL_Client -->|Consultas/Mutaciones GraphQL| Gateway

    %% Microservicios
    subgraph Capa_Microservicios ["Capa de Microservicios"]
        
        subgraph MS_Catalogo ["MS Catálogo (Python/FastAPI)"]
            Cat_Router["API Routes (Router: /items)"]
            Cat_Service["Item Service (Lógica de Negocio)"]
            Cat_Repo["Item Repository (Acceso a Datos)"]
            
            Cat_Router --> Cat_Service
            Cat_Service --> Cat_Repo
        end

        subgraph MS_Transaccional ["MS Transaccional (Go)"]
            Tx_Router["API Routes (Ej. Pagos/Saldos)"]
            Tx_Logic["Lógica de Saldos y Cifrado"]
            
            Tx_Router --> Tx_Logic
        end
    end

    GQL_Server -->|Peticiones REST HTTP| Cat_Router
    GQL_Server -->|Peticiones REST o gRPC| Tx_Router

    %% Bases de Datos
    subgraph Capa_Datos ["Capa de Persistencia / Bases de Datos"]
        MongoDB[(MongoDB \n pujaz_catalogo)]
        PostgreSQL[(PostgreSQL \n pujaz_transaccional)]
    end

    Cat_Repo -->|PyMongo TCP 27017| MongoDB
    Tx_Logic -->|SQL / Driver TCP 5432| PostgreSQL

    %% Estilos (Opcional para que se vea más bonito)
    classDef frontend fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef gateway fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef ms fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;
    classDef db fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;

    class Capa_Presentacion frontend;
    class Capa_Gateway gateway;
    class MS_Catalogo,MS_Transaccional ms;
    class MongoDB,PostgreSQL db;
```

## Descripción de Componentes

1. **Cliente / Frontend (Trabajo de Catalina):** El usuario interactúa con la SPA. Las vistas de "Listado" y "Detalle" piden datos usando el Cliente GraphQL.
2. **API Gateway (Trabajo de David):** Actúa como el portero del sistema. Recibe la petición GraphQL, verifica la autenticación y decide a qué microservicio(s) debe consultar (REST) para armar la respuesta final.
3. **MS Catálogo (Tu trabajo actual - Python/FastAPI):** Está estructurado en 3 capas internas:
    * **Router:** Expone los endpoints REST (`GET /items`, `POST /items`).
    * **Service:** Transforma los datos.
    * **Repository:** Escribe y lee en MongoDB.
4. **MS Transaccional (Trabajo de Frank - Go):** Manejará información sensible, saldos reservados y cifrado.
5. **Bases de Datos:** Separadas por microservicio siguiendo el patrón *Database-per-service* (MongoDB para catálogo, Postgres para transacciones). Todo orquestado por `docker-compose`.
