// src/components/attachments/AttachmentViewer.tsx
// =============================================================================
// Phase 158.4 + 162 + 163 – Attachment Viewer with Media Chat + UI Generation
// Component for displaying and previewing attachments
// =============================================================================

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Image as ImageIcon,
  FileText,
  Music,
  File,
  Download,
  ExternalLink,
  X,
  Play,
  Pause,
  MessageCircle,
  Wand2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface AttachmentData {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf' | 'document' | 'audio' | 'other';
  downloadUrl?: string;
}

interface AttachmentViewerProps {
  attachment: AttachmentData;
  className?: string;
}

interface AttachmentThumbnailProps {
  attachment: AttachmentData;
  onClick?: () => void;
  className?: string;
}

interface AttachmentPreviewModalProps {
  attachment: AttachmentData | null;
  open: boolean;
  onClose: () => void;
  onOpenMediaChat?: (attachment: AttachmentData) => void;  // Phase 162
  onGenerateUI?: (attachment: AttachmentData) => Promise<void>;  // Phase 163
  projectId?: string;  // Phase 163
}

// =============================================================================
// Helpers
// =============================================================================

const getIcon = (kind: AttachmentData['kind']) => {
  switch (kind) {
    case 'image':
      return <ImageIcon className="h-5 w-5" />;
    case 'pdf':
    case 'document':
      return <FileText className="h-5 w-5" />;
    case 'audio':
      return <Music className="h-5 w-5" />;
    default:
      return <File className="h-5 w-5" />;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getKindColor = (kind: AttachmentData['kind']) => {
  switch (kind) {
    case 'image':
      return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
    case 'pdf':
      return 'text-red-400 bg-red-500/20 border-red-500/30';
    case 'document':
      return 'text-green-400 bg-green-500/20 border-green-500/30';
    case 'audio':
      return 'text-purple-400 bg-purple-500/20 border-purple-500/30';
    default:
      return 'text-slate-400 bg-slate-500/20 border-slate-500/30';
  }
};

// =============================================================================
// AttachmentThumbnail - Small preview for lists
// =============================================================================

export function AttachmentThumbnail({
  attachment,
  onClick,
  className = '',
}: AttachmentThumbnailProps) {
  const isImage = attachment.kind === 'image';
  const downloadUrl = attachment.downloadUrl || `/api/attachments/file/${attachment.id}`;

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative group cursor-pointer rounded-lg border overflow-hidden',
        'hover:ring-2 hover:ring-fuchsia-500/50 transition-all',
        getKindColor(attachment.kind),
        className
      )}
    >
      {isImage ? (
        <div className="w-16 h-16 relative">
          <img
            src={downloadUrl}
            alt={attachment.filename}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
      ) : (
        <div className="w-16 h-16 flex flex-col items-center justify-center p-2">
          {getIcon(attachment.kind)}
          <span className="text-[8px] mt-1 truncate w-full text-center">
            {attachment.filename.split('.').pop()?.toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// AttachmentCard - Card view with details
// =============================================================================

export function AttachmentCard({
  attachment,
  className = '',
}: AttachmentViewerProps) {
  const [showPreview, setShowPreview] = useState(false);
  const downloadUrl = attachment.downloadUrl || `/api/attachments/file/${attachment.id}`;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
          'hover:bg-slate-800/50 transition-colors',
          getKindColor(attachment.kind),
          className
        )}
        onClick={() => setShowPreview(true)}
      >
        <div className="flex-shrink-0">{getIcon(attachment.kind)}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{attachment.filename}</div>
          <div className="text-xs text-muted-foreground">
            {formatFileSize(attachment.sizeBytes)}
          </div>
        </div>
        <a
          href={downloadUrl}
          download={attachment.filename}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 p-2 rounded hover:bg-slate-700/50"
        >
          <Download className="h-4 w-4" />
        </a>
      </div>

      <AttachmentPreviewModal
        attachment={attachment}
        open={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}

// =============================================================================
// AttachmentPreviewModal - Full preview in modal
// =============================================================================

export function AttachmentPreviewModal({
  attachment,
  open,
  onClose,
  onOpenMediaChat,
  onGenerateUI,
  projectId,
}: AttachmentPreviewModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!attachment) return null;

  const downloadUrl = attachment.downloadUrl || `/api/attachments/file/${attachment.id}`;

  // Phase 162: Handler for opening media chat
  const handleOpenMediaChat = () => {
    if (onOpenMediaChat && attachment) {
      onOpenMediaChat(attachment);
      onClose();
    }
  };

  // Phase 163: Handler for generating UI
  const handleGenerateUI = async () => {
    if (!attachment) return;

    setIsGenerating(true);
    try {
      if (onGenerateUI) {
        await onGenerateUI(attachment);
      } else if (projectId) {
        // Default behavior: call API directly
        const res = await fetch('/api/ui/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            attachmentIds: [attachment.id],
            mode: 'page',
            framework: 'nextjs',
            styling: 'shadcn',
          }),
        });
        const data = await res.json();
        if (data.success) {
          console.log('[163][UI] Generated proposal:', data.proposal?.id);
          // Could emit event or callback here
        }
      }
      onClose();
    } catch (error) {
      console.error('[163][UI] Error generating UI:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Check if attachment can generate UI (images and PDFs)
  const canGenerateUI = ['image', 'pdf'].includes(attachment.kind);

  const renderPreview = () => {
    switch (attachment.kind) {
      case 'image':
        return (
          <div className="flex items-center justify-center max-h-[70vh] overflow-auto">
            <img
              src={downloadUrl}
              alt={attachment.filename}
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          </div>
        );

      case 'pdf':
        return (
          <iframe
            src={downloadUrl}
            className="w-full h-[70vh] rounded"
            title={attachment.filename}
          />
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
              <Music className="h-12 w-12 text-purple-400" />
            </div>
            <audio
              controls
              className="w-full max-w-md"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            >
              <source src={downloadUrl} type={attachment.mimeType} />
              Your browser does not support the audio element.
            </audio>
          </div>
        );

      case 'document':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-24 h-24 rounded-lg bg-green-500/20 flex items-center justify-center mb-4">
              <FileText className="h-12 w-12 text-green-400" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Document preview not available
            </p>
            <a href={downloadUrl} download={attachment.filename}>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </a>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-24 h-24 rounded-lg bg-slate-500/20 flex items-center justify-center mb-4">
              <File className="h-12 w-12 text-slate-400" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Preview not available for this file type
            </p>
            <a href={downloadUrl} download={attachment.filename}>
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </a>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl bg-slate-900 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon(attachment.kind)}
            <span className="truncate">{attachment.filename}</span>
            <span className="text-xs text-muted-foreground ml-2">
              ({formatFileSize(attachment.sizeBytes)})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4">{renderPreview()}</div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800">
          <span className="text-xs text-muted-foreground">
            Type: {attachment.mimeType}
          </span>
          <div className="flex gap-2">
            {/* Phase 163: Generate UI button */}
            {canGenerateUI && (onGenerateUI || projectId) && (
              <Button
                variant="default"
                size="sm"
                onClick={handleGenerateUI}
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                {isGenerating ? 'Generating...' : 'Generate UI'}
              </Button>
            )}
            {/* Phase 162: Media Chat button */}
            {onOpenMediaChat && (
              <Button
                variant="default"
                size="sm"
                onClick={handleOpenMediaChat}
                className="bg-fuchsia-600 hover:bg-fuchsia-700"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Chat about this
              </Button>
            )}
            <a href={downloadUrl} download={attachment.filename}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </a>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// AttachmentList - List of attachments
// =============================================================================

interface AttachmentListProps {
  attachments: AttachmentData[];
  variant?: 'thumbnail' | 'card';
  className?: string;
}

export function AttachmentList({
  attachments,
  variant = 'thumbnail',
  className = '',
}: AttachmentListProps) {
  const [selectedAttachment, setSelectedAttachment] = useState<AttachmentData | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          'flex flex-wrap gap-2',
          variant === 'card' && 'flex-col',
          className
        )}
      >
        {attachments.map((att) =>
          variant === 'thumbnail' ? (
            <AttachmentThumbnail
              key={att.id}
              attachment={att}
              onClick={() => setSelectedAttachment(att)}
            />
          ) : (
            <AttachmentCard key={att.id} attachment={att} />
          )
        )}
      </div>

      <AttachmentPreviewModal
        attachment={selectedAttachment}
        open={!!selectedAttachment}
        onClose={() => setSelectedAttachment(null)}
      />
    </>
  );
}

console.log('[163][UI] AttachmentViewer loaded with Media Chat + UI Generation support');
