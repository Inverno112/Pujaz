import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.title,
    required this.body,
    this.actions,
  });

  final String title;
  final Widget body;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = location == '/billetera' ? 1 : location == '/perfil' ? 2 : 0;
    return Scaffold(
      appBar: AppBar(title: Text(title), actions: actions),
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) {
          if (value == 0) context.go('/');
          if (value == 1) context.go('/billetera');
          if (value == 2) context.go('/perfil');
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.gavel_outlined), label: 'Subastas'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), label: 'Billetera'),
          NavigationDestination(icon: Icon(Icons.person_outline), label: 'Perfil'),
        ],
      ),
    );
  }
}
