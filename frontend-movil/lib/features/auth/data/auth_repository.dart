import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../core/graphql/graphql_documents.dart';

class AuthRepository {
  const AuthRepository(this._client);
  final GraphQLClient _client;

  Future<Map<String, dynamic>> login(String email, String password) async {
    final result = await _client.mutate(mutationOptions(
      loginMutation,
      variables: {'email': email.trim(), 'password': password},
    ));
    _throwIfError(result);
    return result.data!['login'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> register(
    String name,
    String email,
    String password,
  ) async {
    final result = await _client.mutate(mutationOptions(
      registerMutation,
      variables: {
        'input': {'name': name.trim(), 'email': email.trim(), 'password': password},
      },
    ));
    _throwIfError(result);
    return result.data!['register'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> currentUser() async {
    final result = await _client.query(queryOptions(meQuery));
    _throwIfError(result);
    return result.data?['me'] as Map<String, dynamic>?;
  }

  void _throwIfError(QueryResult result) {
    if (result.hasException) throw result.exception!;
  }
}
