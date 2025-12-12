/**
 * Phase 100: AI Media Studio
 * Voice → Prompt → Image → Auto-Insert
 */

export type F0MediaKind =
  | 'logo'
  | 'app-icon'
  | 'splash'
  | 'hero'
  | 'background'
  | 'illustration';

export interface F0MediaAsset {
  id: string;
  projectId: string;
  kind: F0MediaKind;

  // الوصف اللي المستخدم قاله (بعد الـ STT أو كتابة يدوي)
  prompt: string;

  // رابط الصورة (Storage / CDN)
  url: string;

  // لو هنعمل نسخ متعددة (ios icon, android icon…)
  variants?: {
    iosAppIcon?: string;
    androidAppIcon?: string;
    webFavicon?: string;
    splash1125x2436?: string;
    [key: string]: string | undefined;
  };

  // metadata
  createdAt: number;
  createdByUid?: string | null;

  // هل اتعمله auto-insert في الكود؟
  autoInserted?: boolean;
  autoInsertTarget?:
    | 'login-page'
    | 'landing-hero'
    | 'splash-screen'
    | 'navbar-logo'
    | string;
}

/**
 * Request/Response types for API endpoints
 */

export interface VoiceToTextRequest {
  audio: File;
}

export interface VoiceToTextResponse {
  ok: boolean;
  transcript?: string;
  error?: string;
}

export interface GenerateMediaRequest {
  projectId: string;
  kind: F0MediaKind;
  prompt: string;
  autoInsertTarget?: string;
}

export interface GenerateMediaResponse {
  ok: boolean;
  media?: F0MediaAsset;
  error?: string;
}
