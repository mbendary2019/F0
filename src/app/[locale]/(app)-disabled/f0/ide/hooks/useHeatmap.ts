/**
 * Phase 85.4.3: Heatmap Hook
 * Manages heatmap decorations in Monaco editor
 * Features:
 * - Caching based on file content hash
 * - Toggle on/off
 * - Color-coded line backgrounds based on impact
 * - Minimap visualization
 */

import { useCallback, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';
import { sha256 } from '@/lib/ide/sha256';
import { generateHeatmapForFile, FileHeatmapResult } from '@/lib/ide/heatmapEngine';
import { IdeProjectAnalysisDocument } from '@/types/ideBridge';

interface HeatmapCache {
  [filePath: string]: {
    hash: string;
    decorations: string[];
    impactData: FileHeatmapResult;
  };
}

export function useHeatmap(
  editor: monaco.editor.IStandaloneCodeEditor | null,
  filePath: string,
  content: string,
  analysis?: IdeProjectAnalysisDocument | null
) {
  const cacheRef = useRef<HeatmapCache>({});
  const [enabled, setEnabled] = useState(false);

  const clearDecorations = useCallback(() => {
    if (!editor) return;
    const cached = cacheRef.current[filePath];
    if (cached?.decorations) {
      editor.deltaDecorations(cached.decorations, []);
    }
    delete cacheRef.current[filePath];
  }, [editor, filePath]);

  const applyHeatmap = useCallback(() => {
    if (!editor) return;

    const hash = sha256(content);

    // If cached & same content → reuse
    if (
      cacheRef.current[filePath] &&
      cacheRef.current[filePath].hash === hash
    ) {
      console.log('[Heatmap] Using cached heatmap for', filePath);
      setEnabled(true);
      return;
    }

    console.log('[Heatmap] Generating new heatmap for', filePath);

    clearDecorations();

    const impactData = generateHeatmapForFile(filePath, content, analysis || undefined);

    const decorations = impactData.lines.map((l) => {
      const opacity = Math.max(l.impact, 0.1); // Minimum visibility
      const color =
        l.risk === 'high'
          ? `rgba(255, 77, 79, ${opacity * 0.3})` // Red
          : l.risk === 'medium'
          ? `rgba(250, 173, 20, ${opacity * 0.25})` // Orange
          : `rgba(64, 169, 255, ${opacity * 0.2})`; // Blue

      // Minimap color (more opaque for visibility)
      const minimapColor =
        l.risk === 'high'
          ? '#ff4d4f'
          : l.risk === 'medium'
          ? '#faad14'
          : '#40a9ff';

      return {
        range: new monaco.Range(l.line, 1, l.line, 1),
        options: {
          isWholeLine: true,
          className: 'heatmap-line',
          linesDecorationsClassName: '',
          minimap: {
            color: minimapColor,
            position: monaco.editor.MinimapPosition.Inline,
          },
          overviewRuler: {
            color: minimapColor,
            position: monaco.editor.OverviewRulerLane.Right,
          },
          backgroundColor: color,
        },
      };
    });

    const ids = editor.deltaDecorations([], decorations);

    cacheRef.current[filePath] = {
      hash,
      decorations: ids,
      impactData,
    };

    setEnabled(true);
  }, [editor, filePath, clearDecorations, content, analysis]);

  const toggle = useCallback(() => {
    if (enabled) {
      console.log('[Heatmap] Disabling heatmap');
      clearDecorations();
      setEnabled(false);
    } else {
      console.log('[Heatmap] Enabling heatmap');
      applyHeatmap();
    }
  }, [enabled, clearDecorations, applyHeatmap]);

  return {
    enabled,
    toggle,
    impactData: cacheRef.current[filePath]?.impactData,
  };
}
