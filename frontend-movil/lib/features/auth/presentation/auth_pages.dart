import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/errors/graphql_error_mapper.dart';
import '../../../shared/widgets/app_scaffold.dart';
import '../../../app.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.from});
  final String? from;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    final session = SessionScope.of(context);
    final ok = await session.login(_email.text, _password.text);
    if (!mounted) return;
    setState(() { _loading = false; _error = ok ? null : graphQlErrorMessage(session.error ?? ''); });
    if (ok) context.go(widget.from ?? '/');
  }

  @override
  Widget build(BuildContext context) => _AuthLayout(
        title: 'Iniciar sesión',
        child: Column(children: [
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo')),
          const SizedBox(height: 12),
          TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña')),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Entrando…' : 'Iniciar sesión'))),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          TextButton(onPressed: () => context.go('/registro'), child: const Text('¿No tienes cuenta? Crea una')),
        ]),
      );
}

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});
  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() { _loading = true; _error = null; });
    final session = SessionScope.of(context);
    final ok = await session.register(_name.text, _email.text, _password.text);
    if (!mounted) return;
    setState(() { _loading = false; _error = ok ? null : graphQlErrorMessage(session.error ?? ''); });
    if (ok) context.go('/');
  }

  @override
  Widget build(BuildContext context) => _AuthLayout(
        title: 'Crear cuenta',
        child: Column(children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nombre')),
          const SizedBox(height: 12),
          TextField(controller: _email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Correo')),
          const SizedBox(height: 12),
          TextField(controller: _password, obscureText: true, decoration: const InputDecoration(labelText: 'Contraseña (mínimo 8 caracteres)')),
          const SizedBox(height: 20),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: _loading ? null : _submit, child: Text(_loading ? 'Creando…' : 'Registrarme'))),
          if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
          TextButton(onPressed: () => context.go('/login'), child: const Text('Ya tengo una cuenta')),
        ]),
      );
}

class _AuthLayout extends StatelessWidget {
  const _AuthLayout({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => AppScaffold(
        title: title,
        body: ListView(padding: const EdgeInsets.all(24), children: [
          const Icon(Icons.gavel, size: 72),
          const SizedBox(height: 20),
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 24),
          child,
        ]),
      );
}
