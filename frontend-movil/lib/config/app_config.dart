import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AppConfig {
  const AppConfig({
    required this.httpUrl,
    required this.wsUrl,
  });

  factory AppConfig.fromEnvironment() {
    const httpUrl = String.fromEnvironment(
      'PUJAZ_GRAPHQL_HTTP',
      defaultValue: 'http://10.0.2.2:8080/graphql',
    );
    const wsUrl = String.fromEnvironment(
      'PUJAZ_GRAPHQL_WS',
      defaultValue: 'ws://10.0.2.2:8080/graphql',
    );
    return const AppConfig(httpUrl: httpUrl, wsUrl: wsUrl);
  }

  static const debugHostKey = 'pujaz_debug_host';

  final String httpUrl;
  final String wsUrl;

  String get host => Uri.parse(httpUrl).host;

  AppConfig withHost(String host) => AppConfig(
        httpUrl: Uri.parse(httpUrl).replace(host: host).toString(),
        wsUrl: Uri.parse(wsUrl).replace(host: host).toString(),
      );

  static bool isValidHost(String host) {
    if (host.isEmpty || host.length > 253 || host.contains(RegExp(r'\s')) || host.contains(':')) {
      return false;
    }
    if (!RegExp(r'^[A-Za-z0-9.-]+$').hasMatch(host) || host.startsWith('.') || host.endsWith('.')) {
      return false;
    }
    final octets = host.split('.');
    if (octets.length == 4 && octets.every((octet) => int.tryParse(octet) != null)) {
      return octets.every((octet) {
        final value = int.parse(octet);
        return value >= 0 && value <= 255;
      });
    }
    return true;
  }

  static Future<String?> readDebugHost(FlutterSecureStorage storage) =>
      storage.read(key: debugHostKey);

  static Future<void> saveDebugHost(
    FlutterSecureStorage storage,
    String host,
  ) =>
      storage.write(key: debugHostKey, value: host);
}
