'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useMemoryTimeline, formatMemoryTimestamp } from '@/lib/collab/memory/useMemoryTimeline';
import { searchMemories, type SearchResult } from '@/lib/collab/memory/search';
import { findSimilar } from '@/lib/collab/memory/similar';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function MemoryPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [roomId, setRoomId] = useState<string | undefined>(sp?.get('room') || undefined);
  const [sessionId, setSessionId] = useState<string | undefined>(sp?.get('session') || undefined);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const { items, loading, error } = useMemoryTimeline({ roomId, sessionId, pageSize: 200 });

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (roomId) params.set('room', roomId);
    if (sessionId) params.set('session', sessionId);

    const newUrl = params.toString() ? `?${params.toString()}` : '';
    router.replace(newUrl, { scroll: false });
  }, [roomId, sessionId, router]);

  // Search handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setShowSearchResults(true);

    try {
      const results = await searchMemories({
        query: searchQuery.trim(),
        roomId,
        sessionId,
        topK: 12,
        hybridBoost: 0.35,
      });
      setSearchResults(results);
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            📚 Memory Timeline
          </h1>
          <Link
            href="/en/dev/collab"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to Collab
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Room ID
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-900 dark:text-neutral-100"
                value={roomId || ''}
                onChange={(e) => setRoomId(e.target.value || undefined)}
                placeholder="ide-file-demo-page-tsx"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Session ID
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-neutral-900 dark:text-neutral-100"
                value={sessionId || ''}
                onChange={(e) => setSessionId(e.target.value || undefined)}
                placeholder="room__20251106"
              />
            </div>
            {(roomId || sessionId) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setRoomId(undefined);
                    setSessionId(undefined);
                  }}
                  className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Semantic Search */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Semantic Search
            </h2>
            <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
              Phase 56 Day 2
            </span>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memories semantically... (e.g., 'bug fixes', 'authentication flow')"
              className="flex-1 px-4 py-2 text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-neutral-900 dark:text-neutral-100"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
            {showSearchResults && (
              <button
                type="button"
                onClick={() => {
                  setShowSearchResults(false);
                  setSearchResults([]);
                  setSearchQuery('');
                }}
                className="px-4 py-2 text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-md hover:bg-neutral-300 dark:hover:bg-neutral-600"
              >
                Clear
              </button>
            )}
          </form>

          {searchError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-400">
              {searchError}
            </div>
          )}
        </div>

        {/* Search Results */}
        {showSearchResults && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                Search Results
              </h3>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </span>
            </div>

            {searchResults.length === 0 && !isSearching && (
              <div className="text-center py-8 text-neutral-600 dark:text-neutral-400">
                No results found for "{searchQuery}"
              </div>
            )}

            {searchResults.map((result) => (
              <div
                key={result.id}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-purple-200 dark:border-purple-800/30 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs">
                      <span className="font-semibold text-purple-600 dark:text-purple-400">
                        Score: {(result.score * 100).toFixed(1)}%
                      </span>
                      <span className="text-neutral-400 dark:text-neutral-500">|</span>
                      <span className="text-neutral-600 dark:text-neutral-400">
                        Similarity: {(result.sim * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/en/dev/collab?room=${encodeURIComponent(result.roomId)}&session=${encodeURIComponent(result.sessionId)}`}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
                  >
                    Open in Collab →
                  </Link>
                </div>

                <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed mb-2">
                  {result.text}
                </p>

                <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="font-mono">{result.sessionId}</span>
                  <span>•</span>
                  <span className="font-mono text-[10px]">{result.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-neutral-600 dark:text-neutral-400">
            Loading timeline...
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-700 dark:text-red-400">
              Error loading timeline: {error.message}
            </p>
          </div>
        )}

        {/* Timeline Items */}
        {!loading && !error && (
          <div className="space-y-4">
            {(!items || items.length === 0) && (
              <div className="text-center py-12 text-neutral-600 dark:text-neutral-400">
                No memory items yet.
                <br />
                <span className="text-sm">Start chatting in a room to create memories!</span>
              </div>
            )}

            {Array.isArray(items) && items.length > 0 && items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] uppercase font-semibold rounded tracking-wide ${
                          item.type === 'auto-summary'
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : item.type === 'manual-pin'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {item.type}
                      </span>
                      {item.pinned && (
                        <span className="text-amber-500" title="Pinned">
                          📌
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="font-mono">{item.sessionId}</span>
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {formatMemoryTimestamp(item.createdAt)}
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed mb-3">
                  {item.content}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-700">
                  <div className="flex items-center gap-4 text-xs text-neutral-600 dark:text-neutral-400">
                    {item.stats?.messages != null && (
                      <span className="flex items-center gap-1">
                        💬 <span>{item.stats.messages}</span>
                      </span>
                    )}
                    {item.stats?.participants != null && (
                      <span className="flex items-center gap-1">
                        👥 <span>{item.stats.participants}</span>
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/en/dev/collab?room=${encodeURIComponent(
                      item.roomId
                    )}&session=${encodeURIComponent(item.sessionId)}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Replay →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && Array.isArray(items) && items.length > 0 && (
          <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            Showing {items.length} memory item{items.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
