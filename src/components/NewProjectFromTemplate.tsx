/**
 * Phase 78: Developer Mode Assembly - New Project from Template Component
 * Modal component for creating a new project from a template
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTemplates } from '@/features/templates/useTemplates';
import { TemplateGrid } from '@/components/TemplateGrid';

interface NewProjectFromTemplateProps {
  onDone?: () => void;
}

export function NewProjectFromTemplate({ onDone }: NewProjectFromTemplateProps) {
  const router = useRouter();
  const { templates, loading, error } = useTemplates();
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setFeedback('Please enter a project name');
      return;
    }

    if (!selectedTemplateId) {
      setFeedback('Please select a template');
      return;
    }

    try {
      setCreating(true);
      setFeedback(null);

      const res = await fetch('/api/projects/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          templateId: selectedTemplateId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Failed to create project');
      }

      setFeedback('✅ Project created successfully!');

      // Wait a moment then redirect
      setTimeout(() => {
        onDone?.();
        router.push(`/projects/${json.id}`);
      }, 1000);
    } catch (e: any) {
      console.error('[NewProjectFromTemplate] Error:', e);
      setFeedback(e.message || 'Error creating project');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="space-y-4">
        {/* Project Name Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Name
          </label>
          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 bg-gray-900 border-gray-700 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="My Awesome Project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
            autoFocus
          />
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Choose Template
          </label>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              <p className="text-sm text-gray-400 mt-2">Loading templates...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <TemplateGrid
              templates={templates}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
            />
          )}
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`rounded-lg p-3 text-sm ${
              feedback.startsWith('✅')
                ? 'bg-green-900/20 border border-green-800 text-green-400'
                : 'bg-yellow-900/20 border border-yellow-800 text-yellow-400'
            }`}
          >
            {feedback}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onDone}
            className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 disabled:opacity-50"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim() || !selectedTemplateId}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {creating && (
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {creating ? 'Creating Project...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
