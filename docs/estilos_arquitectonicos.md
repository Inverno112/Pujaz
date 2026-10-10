# Estilos Arquitectónicos del Sistema Pujaz

El sistema Pujaz ha sido diseñado utilizando una combinación de estilos y patrones arquitectónicos modernos para garantizar escalabilidad, mantenibilidad y una excelente experiencia de usuario. A continuación, se describen y justifican los estilos aplicados.

## 1. Cliente-Servidor (Client-Server)
**Descripción:** Es un modelo de arquitectura distribuida en el que las tareas se reparten entre los proveedores de recursos o servicios (servidores) y los demandantes (clientes).
*   **Aplicación en Pujaz:** Es el estilo base de todo el ecosistema. La aplicación web (SPA) que corre en el navegador del usuario actúa como el **Cliente**, mientras que el entorno de contenedores Docker (Gateway y Microservicios) actúa como el **Servidor**.
*   **Justificación:** Permite separar completamente las responsabilidades de la interfaz de usuario (presentación) del almacenamiento y procesamiento de datos (negocio), facilitando que múltiples clientes (web, y en el futuro, móvil) consuman el mismo servidor.

## 2. SOFEA (Service-Oriented Frontend Architecture)
**Descripción:** Es un estilo donde el Frontend se desacopla totalmente del Backend. El servidor ya no renderiza vistas HTML (como en arquitecturas monolíticas tradicionales de MVC), sino que el cliente descarga la aplicación una vez y luego se comunica con el servidor únicamente para enviar y recibir datos puros (usualmente en formato JSON).
*   **Aplicación en Pujaz:** Se evidencia en el componente `frontend-spa`. Catalina construyó una Single Page Application (SPA) usando React y Vite. Esta aplicación maneja su propio enrutamiento (React Router) y estado.
*   **Justificación:** Ofrece una experiencia de usuario fluida y rápida similar a una aplicación nativa, ya que no hay recargas de página completas. Permite que el equipo de frontend trabaje de forma 100% independiente del backend.

## 3. Microservicios (Microservices)
**Descripción:** Es un enfoque para desarrollar una aplicación como un conjunto de pequeños servicios independientes, cada uno ejecutándose en su propio proceso y comunicándose a través de mecanismos ligeros (REST, gRPC, etc.).
*   **Aplicación en Pujaz:** El backend está dividido según los contextos del negocio:
    *   `ms-catalogo`: Microservicio escrito en Python/FastAPI encargado de las fichas de los artículos.
    *   `ms-transaccional`: Microservicio escrito en Go encargado de las pujas, usuarios y la billetera.
*   **Justificación:** Permite la **autonomía de los equipos** (Heider y Frank trabajan en diferentes servicios sin causar conflictos de código), facilita el uso de múltiples lenguajes de programación óptimos para cada tarea (Polyglot Programming), y permite escalar partes específicas del sistema (por ejemplo, si hay muchas búsquedas, se escala solo el catálogo).

## 4. Database per Service (Base de datos por servicio)
**Descripción:** Es un patrón derivado de los microservicios donde cada servicio gestiona su propia base de datos exclusiva. Ningún otro servicio puede acceder directamente a los datos del otro; deben hacerlo a través de sus APIs.
*   **Aplicación en Pujaz:** 
    *   `ms-catalogo` es dueño absoluto de `mongo-db` (almacena documentos NoSQL con esquemas flexibles para fotos y descripciones de arte).
    *   `ms-transaccional` es dueño absoluto de `postgres-db` (almacena relaciones estrictas, transacciones ACID para dinero y pujas).
*   **Justificación:** Evita el alto acoplamiento que generan las bases de datos compartidas. Si el equipo del catálogo decide cambiar su esquema en MongoDB, no rompe el código del equipo transaccional. Además, permite usar el motor de base de datos más adecuado (Persistencia Políglota): NoSQL para el catálogo por su flexibilidad, y SQL para el dinero por su fuerte consistencia (ACID).

## 5. API Gateway / BFF (Backend For Frontend)
**Descripción:** Un API Gateway es un servidor que actúa como único punto de entrada al sistema. El patrón BFF es una variante donde el Gateway se diseña y optimiza específicamente para las necesidades de un cliente particular (en nuestro caso, la SPA).
*   **Aplicación en Pujaz:** Se implementó en el componente `gateway-bff`, desarrollado por David usando Node.js y GraphQL. Todo el tráfico del frontend pasa por aquí antes de llegar a los microservicios.
*   **Justificación:** 
    *   **Agregación de datos:** Evita que el frontend tenga que hacer 3 peticiones distintas a los microservicios para armar la vista de un detalle de subasta. El Gateway agrupa los datos de MongoDB y PostgreSQL y se los entrega servidos a la SPA.
    *   **Seguridad centralizada:** El Gateway se encarga de verificar el JWT (JSON Web Token). Si un usuario no está autorizado, el Gateway rechaza la petición sin siquiera molestar a los microservicios.
    *   **Ocultamiento de la red interna:** Los microservicios de Go y Python no están expuestos a Internet, mejorando drásticamente la seguridad de la arquitectura.
