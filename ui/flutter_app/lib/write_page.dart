
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class WritePage extends StatefulWidget {
  final String defaultWsBase;
  const WritePage({super.key, required this.defaultWsBase});

  @override
  State<WritePage> createState() => _WritePageState();
}

class _WritePageState extends State<WritePage> {
  final TextEditingController _baseDir = TextEditingController(text: "../output");
  final TextEditingController _json = TextEditingController(text: "{\n  \"files\": [\n    {\"path\": \"README.md\", \"content\": \"# Hello From Zero\\n\"}\n  ]\n}");
  List<Map<String, dynamic>> _files = [];
  String _status = "";
  String _apiBase = "http://localhost:8080";

  void _parseJson() {
    setState(() {
      _files = [];
      _status = "";
    });
    try {
      final data = jsonDecode(_json.text);
      final dynamic tryFiles = (data["files"] ?? (data["result"]?["merged"]?["files"]));
      final files = (tryFiles is List) ? tryFiles : <dynamic>[];
      setState(() {
        _files = files.cast<Map<String, dynamic>>();
        _status = "Parsed ${_files.length} file(s).";
      });
    } catch (e) {
      setState(() => _status = "JSON parse error: $e");
    }
  }

  Future<void> _writeToRepo() async {
    setState(() => _status = "Writing...");
    try {
      final body = {
        "baseDir": _baseDir.text.trim().isEmpty ? null : _baseDir.text.trim(),
        "files": _files
      };
      final resp = await http.post(
        Uri.parse("$_apiBase/api/write"),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(body),
      );
      if (resp.statusCode == 200) {
        setState(() => _status = "Success: ${resp.body}");
      } else {
        setState(() => _status = "Error ${resp.statusCode}: ${resp.body}");
      }
    } catch (e) {
      setState(() => _status = "Request error: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _baseDir,
                  decoration: const InputDecoration(
                    labelText: "Base directory (WRITE_BASE_DIR override)",
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 240,
                child: TextField(
                  decoration: const InputDecoration(
                    labelText: "API Base",
                    hintText: "http://localhost:8080",
                    border: OutlineInputBorder(),
                  ),
                  onChanged: (v) => setState(() => _apiBase = v.trim().isEmpty ? "http://localhost:8080" : v.trim()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: TextField(
              controller: _json,
              expands: true,
              maxLines: null,
              minLines: null,
              decoration: const InputDecoration(
                labelText: "Paste JSON here (either {files:[]} or full /api/run result)",
                border: OutlineInputBorder(),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              ElevatedButton(onPressed: _parseJson, child: const Text("Preview Files")),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: _files.isEmpty ? null : _writeToRepo,
                child: const Text("Write to Repo"),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text("Status: $_status"),
          const SizedBox(height: 8),
          Expanded(
            child: ListView.separated(
              itemCount: _files.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, i) {
                final f = _files[i];
                return ListTile(
                  dense: true,
                  title: Text(f["path"]?.toString() ?? "(no path)"),
                  subtitle: Text(
                    (f["content"] is String ? f["content"] : jsonEncode(f["content"])).toString(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
