import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import '../../lib/core/formatters/formatters.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es_CO'));

  test('formats Colombian pesos without decimal places', () {
    expect(formatCop(125000), contains('125.000'));
  });

  test('formats ISO dates using the local date format', () {
    expect(formatDate('2026-10-31T12:30:00Z'), contains('2026'));
  });
}
