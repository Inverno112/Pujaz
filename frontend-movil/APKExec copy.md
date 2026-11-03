 # Generar APK de Pujaz Mobile

## Requisitos

- Flutter 3.35.7 o superior.
- Dart incluido con Flutter.
- Java 17 o superior.
- Android SDK con `platform-tools`, Android Platform 34/35/36 y Build Tools.
- Android NDK `28.2.13676358`.

## 1. Configurar el entorno

Desde la raíz del repositorio:

```bash
cd /workspaces/Pujaz/frontend-movil
```

Si Flutter todavía no está disponible, instálalo desde la documentación oficial y verifica la instalación:

```bash
flutter --version
flutter doctor
```

Configura el Android SDK para la sesión actual:

```bash
export ANDROID_HOME="$HOME/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$HOME/flutter-sdk/bin:$HOME/flutter-sdk/bin/cache/dart-sdk/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Instala las herramientas necesarias:

```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" "platforms;android-36" "build-tools;35.0.0" "ndk;28.2.13676358" "cmake;3.22.1"
flutter config --android-sdk "$ANDROID_HOME"
```

Para conservar las variables al abrir una nueva terminal, añade los tres `export` anteriores a `~/.bashrc`.

## 2. Instalar dependencias

```bash
flutter pub get
```

## 3. Generar el APK

Usa la URL del gateway accesible desde el dispositivo. Para un emulador Android, `10.0.2.2` apunta al equipo anfitrión:

```bash
flutter build apk --debug \
	--dart-define=PUJAZ_GRAPHQL_HTTP=http://10.0.2.2:8080/graphql \
	--dart-define=PUJAZ_GRAPHQL_WS=ws://10.0.2.2:8080/graphql
```

En un teléfono físico, reemplaza `10.0.2.2` por la IP local del equipo que ejecuta el gateway, por ejemplo `192.168.1.20`.

El APK se genera en:

```text
build/app/outputs/flutter-apk/app-debug.apk
```

## 4. Instalar en un dispositivo conectado

Activa la depuración USB y acepta la autorización del equipo:

```bash
adb devices
flutter install
```

También puedes instalarlo directamente:

```bash
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

## 5. Validar la aplicación

```bash
flutter analyze
flutter test
```

El análisis puede informar errores del test heredado `test/widget_test.dart` si todavía referencia la clase `MyApp`; esto no impide generar el APK cuando el código de producción compila correctamente.
