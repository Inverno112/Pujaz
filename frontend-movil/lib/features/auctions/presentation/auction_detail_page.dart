import 'package:flutter/material.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../core/errors/graphql_error_mapper.dart';
import '../../../core/formatters/formatters.dart';
import '../../../core/graphql/graphql_documents.dart';
import '../../../shared/widgets/app_scaffold.dart';

class AuctionDetailPage extends StatelessWidget {
  const AuctionDetailPage({super.key, required this.itemId});
  final String itemId;

  @override
  Widget build(BuildContext context) => Query(
        options: queryOptions(itemQuery, variables: {'id': itemId}),
        builder: (result, {refetch, fetchMore}) {
          if (result.isLoading && result.data == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
          if (result.hasException && result.data == null) {
            return Scaffold(body: Center(child: Text(graphQlErrorMessage(result.exception!))));
          }
          final item = result.data?['item'] as Map<String, dynamic>?;
          if (item == null) return const Scaffold(body: Center(child: Text('Artículo no encontrado.')));
          final images = item['images'] as List<dynamic>? ?? const [];
          final auction = item['auction'] as Map<String, dynamic>?;
          return AppScaffold(
            title: item['name'] as String,
            body: CustomScrollView(slivers: [
              SliverToBoxAdapter(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (images.isNotEmpty)
                    SizedBox(height: 240, child: PageView.builder(
                      itemCount: images.length,
                      itemBuilder: (_, index) => Image.network(images[index] as String, fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(Icons.image_not_supported_outlined, size: 56)),
                    )),
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      if (item['category'] != null) Text(item['category'] as String, style: Theme.of(context).textTheme.labelMedium),
                      Text(item['name'] as String, style: Theme.of(context).textTheme.headlineSmall),
                      if (item['description'] != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(item['description'] as String)),
                      const SizedBox(height: 16),
                      Text('Precio base: ${formatCop(item['basePrice'] as num)}'),
                      if ((item['documents'] as List<dynamic>? ?? const []).isNotEmpty) ...[
                        const SizedBox(height: 20),
                        Text('Documentos', style: Theme.of(context).textTheme.titleMedium),
                        ...((item['documents'] as List<dynamic>).asMap().entries.map((entry) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.description_outlined),
                          title: Text('Documento ${entry.key + 1}'),
                          onTap: () {},
                        ))),
                      ],
                    ]),
                  ),
                  if (auction != null) _AuctionPanel(auction: auction),
                ]),
              ),
            ]),
          );
        },
      );
}

class _AuctionPanel extends StatefulWidget {
  const _AuctionPanel({required this.auction});
  final Map<String, dynamic> auction;

  @override
  State<_AuctionPanel> createState() => _AuctionPanelState();
}

class _AuctionPanelState extends State<_AuctionPanel> {
  final _amount = TextEditingController();
  String? _message;
  bool _sending = false;
  Map<String, dynamic>? _liveAuction;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  Future<void> _bid() async {
    final amount = double.tryParse(_amount.text.replaceAll(',', '.'));
    if (amount == null || amount <= 0) {
      setState(() => _message = 'Ingresa un monto válido.');
      return;
    }
    setState(() { _sending = true; _message = null; });
    final result = await GraphQLProvider.of(context).value.mutate(mutationOptions(
      placeBidMutation,
      variables: {'auctionId': widget.auction['id'], 'amount': amount},
    ));
    if (!mounted) return;
    setState(() { _sending = false; _message = result.hasException ? graphQlErrorMessage(result.exception!) : 'Puja aceptada.'; });
    if (!result.hasException) _amount.clear();
  }

  @override
  Widget build(BuildContext context) {
    return Subscription(
      options: SubscriptionOptions(
        document: gql(auctionUpdatedSubscription),
        variables: {'auctionId': widget.auction['id']},
      ),
      builder: (result) {
        final auction = (result.data?['auctionUpdated'] as Map<String, dynamic>?) ?? _liveAuction ?? widget.auction;
        if (result.data?['auctionUpdated'] != null && _liveAuction != result.data!['auctionUpdated']) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) setState(() => _liveAuction = result.data!['auctionUpdated'] as Map<String, dynamic>);
          });
        }
        return _buildPanel(context, auction);
      },
    );
  }

  Widget _buildPanel(BuildContext context, Map<String, dynamic> auction) {
    final isOpen = auction['status'] == 'OPEN';
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
      child: Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Subasta', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text('Precio actual', style: Theme.of(context).textTheme.labelLarge),
        Text(formatCop(auction['currentPrice'] as num), style: Theme.of(context).textTheme.headlineSmall),
        if (auction['endsAt'] != null) Text('Termina: ${formatDate(auction['endsAt'] as String)}'),
        const SizedBox(height: 16),
        if (isOpen) ...[
          TextField(controller: _amount, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Tu puja (COP)')),
          const SizedBox(height: 12),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: _sending ? null : _bid, child: Text(_sending ? 'Enviando…' : 'Pujar'))),
        ] else const Text('Esta subasta está cerrada.'),
        if (_message != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_message!)),
      ]))),
    );
  }
}
