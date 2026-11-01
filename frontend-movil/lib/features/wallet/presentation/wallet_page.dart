import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../core/errors/graphql_error_mapper.dart';
import '../../../core/formatters/formatters.dart';
import '../../../core/graphql/graphql_documents.dart';
import '../../../shared/widgets/app_scaffold.dart';

class WalletPage extends StatefulWidget {
  const WalletPage({super.key});
  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  final _amount = TextEditingController();
  final _promo = TextEditingController();
  String? _message;
  bool _loading = false;

  @override
  void dispose() {
    _amount.dispose();
    _promo.dispose();
    super.dispose();
  }

  Future<void> _deposit() async {
    final amount = double.tryParse(_amount.text.replaceAll(',', '.'));
    if (amount == null || amount <= 0 || _promo.text.trim().isEmpty) {
      setState(() => _message = 'El monto y el código promocional son obligatorios.');
      return;
    }
    setState(() { _loading = true; _message = null; });
    final result = await GraphQLProvider.of(context).value.mutate(mutationOptions(
      depositMutation,
      variables: {'amount': amount, 'promoCode': _promo.text.trim()},
    ));
    if (!mounted) return;
    setState(() { _loading = false; _message = result.hasException ? graphQlErrorMessage(result.exception!) : 'Recarga realizada.'; });
    if (!result.hasException) { _amount.clear(); _promo.clear(); }
  }

  @override
  Widget build(BuildContext context) => AppScaffold(
        title: 'Mi billetera',
        body: Query(
          options: queryOptions(walletQuery),
          builder: (result, {refetch, fetchMore}) {
            if (result.isLoading && result.data == null) return const Center(child: CircularProgressIndicator());
            if (result.hasException) return Center(child: Text(graphQlErrorMessage(result.exception!)));
            final wallet = result.data!['wallet'] as Map<String, dynamic>;
            final movements = wallet['movements'] as List<dynamic>? ?? const [];
            return RefreshIndicator(
              onRefresh: () async => refetch?.call(),
              child: ListView(padding: const EdgeInsets.all(16), children: [
                Row(children: [
                  Expanded(child: _Balance(label: 'Disponible', amount: wallet['available'] as num)),
                  const SizedBox(width: 12),
                  Expanded(child: _Balance(label: 'Reservado', amount: wallet['reserved'] as num)),
                ]),
                const SizedBox(height: 24),
                Text('Recargar', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 12),
                TextField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Monto (COP)')),
                const SizedBox(height: 12),
                TextField(controller: _promo, decoration: const InputDecoration(labelText: 'Código promocional')),
                const SizedBox(height: 12),
                FilledButton(onPressed: _loading ? null : _deposit, child: Text(_loading ? 'Recargando…' : 'Recargar')),
                if (_message != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_message!)),
                const SizedBox(height: 24),
                Text('Movimientos', style: Theme.of(context).textTheme.titleLarge),
                if (movements.isEmpty) const Padding(padding: EdgeInsets.only(top: 16), child: Text('Todavía no tienes movimientos.')),
                ...movements.map((raw) {
                  final movement = raw as Map<String, dynamic>;
                  final positive = movement['type'] != 'RESERVE';
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(positive ? Icons.add_circle_outline : Icons.remove_circle_outline),
                    title: Text(movement['type'] as String),
                    subtitle: Text(formatDate(movement['createdAt'] as String)),
                    trailing: Text('${positive ? '+' : '-'}${formatCop(movement['amount'] as num)}'),
                  );
                }),
              ]),
            );
          },
        ),
      );
}

class _Balance extends StatelessWidget {
  const _Balance({required this.label, required this.amount});
  final String label;
  final num amount;
  @override
  Widget build(BuildContext context) => Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text(label), const SizedBox(height: 4), Text(formatCop(amount), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
  ])));
}
