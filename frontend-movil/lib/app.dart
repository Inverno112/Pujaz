import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:graphql_flutter/graphql_flutter.dart';

import 'features/auth/presentation/session_controller.dart';
import 'features/auctions/presentation/auction_detail_page.dart';
import 'features/auctions/presentation/auction_list_page.dart';
import 'features/auth/presentation/auth_pages.dart';
import 'features/profile/presentation/profile_page.dart';
import 'features/wallet/presentation/wallet_page.dart';

class PujazApp extends StatefulWidget {
  const PujazApp({
    super.key,
    required this.client,
    required this.session,
  });

  final GraphQLClient client;
  final SessionController session;

  @override
  State<PujazApp> createState() => _PujazAppState();
}

class SessionScope extends InheritedNotifier<SessionController> {
  const SessionScope({super.key, required SessionController session, required super.child})
      : super(notifier: session);

  static SessionController of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;
}

class _PujazAppState extends State<PujazApp> {
  late final GoRouter _router = GoRouter(
    refreshListenable: widget.session,
    redirect: (context, state) {
      if (widget.session.status == SessionStatus.loading) return null;
      final privateRoute = state.matchedLocation == '/billetera' || state.matchedLocation == '/perfil';
      if (privateRoute && !widget.session.isAuthenticated) {
        return '/login?from=${Uri.encodeComponent(state.uri.toString())}';
      }
      if ((state.matchedLocation == '/login' || state.matchedLocation == '/registro') &&
          widget.session.isAuthenticated) {
        return '/';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (_, __) => const AuctionListPage()),
      GoRoute(path: '/items/:id', builder: (_, state) => AuctionDetailPage(itemId: state.pathParameters['id']!)),
      GoRoute(path: '/login', builder: (_, state) => LoginPage(from: state.uri.queryParameters['from'])),
      GoRoute(path: '/registro', builder: (_, __) => const RegisterPage()),
      GoRoute(path: '/billetera', builder: (_, __) => const WalletPage()),
      GoRoute(path: '/perfil', builder: (_, __) => const ProfilePage()),
    ],
  );

  @override
  Widget build(BuildContext context) => SessionScope(
        session: widget.session,
        child: GraphQLProvider(
          client: ValueNotifier(widget.client),
          child: MaterialApp.router(
            title: 'Pujaz',
            theme: ThemeData(
              colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff9a5c2f)),
              useMaterial3: true,
              inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
            ),
            routerConfig: _router,
          ),
        ),
      );
}
