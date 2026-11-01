import 'package:flutter/foundation.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../core/graphql/graphql_client_factory.dart';
import '../data/auth_repository.dart';

enum SessionStatus { loading, anonymous, authenticated }

class SessionController extends ChangeNotifier {
  SessionController({
    required GraphQLClient client,
    required TokenStorage tokenStorage,
  })  : _client = client,
        _tokenStorage = tokenStorage,
        _repository = AuthRepository(client);

  final GraphQLClient _client;
  final TokenStorage _tokenStorage;
  final AuthRepository _repository;
  SessionStatus status = SessionStatus.loading;
  Map<String, dynamic>? user;
  String? error;

  bool get isAuthenticated => status == SessionStatus.authenticated;

  Future<void> restore() async {
    try {
      final token = await _tokenStorage.read();
      if (token == null) {
        status = SessionStatus.anonymous;
      } else {
        user = await _repository.currentUser();
        if (user == null) {
          await _tokenStorage.clear();
          _client.cache.store.reset();
          status = SessionStatus.anonymous;
        } else {
          status = SessionStatus.authenticated;
        }
      }
    } catch (exception) {
      await _tokenStorage.clear();
      error = exception.toString();
      status = SessionStatus.anonymous;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) => _authenticate(
        () => _repository.login(email, password),
      );

  Future<bool> register(String name, String email, String password) => _authenticate(
        () => _repository.register(name, email, password),
      );

  Future<bool> _authenticate(Future<Map<String, dynamic>> Function() action) async {
    try {
      final payload = await action();
      await _tokenStorage.write(payload['token'] as String);
      user = payload['user'] as Map<String, dynamic>;
      error = null;
      status = SessionStatus.authenticated;
      notifyListeners();
      return true;
    } catch (exception) {
      error = exception.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _tokenStorage.clear();
    _client.cache.store.reset();
    user = null;
    status = SessionStatus.anonymous;
    notifyListeners();
  }

  void updateUser(Map<String, dynamic> updatedUser) {
    user = updatedUser;
    notifyListeners();
  }
}
