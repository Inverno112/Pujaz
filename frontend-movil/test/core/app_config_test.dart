import 'package:flutter_test/flutter_test.dart';
import 'package:pujaz_mobile/config/app_config.dart';

void main() {
  test('cambia solo el host y conserva puerto y ruta', () {
    const config = AppConfig(
      httpUrl: 'http://localhost:9090/api/graphql',
      wsUrl: 'ws://localhost:9090/api/graphql',
    );

    final updated = config.withHost('192.168.1.20');

    expect(updated.httpUrl, 'http://192.168.1.20:9090/api/graphql');
    expect(updated.wsUrl, 'ws://192.168.1.20:9090/api/graphql');
  });

  test('acepta IPs y nombres de host válidos', () {
    expect(AppConfig.isValidHost('10.0.2.2'), isTrue);
    expect(AppConfig.isValidHost('pujaz.local'), isTrue);
    expect(AppConfig.isValidHost('192.168.1.999'), isFalse);
    expect(AppConfig.isValidHost('http://192.168.1.20'), isFalse);
    expect(AppConfig.isValidHost('host con espacios'), isFalse);
  });
}
