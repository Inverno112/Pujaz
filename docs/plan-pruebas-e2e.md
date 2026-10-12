# Plan de pruebas end-to-end (E2E) — Pujaz

## 1. Objetivo

Verificar los principales recorridos de usuario de Pujaz mediante Playwright, ejecutando el sistema completo desplegado con Docker Compose.

Las pruebas se realizarán desde el navegador y validarán los resultados observables de la interfaz y, cuando corresponda, la persistencia de los datos.

## 2. Entorno de pruebas

- Aplicación: Pujaz SPA.
- Despliegue: Docker Compose.
- Automatización: Playwright Test.
- Navegador inicial: Chromium.
- URL predeterminada: `http://127.0.0.1:8080`.
- Datos: artículos de prueba y cuentas controladas.
- Estado inicial: servicios saludables y datos de prueba preparados.

## 3. Casos de prueba

### E2E-01 — Apertura de la SPA

**Objetivo:** comprobar que la aplicación se carga correctamente.

1. Abrir la URL principal.
2. Esperar a que cargue la página.
3. Comprobar el título `Pujaz, casa de subastas`.
4. Comprobar que el encabezado `Subastas` sea visible.

**Resultado esperado:** la SPA carga y muestra su contenido principal.

**Estado:** implementado como prueba inicial.

### E2E-02 — Elegir usuario

**Objetivo:** iniciar sesión con una cuenta de prueba controlada.

1. Abrir la página de inicio de sesión.
2. Introducir las credenciales de la cuenta de prueba.
3. Enviar el formulario.
4. Comprobar que la sesión se inicia.
5. Comprobar que se identifica al usuario autenticado.

**Resultado esperado:** el usuario inicia sesión y puede acceder a las funciones autorizadas.

**Precondición:** cuenta de prueba existente y credenciales disponibles.

### E2E-03 — Buscar artículos

**Objetivo:** comprobar la búsqueda del catálogo.

1. Abrir la página de subastas.
2. Introducir el nombre de un artículo conocido.
3. Enviar la búsqueda.
4. Comprobar que aparecen resultados coincidentes.
5. Buscar un término inexistente y comprobar el estado vacío.

**Resultado esperado:** los resultados corresponden a la búsqueda y se informa cuando no hay coincidencias.

### E2E-04 — Consultar el detalle de un artículo

**Objetivo:** comprobar la navegación desde el catálogo hasta el detalle.

1. Buscar o localizar un artículo de prueba.
2. Abrir su ficha.
3. Comprobar el nombre y la descripción.
4. Comprobar el precio base.
5. Comprobar la información de subasta disponible.

**Resultado esperado:** se presenta la ficha del artículo seleccionado.

### E2E-05 — Publicar un artículo

**Objetivo:** comprobar el recorrido de publicación de una pieza.

1. Iniciar sesión con un usuario autorizado para publicar.
2. Acceder al flujo de publicación.
3. Completar los campos obligatorios.
4. Enviar la publicación.
5. Comprobar la confirmación.
6. Buscar el artículo y abrir su detalle.

**Resultado esperado:** el artículo publicado queda disponible en el catálogo según las reglas de negocio.

**Dependencia:** identificar o implementar el flujo de publicación en la SPA y confirmar sus permisos y campos obligatorios.

### E2E-06 — Persistencia después de recargar

**Objetivo:** comprobar que los datos confirmados no dependen únicamente del estado visual de la SPA.

1. Abrir el detalle de un artículo publicado.
2. Recargar la página.
3. Esperar a que termine la carga.
4. Comprobar que el artículo continúa disponible.
5. Verificar que sus datos relevantes siguen siendo correctos.

**Resultado esperado:** la información persiste y puede recuperarse del sistema después de recargar.

### E2E-07 — Realizar una puja válida

**Objetivo:** comprobar el recorrido de una puja aceptada.

1. Iniciar sesión con un usuario con saldo suficiente.
2. Abrir una subasta activa.
3. Introducir una cantidad válida según las reglas de puja.
4. Enviar la puja.
5. Esperar la respuesta del sistema.
6. Comprobar que la puja se acepta y que el precio o estado se actualiza.

**Resultado esperado:** la puja queda registrada y el resultado se refleja en la interfaz.

### E2E-08 — Rechazar una puja inválida

**Objetivo:** comprobar que una puja no válida no se acepta.

1. Iniciar sesión con una cuenta de prueba.
2. Abrir una subasta activa.
3. Intentar realizar una puja que incumpla una regla de negocio, por ejemplo, una cantidad superior al saldo disponible.
4. Enviar la puja.
5. Comprobar el mensaje de rechazo.
6. Comprobar que no se muestra como aceptada ni altera indebidamente el estado de la subasta.

**Resultado esperado:** el sistema rechaza la operación y mantiene la integridad de los datos.

### E2E-09 — Consultar la puja ganadora

**Objetivo:** comprobar el resultado de una subasta finalizada.

1. Preparar una subasta de prueba con pujas conocidas.
2. Completar el proceso de cierre de la subasta.
3. Abrir el detalle o la vista del resultado.
4. Comprobar que se identifica la puja ganadora.
5. Verificar que el ganador y el importe corresponden a las reglas de negocio.

**Resultado esperado:** la interfaz muestra un resultado consistente con las pujas registradas.

**Precondición:** disponer de un mecanismo de cierre controlado para la subasta de prueba.

## 4. Estrategia de ejecución

- Cada caso debe utilizar datos de prueba conocidos.
- Los casos que modifican saldo, pujas o subastas deben evitar depender del orden accidental de ejecución.
- Los casos de persistencia deben comprobar el estado después de volver a consultar el servidor.
- Los errores de negocio deben validarse mediante mensajes visibles y ausencia de cambios indebidos.
- Los casos que requieren funcionalidades aún no disponibles deben permanecer documentados como pendientes, sin reportarlos como pruebas ejecutadas satisfactoriamente.

## 5. Criterios de aceptación

- `npx playwright test` ejecuta Playwright contra la SPA desplegada con Docker Compose.
- La prueba inicial abre la aplicación y comprueba su título y encabezado principal.
- Los casos E2E documentan los recorridos principales y sus resultados esperados.
- Las pruebas implementadas reportan claramente cuáles pasan y cuáles fallan.
