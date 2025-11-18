
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'write_page.dart';

void main() {
  runApp(const FromZeroApp());
}

class FromZeroApp extends StatelessWidget {
  const FromZeroApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'From Zero Dashboard',
      theme: ThemeData.dark(),
      home: const HomeTabs(),
    );
  }
}

class HomeTabs extends StatefulWidget {
  const HomeTabs({super.key});
  @override
  State<HomeTabs> createState() => _HomeTabsState();
}

class _HomeTabsState extends State<HomeTabs> with SingleTickerProviderStateMixin {
  late final TabController _tab;
  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('From Zero — Dashboard'),
          bottom: const TabBar(tabs: [
            Tab(text: 'Live Logs'),
            Tab(text: 'Writer'),
          ]),
        ),
        body: const TabBarView(children: [
          LiveLogs(),
          WritePage(defaultWsBase: 'http://localhost:8080'),
        ]),
      ),
    );
  }
}

class LiveLogs extends StatefulWidget {
  const LiveLogs({super.key});
  @override
  State<LiveLogs> createState() => _LiveLogsState();
}

class _LiveLogsState extends State<LiveLogs> {
  late final WebSocketChannel ch;
  final logs = <String>[];

  @override
  void initState() {
    super.initState();
    ch = WebSocketChannel.connect(Uri.parse('ws://localhost:8080/ws'));
    ch.stream.listen((data) {
      try {
        final msg = jsonDecode(data);
        setState(() => logs.add("[${msg['stage']}] ${msg['message']}"));
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    ch.sink.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: logs.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, i) => Text(logs[i]),
    );
  }
}
