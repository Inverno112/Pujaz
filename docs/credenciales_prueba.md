# Credenciales y datos de prueba

Estos datos se cargan solos la primera vez que se levanta el sistema (migraciones de PostgreSQL y `mongo-init/init.js`). Para volver a ellos: `docker compose down -v` y `docker compose up --build`.

## Usuarios

| Usuario | Correo | Contraseña | Saldo inicial |
| --- | --- | --- | --- |
| Ana | `ana@correo.com` | `12345678` | 50.000 COP disponibles |
| Heider | `heider@correo.com` | `12345678` | 50.000 COP disponibles |
| Cata | `cata@correo.com` | `12345678` | 50.000 COP disponibles |

Para registrar un usuario nuevo, la contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número (por ejemplo, `Subasta2026`). Esa regla aplica al registrarse y al cambiar la contraseña, no al iniciar sesión.

## Billetera

- Código promocional para recargar: **`PROMO2026`**.
- Las piezas de las semillas empiezan entre 50.000 y 1.000.000 COP, y una puja debe superar el precio actual en al menos 100 COP. Con el saldo inicial no alcanza para pujar: **recarga primero** (por ejemplo, 500.000).

## Catálogo

Diez piezas de ejemplo, cada una con su subasta abierta. Las subastas cierran tres días después de creada la base de datos.

| Pieza | Precio inicial (COP) |
| --- | --- |
| Moneda Romana | 50.000 |
| Edición Primera Don Quijote | 60.000 |
| Reloj Vintage | 100.000 |
| Collar de Perlas | 120.000 |
| Pintura Abstracta | 250.000 |
| Cámara Leica | 300.000 |
| Escultura de Bronce | 450.000 |
| Ford Mustang 1969 | 800.000 |
| Anillo de Diamante | 900.000 |
| Porsche 911 Clásico | 1.000.000 |
