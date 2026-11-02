import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:graphql_flutter/graphql_flutter.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'config/app_config.dart';
import 'core/graphql/graphql_client_factory.dart';
import 'features/auth/presentation/session_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('es_CO');
  await initHiveForFlutter();
  const secureStorage = FlutterSecureStorage();
  final tokenStorage = TokenStorage(secureStorage);
  final client = GraphQLClientFactory(
    config: AppConfig.fromEnvironment(),
    tokenStorage: tokenStorage,
  ).create();
  final session = SessionController(client: client, tokenStorage: tokenStorage);
  await session.restore();
  runApp(PujazApp(client: client, session: session));
}
