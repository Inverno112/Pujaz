import 'package:flutter/material.dart';

class DebugConfigPage extends StatefulWidget {
  const DebugConfigPage({
    super.key,
    required this.initialHost,
    required this.onConfigured,
  });

  final String initialHost;
  final Future<void> Function(String host) onConfigured;

  @override
  State<DebugConfigPage> createState() => _DebugConfigPageState();
}

class _DebugConfigPageState extends State<DebugConfigPage> {
  late final TextEditingController _hostController =
      TextEditingController(text: widget.initialHost);
  String? _error;
  bool _saving = false;

  @override
  void dispose() {
    _hostController.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final host = _hostController.text.trim();
    if (host.isEmpty || host.contains('/') || host.contains('://')) {
      setState(() => _error = 'Escribe solo la IP o el nombre del equipo.');
      return;
    }

    setState(() {
      _error = null;
      _saving = true;
    });
    try {
      await widget.onConfigured(host);
    } on Exception {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'No se pudo guardar la configuración.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Configuración debug',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff9a5c2f)),
          useMaterial3: true,
          inputDecorationTheme:
              const InputDecorationTheme(border: OutlineInputBorder()),
        ),
        home: Scaffold(
          appBar: AppBar(title: const Text('Configuración debug')),
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Entorno local',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Esta pantalla solo aparece en modo debug. '
                    'Indica la IP o el nombre del equipo que ejecuta Pujaz.',
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _hostController,
                    enabled: !_saving,
                    keyboardType: TextInputType.url,
                    textInputAction: TextInputAction.done,
                    decoration: InputDecoration(
                      labelText: 'IP o host local',
                      hintText: '10.0.2.2 o 192.168.1.20',
                      errorText: _error,
                    ),
                    onSubmitted: (_) => _continue(),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _saving ? null : _continue,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Guardar y continuar'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
}
