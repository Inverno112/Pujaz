# Generar APK

## 1. Preparar Flutter

```bash
cd /workspaces/Pujaz/frontend-movil
flutter create --platforms=android,ios .
flutter pub get
flutter analyze
flutter test
```

## 2. Instalar Android SDK

```bash
sudo apt update
sudo apt install openjdk-17-jdk wget unzip -y

mkdir -p "$HOME/android-sdk/cmdline-tools"
cd "$HOME/android-sdk/cmdline-tools"
wget https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
unzip -o commandlinetools-linux-15859902_latest.zip
rm commandlinetools-linux-15859902_latest.zip
mv cmdline-tools latest
```

```bash
export ANDROID_HOME="$HOME/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "build-tools;35.0.0" "build-tools;28.0.3"
flutter config --android-sdk "$ANDROID_HOME"
flutter doctor
```

Para conservar la configuración:

```bash
cat >> ~/.bashrc <<'EOF'
export ANDROID_HOME="$HOME/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
EOF
source ~/.bashrc
```

## 3. Conectar el móvil

Activa **Depuración USB**, conecta el teléfono y acepta la autorización.

```bash
adb devices
flutter devices
```

## 4. Ejecutar en el móvil

En modo debug, la aplicación muestra una pantalla para introducir solo el host
del equipo que ejecuta Docker. Usa `10.0.2.2` en el emulador Android o la IP
LAN del computador en un teléfono físico. No escribas `http://`, `ws://`, el
puerto ni `/graphql`.

```bash
flutter run
```

El host se guarda de forma segura y los siguientes arranques debug entran
directamente a la aplicación usando ese valor. Para cambiarlo, borra los datos
de la app o ejecuta:

```bash
adb shell pm clear com.example.pujaz_mobile
```

Si usas un puerto distinto de `8080`, conserva el puerto mediante las URLs de
entorno; la pantalla debug cambia únicamente el host:

```bash
flutter run \
  --dart-define=PUJAZ_GRAPHQL_HTTP=http://IP_DEL_PC:9090/graphql \
  --dart-define=PUJAZ_GRAPHQL_WS=ws://IP_DEL_PC:9090/graphql
```

## 5. Generar e instalar APK

Ejecuta estos comandos desde la carpeta del frontend móvil. En este Codespace
`flutter` puede no estar en el `PATH`, por eso se usa la ruta completa del SDK.
Si tu terminal ya reconoce `flutter`, puedes sustituir
`/home/codespace/flutter-sdk/bin/flutter` por `flutter`.

```bash
cd /workspaces/Pujaz/frontend-movil
/home/codespace/flutter-sdk/bin/flutter build apk --debug
```

No copies literalmente `IP_DEL_PC` en este comando. Como la aplicación debug
permite configurar el host al abrirse, el APK se genera sin añadir las URLs
GraphQL. En el teléfono, introduce la IP LAN del equipo que ejecuta Docker;
en el emulador Android usa `10.0.2.2`.

El APK se genera en:

```text
/workspaces/Pujaz/frontend-movil/build/app/outputs/flutter-apk/app-debug.apk
```

Para instalarlo en un celular conectado por USB, activa **Depuración USB**,
acepta la autorización y verifica que aparezca:

```bash
adb devices
```

Después instala el APK con:

```bash
/home/codespace/flutter-sdk/bin/flutter install
```

También puedes instalar el archivo directamente:

```text
adb install -r /workspaces/Pujaz/frontend-movil/build/app/outputs/flutter-apk/app-debug.apk
```

## 6. Usar este Codespace desde VS Code local

Instala la extensión **GitHub Codespaces** en tu VS Code local y ejecuta:

```text
Ctrl+Shift+P → Codespaces: Connect to Codespace
```

Selecciona esta sesión para trabajar desde tu computadora mientras el código y
las herramientas continúan ejecutándose en el Codespace.

Para usar el proyecto completamente en local, clona el repositorio:

```bash
git clone https://github.com/Inverno112/Pujaz.git
cd Pujaz
code .
```

### Flujo y alcance de la configuración debug

Al iniciar la aplicación móvil en modo debug sin un host guardado, aparece una
vista para introducir la IP o el host local del endpoint GraphQL de Pujaz. Al
seleccionar **Guardar y continuar**, la aplicación:

1. Guarda la IP en `flutter_secure_storage`.
2. Construye las URLs HTTP y WebSocket de GraphQL usando esa IP.
3. Inicializa el cliente GraphQL y restaura la sesión.
4. Abre la aplicación móvil normalmente.

En los siguientes arranques se reutiliza automáticamente el host guardado. Para
mostrar de nuevo la vista, borra los datos de la app. Esta vista solo existe en
modo debug; las compilaciones de producción siguen usando las URLs definidas
con `--dart-define`.

Este flujo está aislado dentro de `frontend-movil` y solo afecta la
configuración de conexión de la aplicación móvil. No modifica el backend, la
SPA, Docker ni otros módulos del proyecto.
