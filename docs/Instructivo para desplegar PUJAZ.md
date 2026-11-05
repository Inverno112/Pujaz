# Instructivo para desplegar PUJAZ

Guía paso a paso para descargar, configurar y ejecutar el prototipo del sistema de subastas PUJAZ en un equipo local.

## 1. Requisitos previos

Antes de empezar, instale lo siguiente:

| Herramienta | Para qué se usa |
| --- | --- |
| **Git** | Clonar el repositorio |
| **Docker Engine y Docker Compose v2** | Construir y ejecutar los contenedores |
| **Terminal** | Bash en Linux o macOS; en Windows, PowerShell o Git Bash |
| **Node.js 20** | Ejecutar las pruebas automatizadas |
| **Editor de código** (recomendado) | Visual Studio Code, o alternativamente IntelliJ IDEA |

### Verificar las instalaciones

Desde la terminal, ejecute los siguientes comandos. Cada uno debe mostrar un número de versión:

```bash
git --version
docker --version
docker compose version
```

### Instalar Node.js 20

**Linux y macOS** (con nvm):

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

**Windows** (desde PowerShell):

```powershell
nvm install 20
nvm use 20
```

## 2. Descargar el repositorio

Abra una terminal y ejecute:

```bash
git clone https://github.com/heider88/Pujaz.git
cd Pujaz
git checkout v1.0-entrega1
```

## 3. Configurar las variables de entorno

**Paso 1.** Cree el archivo de configuración local a partir de la plantilla:

```bash
cp .env.example .env
```

En Windows (PowerShell): `Copy-Item .env.example .env`.

**Paso 2.** Genere dos secretos aleatorios. Ejecute el comando dos veces y guarde cada resultado por separado: uno será la contraseña de PostgreSQL y el otro, el secreto de los tokens JWT.

```bash
openssl rand -hex 32
openssl rand -hex 32
```

> En Windows, el comando `openssl` está disponible desde Git Bash.

**Paso 3.** Abra el archivo `.env` y reemplace los valores de estas variables por los secretos generados y la dirección del frontend:

```env
POSTGRES_PASSWORD="contraseña_generada_para_postgres"
JWT_SECRET="secreto_aleatorio_generado_para_jwt"
CORS_ORIGIN=http://localhost:8080
```

No comparta el archivo `.env` ni lo suba al repositorio: contiene credenciales.

## 4. Levantar el sistema

Desde la raíz del repositorio, ejecute:

```bash
docker compose up --build
```

Docker Compose construirá las imágenes necesarias, descargará las imágenes base y arrancará los servicios definidos en `docker-compose.yml`. La primera ejecución puede tardar varios minutos, según la conexión a Internet y los recursos del equipo.

### Acceder a la aplicación

Cuando los servicios estén disponibles, abra el navegador e ingrese a:

**http://localhost:8080**

## 5. Comprobar el estado de los servicios

Abra una segunda terminal (otra pestaña o ventana), ubíquese en la carpeta del repositorio y use estos comandos:

| Comando | Qué hace |
| --- | --- |
| `docker compose ps` | Muestra el estado de cada servicio |
| `docker compose logs` | Muestra los registros de todos los servicios |
| `docker compose logs -f` | Sigue los registros en tiempo real |

Para dejar de seguir los registros, presione `Ctrl+C`. Esto no detiene los contenedores si el comando se ejecutó en una terminal distinta a la que mantiene el sistema en ejecución.

## 6. Detener el sistema

1. En la terminal donde se ejecuta `docker compose up --build`, presione `Ctrl+C`.
2. Desde la raíz del repositorio, ejecute:

```bash
docker compose down
```

Este comando detiene y elimina los contenedores y la red creada por Compose. Los volúmenes de datos **no** se eliminan por defecto.

Para volver a iniciar el sistema, repita el paso 4.

## 7. Solución de problemas comunes

**Docker no está disponible.** Compruebe que Docker Engine o Docker Desktop esté iniciado y que su usuario tenga permisos para utilizarlo.

**La aplicación no carga en el puerto 8080.** Revise el estado y los registros de los servicios con `docker compose ps` y `docker compose logs`. Verifique también que el puerto 8080 no esté siendo utilizado por otro proceso.

**El sistema no inicia por variables faltantes.** Compruebe que el archivo `.env` exista en la raíz del repositorio y que `POSTGRES_PASSWORD` y `JWT_SECRET` tengan valores configurados.

**Un servicio falla durante la construcción o el arranque.** Consulte `docker compose logs` para identificar el servicio afectado y el mensaje de error correspondiente.

## 8. Resumen de comandos

**Instalación inicial**

```bash
git clone https://github.com/heider88/Pujaz.git
cd Pujaz
git checkout v1.0-entrega1
cp .env.example .env
# Configure .env antes de continuar
docker compose up --build
```

**Acceso a la aplicación**

```
http://localhost:8080
```

**Detener el despliegue**

```bash
docker compose down
```
