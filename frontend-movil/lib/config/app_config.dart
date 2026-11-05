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
        httpUrl: 'http://$host:8080/graphql',
        wsUrl: 'ws://$host:8080/graphql',
      );

  static Future<String?> readDebugHost(FlutterSecureStorage storage) =>
      storage.read(key: debugHostKey);

  static Future<void> saveDebugHost(
    FlutterSecureStorage storage,
    String host,
  ) =>
      storage.write(key: debugHostKey, value: host);
}
