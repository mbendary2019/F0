"use client";

import { useState, useEffect } from "react";
import { Search, Play, CheckCircle2, Clock, Filter, RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type TaskStatus = "queued" | "running" | "completed" | "failed";

interface Task {
  id: string;
  name: string;
  prompt?: string;
  tags: string[];
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: string;
  createdAt?: number;
}

export default function TasksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const loadTasks = async () => {
    try {
      setError(null);
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const data = await response.json();

      if (data.ok && data.tasks) {
        // Transform F0 tasks to our format
        const transformedTasks = data.tasks.map((task: any, index: number) => ({
          id: task.id || `task_${index}`,
          name: task.prompt || task.title || "Unnamed Task",
          prompt: task.prompt,
          tags: task.tags || [],
          status: task.status || "completed",
          startedAt: task.createdAt ? new Date(task.createdAt).toLocaleString() : undefined,
          completedAt: task.completedAt ? new Date(task.completedAt).toLocaleString() : undefined,
          duration: task.duration || undefined,
          createdAt: task.createdAt,
        }));

        setTasks(transformedTasks);
      } else {
        setError(data.error || "Failed to load tasks");
      }
    } catch (err: any) {
      console.error("Error loading tasks:", err);
      setError(err.message || "Failed to connect to F0 API");
    } finally {
      setLoading(false);
    }
  };

  const runTask = async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      const response = await fetch("/api/tasks/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "Generate a short README for the F0 project with bilingual content (EN/AR).",
          tags: ["docs", "demo", "readme"],
        }),
      });

      const data = await response.json();

      if (data.ok) {
        alert("✅ Task started successfully!");
        loadTasks(); // Refresh tasks
      } else {
        alert(`❌ Failed: ${data.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const stats = {
    queued: tasks.filter((t) => t.status === "queued").length,
    running: tasks.filter((t) => t.status === "running").length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      searchQuery === "" ||
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "queued":
        return "text-slate-400 bg-slate-500/10";
      case "running":
        return "text-cyan-400 bg-cyan-500/10 animate-pulse";
      case "completed":
        return "text-green-400 bg-green-500/10";
      case "failed":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-slate-400 bg-slate-500/10";
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "queued":
        return <Clock className="w-4 h-4" />;
      case "running":
        return <Play className="w-4 h-4" />;
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-2">
              Tasks Dashboard | لوحة المهام
            </h1>
            <p className="text-slate-400">
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading live data...
                </span>
              ) : error ? (
                <span className="text-red-400">❌ {error}</span>
              ) : (
                <>
                  ✅ Connected to F0 Orchestrator | متصل بـ F0
                  <br />
                  <span className="text-sm">Auto-refreshing every 5 seconds | تحديث تلقائي كل 5 ثواني</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={loadTasks}
              disabled={loading}
              variant="outline"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={runTask}
              disabled={isRunning}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isRunning ? "Running..." : "Run Task"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">Queued</span>
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <div className="text-3xl font-bold text-white">{stats.queued}</div>
            <p className="text-xs text-slate-500 mt-1">في الانتظار</p>
          </div>

          <div className="bg-slate-800/50 border border-cyan-500/30 rounded-lg p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-cyan-400 text-sm">Running</span>
              <Play className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.running}</div>
            <p className="text-xs text-slate-500 mt-1">قيد التنفيذ</p>
          </div>

          <div className="bg-slate-800/50 border border-green-500/30 rounded-lg p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400 text-sm">Completed</span>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.completed}</div>
            <p className="text-xs text-slate-500 mt-1">مكتملة</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 backdrop-blur">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search tasks or tags... | ابحث عن المهام أو العلامات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "all")}
                className="bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-8 py-2 text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg backdrop-blur overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-900/50 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    Task | المهمة
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    Tags | العلامات
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    Started | البداية
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    Duration | المدة
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                    Status | الحالة
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No tasks found | لم يتم العثور على مهام
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{task.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-1">
                          {task.id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {task.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {task.startedAt || "-"}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {task.duration || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                            task.status
                          )}`}
                        >
                          {getStatusIcon(task.status)}
                          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center text-slate-500 text-sm">
          <p>
            Showing {filteredTasks.length} of {tasks.length} tasks
            {" | "}
            عرض {filteredTasks.length} من {tasks.length} مهمة
          </p>
          <p className="mt-2 text-xs flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Live data from F0 Orchestrator (localhost:8787)
            {" | "}
            بيانات حية من F0
          </p>
        </div>
      </div>
    </div>
  );
}

