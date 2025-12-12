/**
 * Phase 85.4.2: Visual Dependency Graph Panel
 * Interactive force-directed graph visualization of project dependencies
 */

'use client';

import React, { useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { IdeProjectAnalysisDocument } from '@/types/ideBridge';

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
  ssr: false,
});

interface DependencyGraphPanelProps {
  analysis: IdeProjectAnalysisDocument | null;
  onOpenFile: (path: string) => void;
}

type HighlightMode =
  | 'none'
  | 'core'
  | 'god'
  | 'cycle'
  | 'high-risk'
  | 'high-impact';

export default function DependencyGraphPanel({
  analysis,
  onOpenFile,
}: DependencyGraphPanelProps) {
  const graphRef = useRef<any>();
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('none');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Convert analysis to graph data
  const graphData = useMemo(() => {
    if (!analysis) return { nodes: [], links: [] };

    const { files, edges, summary } = analysis;

    const nodes = files.map((file) => {
      const fanIn = file.fanIn ?? 0;
      const fanOut = file.fanOut ?? 0;
      const isCore = fanIn >= 10;
      const isGod = fanOut >= 10;
      const inCycle = summary.cycles?.some((c) => c.includes(file.path)) ?? false;

      // Determine risk level based on characteristics
      const risk: 'low' | 'medium' | 'high' = inCycle || isCore || isGod
        ? 'high'
        : fanIn >= 5 || fanOut >= 5
        ? 'medium'
        : 'low';

      // Determine impact based on fan-in/fan-out
      const impact: 'low' | 'medium' | 'high' =
        fanIn >= 10 || fanOut >= 10
          ? 'high'
          : fanIn >= 5 || fanOut >= 5
          ? 'medium'
          : 'low';

      // Color coding based on risk
      const color =
        risk === 'high'
          ? '#ff4d4f' // Red for high risk
          : risk === 'medium'
          ? '#faad14' // Orange for medium risk
          : '#40a9ff'; // Blue for low risk

      return {
        id: file.path,
        label: file.path,
        fanIn,
        fanOut,
        color,
        isCore,
        isGod,
        inCycle,
        risk,
        impact,
      };
    });

    const links = edges.map((edge) => ({
      source: edge.from,
      target: edge.to,
    }));

    return { nodes, links };
  }, [analysis]);

  // Filter nodes based on highlight mode
  const filteredGraphData = useMemo(() => {
    if (highlightMode === 'none') {
      return graphData;
    }

    const filteredNodes = graphData.nodes.filter((node) => {
      switch (highlightMode) {
        case 'core':
          return node.isCore;
        case 'god':
          return node.isGod;
        case 'cycle':
          return node.inCycle;
        case 'high-risk':
          return node.risk === 'high';
        case 'high-impact':
          return node.impact === 'high';
        default:
          return true;
      }
    });

    // Filter links to only include those between filtered nodes
    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredLinks = graphData.links.filter(
      (link) =>
        filteredNodeIds.has(link.source as string) &&
        filteredNodeIds.has(link.target as string)
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, highlightMode]);

  // Custom node painting
  const paintNode = useCallback(
    (node: any, ctx: any, globalScale: number) => {
      const fontSize = 12 / globalScale;
      const isHovered = node.id === hoveredNode;

      // Draw node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, isHovered ? 8 : 6, 0, 2 * Math.PI, false);
      ctx.fill();

      // Draw border for hovered node
      if (isHovered) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw label
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = isHovered ? '#fff' : '#ccc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const filename = node.label.split('/').pop() || node.label;
      ctx.fillText(filename, node.x + 10, node.y);

      // Draw badge for special nodes
      if (node.isCore || node.isGod || node.inCycle) {
        ctx.font = `${fontSize - 2}px sans-serif`;
        ctx.fillStyle = '#fff';
        const badge = node.inCycle ? '↻' : node.isCore ? '★' : '⚡';
        ctx.fillText(badge, node.x - 3, node.y - 12);
      }
    },
    [hoveredNode]
  );

  // Custom link painting
  const paintLink = useCallback(
    (link: any, ctx: any, globalScale: number) => {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(link.source.x, link.source.y);
      ctx.lineTo(link.target.x, link.target.y);
      ctx.stroke();
    },
    []
  );

  // Node click handler
  const handleNodeClick = useCallback(
    (node: any) => {
      onOpenFile(node.id);
    },
    [onOpenFile]
  );

  // Node hover handlers
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNode(node ? node.id : null);
  }, []);

  if (!analysis) {
    return (
      <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
        <div className="h-12 flex items-center px-4 border-b border-gray-700">
          <div className="text-white font-semibold text-sm">📈 Dependency Graph</div>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No analysis data available. Click &quot;📊 Analyze Project&quot; first.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="h-12 flex items-center px-4 border-b border-gray-700 justify-between">
        <div className="text-white font-semibold text-sm flex items-center gap-2">
          📈 Dependency Graph
          <span className="text-xs text-gray-500">
            ({filteredGraphData.nodes.length} nodes, {filteredGraphData.links.length} edges)
          </span>
        </div>

        {/* Highlight Mode Selector */}
        <select
          className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-gray-500"
          value={highlightMode}
          onChange={(e) => setHighlightMode(e.target.value as HighlightMode)}
        >
          <option value="none">Highlight: All Files</option>
          <option value="core">Core Files (High Fan-In)</option>
          <option value="god">God Files (High Fan-Out)</option>
          <option value="cycle">Dependency Cycles</option>
          <option value="high-impact">High Impact</option>
          <option value="high-risk">High Risk</option>
        </select>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-gray-700 flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#ff4d4f]"></div>
          <span className="text-gray-400">High Risk</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#faad14]"></div>
          <span className="text-gray-400">Medium Risk</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#40a9ff]"></div>
          <span className="text-gray-400">Low Risk</span>
        </div>
        <div className="ml-4 flex items-center gap-1">
          <span className="text-white">★</span>
          <span className="text-gray-400">Core</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white">⚡</span>
          <span className="text-gray-400">God</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white">↻</span>
          <span className="text-gray-400">Cycle</span>
        </div>
      </div>

      {/* Graph Canvas */}
      <div className="flex-1 relative">
        <ForceGraph2D
          ref={graphRef}
          graphData={filteredGraphData}
          nodeLabel={(node: any) =>
            `${node.label}\nFan-In: ${node.fanIn}\nFan-Out: ${node.fanOut}\nRisk: ${node.risk}\nImpact: ${node.impact}`
          }
          nodeColor={(node: any) => node.color}
          linkColor={() => '#555'}
          backgroundColor="#111"
          nodeCanvasObject={paintNode}
          linkCanvasObject={paintLink}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          width={500}
          height={window.innerHeight - 140}
          enableNodeDrag={true}
          enablePanInteraction={true}
          enableZoomInteraction={true}
          minZoom={0.1}
          maxZoom={8}
        />
      </div>

      {/* Hovered Node Info */}
      {hoveredNode && (
        <div className="absolute bottom-4 left-4 right-4 bg-gray-800 border border-gray-600 rounded p-2 text-xs">
          <div className="font-semibold text-white truncate">{hoveredNode}</div>
          <div className="text-gray-400 mt-1 space-y-0.5">
            {graphData.nodes
              .filter((n) => n.id === hoveredNode)
              .map((node) => (
                <div key={node.id}>
                  <div>Fan-In: {node.fanIn} | Fan-Out: {node.fanOut}</div>
                  <div>
                    {node.isCore && <span className="text-blue-400">Core • </span>}
                    {node.isGod && <span className="text-yellow-400">God File • </span>}
                    {node.inCycle && <span className="text-red-400">In Cycle • </span>}
                    Risk: {node.risk} | Impact: {node.impact}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
