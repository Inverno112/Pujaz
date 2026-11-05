# Modelo de Datos y Arquitectura de Persistencia - Pujaz

**Pujaz** es una plataforma de subastas en tiempo real diseñada bajo una arquitectura SOFEA (Service-Oriented Front-End Architecture). Para garantizar un rendimiento óptimo y una consistencia estricta, el sistema implementa un patrón de Persistencia Políglota (Database per Service), dividiendo la responsabilidad de los datos en dos motores especializados:

1. **PostgreSQL (Microservicio Transaccional):** Motor relacional (SQL) que garantiza consistencia ACID. Gestiona el núcleo crítico del negocio: usuarios, billeteras virtuales, reservas atómicas de saldo, historial inmutable de movimientos y las pujas.
2. **MongoDB (Microservicio de Catálogo):** Motor NoSQL que ofrece flexibilidad de esquema. Ideal para gestionar el catálogo de piezas y artículos, donde cada objeto (arte, vehículos, joyas) posee atributos y características técnicas muy diferentes.

---

## Diagrama Entidad-Relación (ER)

El siguiente diagrama ilustra la estructura relacional dentro de PostgreSQL y su referencia cruzada (identificador externo) hacia la colección de documentos en MongoDB.

```mermaid
erDiagram
    %% ==========================================
    %% ECOSISTEMA POSTGRESQL (MS-TRANSACCIONAL)
    %% Garantiza consistencia ACID y dinero
    %% ==========================================

    USERS {
        uuid id PK "Identificador único"
        varchar name "Nombre completo"
        varchar email "Correo electrónico (Único)"
        varchar password "Hash BCrypt"
        varchar role "Ej: PARTICIPANTE, ADMIN"
        varchar status "Estado de la cuenta"
        timestamp created_at "Fecha de registro"
    }
    
    WALLETS {
        uuid id PK
        uuid user_id FK "Relación 1:1 con Users"
        numeric available "Saldo libre para pujar"
        numeric reserved "Saldo apartado en pujas activas"
    }
    
    WALLET_MOVEMENTS {
        uuid id PK
        uuid wallet_id FK "Dueño de la billetera"
        varchar type "DEPOSIT, RESERVE, REFUND"
        numeric amount "Monto transado"
        uuid auction_id FK "Trazabilidad de la subasta (Nullable)"
        timestamp created_at "Fecha exacta del movimiento"
    }
    
    AUCTIONS {
        uuid id PK
        varchar item_id "Referencia externa a MongoDB"
        numeric base_price "Precio inicial"
        numeric current_price "Precio de la puja más alta"
        uuid winning_bid_id FK "Puja ganadora actual (Nullable)"
        timestamp ends_at "Fecha de cierre automático"
        varchar status "ABIERTA, CERRADA, CANCELADA"
    }
    
    BIDS {
        uuid id PK
        uuid auction_id FK "Subasta a la que pertenece"
        uuid user_id FK "Postor (Bidder)"
        numeric amount "Valor ofertado"
        timestamp created_at "Orden cronológico estricto"
    }

    %% Relaciones en PostgreSQL
    USERS ||--|| WALLETS : "posee (1:1)"
    USERS ||--o{ BIDS : "realiza (1:N)"
    WALLETS ||--o{ WALLET_MOVEMENTS : "registra historial (1:N)"
    
    AUCTIONS ||--o{ BIDS : "recibe múltiples (1:N)"
    AUCTIONS ||--o| BIDS : "tiene una ganadora (1:1)"
    AUCTIONS ||--o{ WALLET_MOVEMENTS : "justifica reserva/reintegro (1:N)"

    %% ==========================================
    %% ECOSISTEMA MONGODB (MS-CATALOGO)
    %% Flexibilidad NoSQL para el Catálogo
    %% ==========================================
    
    ITEMS_MONGODB {
        ObjectId _id PK "Coincide con AUCTIONS.item_id"
        string name "Nombre de la pieza"
        string description "Detalles flexibles"
        array images "URLs de fotos"
        object attributes "Año, autor, material, etc."
    }

    %% Frontera de Microservicios (Referencia Externa)
    AUCTIONS }|..|| ITEMS_MONGODB : "Referencia cruzada por item_id (No es FK SQL)"
```