import 'package:intl/intl.dart';

final _currency = NumberFormat.currency(locale: 'es_CO', symbol: r'$ ', decimalDigits: 0);
final _date = DateFormat('d MMM yyyy, HH:mm', 'es_CO');

String formatCop(num value) => _currency.format(value);
String formatDate(String value) {
  final date = DateTime.tryParse(value);
  return date == null ? value : _date.format(date.toLocal());
}
