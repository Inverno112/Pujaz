import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../config/app_config.dart';

class TokenStorage {
  const TokenStorage(this._storage);

  static const key = 'pujaz_token';
  final FlutterSecureStorage _storage;

  Future<String?> read() => _storage.read(key: key);
  Future<void> write(String token) => _storage.write(key: key, value: token);
  Future<void> clear() => _storage.delete(key: key);
}

class GraphQLClientFactory {
  GraphQLClientFactory({
    required AppConfig config,
    required TokenStorage tokenStorage,
  })  : _config = config,
        _tokenStorage = tokenStorage;

  final AppConfig _config;
  final TokenStorage _tokenStorage;

  GraphQLClient create() {
    final httpLink = HttpLink(_config.httpUrl);
    final authLink = AuthLink(
      getToken: () async {
        final token = await _tokenStorage.read();
        return token == null ? null : 'Bearer $token';
      },
    );
    final wsLink = WebSocketLink(
      _config.wsUrl,
      config: const SocketClientConfig(
        autoReconnect: true,
        inactivityTimeout: Duration(seconds: 30),
      ),
    );
    final link = Link.split(
      (request) => request.isSubscription,
      wsLink,
      authLink.concat(httpLink),
    );
    return GraphQLClient(
      link: link,
      cache: GraphQLCache(),
    );
  }
}
