String graphQlErrorMessage(Object error) {
  final text = error.toString();
  if (text.contains('INVALID_CREDENTIALS')) return 'Correo o contraseña incorrectos.';
  if (text.contains('EMAIL_TAKEN')) return 'Ya existe otra cuenta con ese correo.';
  if (text.contains('BAD_USER_INPUT')) return 'Revisa los datos ingresados.';
  if (text.contains('BID_TOO_LOW')) return 'Tu puja debe superar el precio actual.';
  if (text.contains('AUCTION_CLOSED')) return 'Esta subasta ya está cerrada.';
  if (text.contains('INSUFFICIENT_FUNDS')) return 'No tienes saldo suficiente para pujar.';
  if (text.contains('UNAUTHENTICATED')) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  return 'No se pudo completar la operación. Intenta de nuevo.';
}
