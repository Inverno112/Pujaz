import 'package:flutter_test/flutter_test.dart';

import '../../lib/core/errors/graphql_error_mapper.dart';

void main() {
  test('maps known auction errors to Spanish messages', () {
    expect(graphQlErrorMessage('BID_TOO_LOW'), 'Tu puja debe superar el precio actual.');
    expect(graphQlErrorMessage('INSUFFICIENT_FUNDS'), 'No tienes saldo suficiente para pujar.');
  });

  test('does not expose unknown server details', () {
    expect(
      graphQlErrorMessage('database password leaked'),
      'No se pudo completar la operación. Intenta de nuevo.',
    );
  });
}
