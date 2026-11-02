import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../app.dart';
import '../../../core/errors/graphql_error_mapper.dart';
import '../../../core/formatters/formatters.dart';
import '../../../core/graphql/graphql_documents.dart';
import '../../../shared/widgets/app_scaffold.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _initialized = false;
  bool _loading = false;
  String? _message;

  @override
  void dispose() {
    _name.dispose(); _email.dispose(); _password.dispose(); super.dispose();
  }

  Future<void> _save() async {
    final session = SessionScope.of(context);
    final current = session.user!;
    final input = <String, String>{};
    if (_name.text.trim() != current['name']) input['name'] = _name.text.trim();
    if (_email.text.trim() != current['email']) input['email'] = _email.text.trim();
    if (_password.text.isNotEmpty) input['password'] = _password.text;
    if (input.isEmpty) { setState(() => _message = 'No hay cambios para guardar.'); return; }
    setState(() { _loading = true; _message = null; });
    final result = await GraphQLProvider.of(context).value.mutate(mutationOptions(updateUserMutation, variables: {'input': input}));
    if (!mounted) return;
    if (!result.hasException) {
      session.updateUser(result.data!['updateUser'] as Map<String, dynamic>);
      _password.clear();
    }
    setState(() { _loading = false; _message = result.hasException ? graphQlErrorMessage(result.exception!) : 'Tus datos quedaron guardados.'; });
  }

  Future<void> _delete() async {
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: const Text('Eliminar cuenta'), content: const Text('Esta acción no se puede deshacer.'),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')), FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Eliminar'))],
    ));
    if (confirmed != true || !mounted) return;
    final result = await GraphQLProvider.of(context).value.mutate(mutationOptions(deleteUserMutation));
    if (!mounted) return;
    if (result.hasException) { setState(() => _message = graphQlErrorMessage(result.exception!)); return; }
    await SessionScope.of(context).logout();
  }

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final user = session.user!;
    if (!_initialized) {
      _name.text = user['name'] as String;
      _email.text = user['email'] as String;
      _initialized = true;
    }
    return AppScaffold(
      title: 'Mi perfil',
      actions: [IconButton(onPressed: session.logout, icon: const Icon(Icons.logout), tooltip: 'Cerrar sesión')],
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(user['name'] as String, style: Theme.of(context).textTheme.headlineSmall),
        Text('Miembro desde ${formatDate(user['createdAt'] as String)}'),
        const SizedBox(height: 24),
        TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nombre')),
        const SizedBox(height: 12),
        TextField(controller: _email, decoration: const InputDecoration(labelText: 'Correo')),
        const SizedBox(height: 12),
        TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Nueva contraseña (opcional)')),
        const SizedBox(height: 16),
        FilledButton(onPressed: _loading ? null : _save, child: Text(_loading ? 'Guardando…' : 'Guardar cambios')),
        if (_message != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_message!)),
        const SizedBox(height: 32),
        OutlinedButton(onPressed: _delete, child: const Text('Eliminar cuenta')),
      ]),
    );
  }
}
