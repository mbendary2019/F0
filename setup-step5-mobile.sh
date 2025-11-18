#!/usr/bin/env bash
set -euo pipefail
cd /Users/abdo/Downloads/from-zero/apps
flutter create mobile
cd mobile
flutter pub add firebase_core firebase_auth http go_router
cat > lib/main.dart <<'DART'
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const F0App());
}
class F0App extends StatelessWidget {
  const F0App({super.key});
  @override
  Widget build(BuildContext context) {
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    ]);
    return MaterialApp.router(
      title: 'F0 Agent',
      theme: ThemeData.dark(useMaterial3: true),
      routerConfig: router,
    );
  }
}
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0C14),
      appBar: AppBar(title: const Text('F0 Agent')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Card(child: ListTile(title: const Text('FZ Token Balance'), subtitle: const Text('0.00 FZ'))),
            const SizedBox(height: 16),
            Wrap(spacing: 12, runSpacing: 12, children: const [
              _ActionChip(label: 'Agents'),
              _ActionChip(label: 'Marketplace'),
              _ActionChip(label: 'Project'),
              _ActionChip(label: 'Wallet'),
            ]),
            const Spacer(),
            FilledButton(onPressed: (){}, child: const Text('Run Agent'))
          ],
        ),
      ),
    );
  }
}
class _ActionChip extends StatelessWidget {
  final String label; const _ActionChip({required this.label, super.key});
  @override
  Widget build(BuildContext context) => Chip(label: Text(label));
}
DART
echo "✅ Step 5 ready. Run: cd /Users/abdo/Downloads/from-zero/apps/mobile && flutter run"
