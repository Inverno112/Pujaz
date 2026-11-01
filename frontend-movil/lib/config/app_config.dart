class AppConfig {
  const AppConfig({
    required this.httpUrl,
    required this.wsUrl,
  });

  factory AppConfig.fromEnvironment() {
    const httpUrl = String.fromEnvironment(
      'PUJAZ_GRAPHQL_HTTP',
      defaultValue: 'http://10.0.2.2:8080/graphql',
    );
    const wsUrl = String.fromEnvironment(
      'PUJAZ_GRAPHQL_WS',
      defaultValue: 'ws://10.0.2.2:8080/graphql',
    );
    return const AppConfig(httpUrl: httpUrl, wsUrl: wsUrl);
  }

  final String httpUrl;
  final String wsUrl;
}
