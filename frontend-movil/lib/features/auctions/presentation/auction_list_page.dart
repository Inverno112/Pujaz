import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import '../../../core/formatters/formatters.dart';
import '../../../core/graphql/graphql_documents.dart';
import '../../../shared/widgets/app_scaffold.dart';

class AuctionListPage extends StatefulWidget {
  const AuctionListPage({super.key});

  @override
  State<AuctionListPage> createState() => _AuctionListPageState();
}

class _AuctionListPageState extends State<AuctionListPage> {
  final _search = TextEditingController();
  String? _submittedSearch;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AppScaffold(
        title: 'Subastas',
        body: Query(
          options: queryOptions(itemsQuery, variables: {'search': _submittedSearch}),
          builder: (result, {fetchMore, refetch}) {
            if (result.isLoading && result.data == null) {
              return const Center(child: CircularProgressIndicator());
            }
            if (result.hasException && result.data == null) {
              return _RetryView(message: 'No se pudieron cargar las subastas.', onRetry: refetch);
            }
            final items = (result.data?['items'] as List<dynamic>? ?? const []);
            return RefreshIndicator(
              onRefresh: () async => refetch?.call(),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text('Piezas abiertas a puja', style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 4),
                  Text('Encuentra una pieza y participa en tiempo real.',
                      style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 16),
                  SearchBar(
                    controller: _search,
                    hintText: 'Buscar por nombre o descripción',
                    leading: const Icon(Icons.search),
                    trailing: [
                      IconButton(
                        onPressed: () => setState(() => _submittedSearch = _search.text.trim().isEmpty ? null : _search.text.trim()),
                        icon: const Icon(Icons.arrow_forward),
                      ),
                    ],
                    onSubmitted: (value) => setState(() => _submittedSearch = value.trim().isEmpty ? null : value.trim()),
                  ),
                  const SizedBox(height: 20),
                  if (items.isEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 48),
                      child: Center(child: Text(_submittedSearch == null ? 'Todavía no hay artículos.' : 'No hay coincidencias.')),
                    ),
                  ...items.map((item) => _AuctionCard(item: item as Map<String, dynamic>)),
                ],
              ),
            );
          },
        ),
      );
}

class _AuctionCard extends StatelessWidget {
  const _AuctionCard({required this.item});
  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final auction = item['auction'] as Map<String, dynamic>?;
    final images = item['images'] as List<dynamic>? ?? const [];
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => context.push('/items/${item['id']}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (images.isNotEmpty)
              Image.network(images.first as String, height: 170, width: double.infinity, fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox(height: 170, child: Icon(Icons.image_not_supported_outlined, size: 48))),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (item['category'] != null) Text(item['category'] as String, style: Theme.of(context).textTheme.labelMedium),
                const SizedBox(height: 4),
                Text(item['name'] as String, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(auction == null ? 'Precio base' : 'Precio actual'),
                Text(formatCop((auction?['currentPrice'] ?? item['basePrice']) as num),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Text(auction == null ? 'Aún sin subasta' : 'Subasta ${auction['status'] == 'OPEN' ? 'abierta' : 'cerrada'}'),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _RetryView extends StatelessWidget {
  const _RetryView({required this.message, required this.onRetry});
  final String message;
  final Future<QueryResult<Object?>?> Function()? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(message),
          const SizedBox(height: 12),
          FilledButton(onPressed: onRetry == null ? null : () => onRetry!(), child: const Text('Reintentar')),
        ]),
      );
}
