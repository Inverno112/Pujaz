import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pujaz_mobile/features/debug/presentation/debug_config_page.dart';

void main() {
  testWidgets('configura el host local y continúa', (tester) async {
    String? configuredHost;

    await tester.pumpWidget(
      DebugConfigPage(
        initialHost: '10.0.2.2',
        onConfigured: (host) async => configuredHost = host,
      ),
    );

    expect(find.text('Configuración debug'), findsOneWidget);
    expect(find.text('10.0.2.2'), findsOneWidget);

    await tester.tap(find.text('Guardar y continuar'));
    await tester.pump();

    expect(configuredHost, '10.0.2.2');
  });

  testWidgets('rechaza una URL completa como host', (tester) async {
    await tester.pumpWidget(
      DebugConfigPage(
        initialHost: '10.0.2.2',
        onConfigured: (_) async {},
      ),
    );

    await tester.enterText(
      find.byType(TextField),
      'http://192.168.1.20',
    );
    await tester.tap(find.text('Guardar y continuar'));
    await tester.pump();

    expect(
      find.text('Escribe solo la IP o el nombre del equipo.'),
      findsOneWidget,
    );
  });

  testWidgets('rechaza una dirección IPv4 inválida', (tester) async {
    await tester.pumpWidget(
      DebugConfigPage(
        initialHost: '10.0.2.2',
        onConfigured: (_) async {},
      ),
    );

    await tester.enterText(find.byType(TextField), '192.168.1.999');
    await tester.tap(find.text('Guardar y continuar'));
    await tester.pump();

    expect(find.text('Escribe solo la IP o el nombre del equipo.'), findsOneWidget);
  });
}
