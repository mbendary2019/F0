// src/types/projectAnalyzer.ts
// Phase 74: Project Analysis & Tech Stack Detection Types

export type ProjectType =
  | 'nextjs'
  | 'react'
  | 'node-api'
  | 'flutter'
  | 'react-native'
  | 'expo'
  | 'static'
  | 'unknown';

export interface FrameworkInfo {
  name: string;          // e.g. "next-14", "expo", "flutter"
  language: 'ts' | 'js' | 'dart' | 'swift' | 'kotlin' | 'mixed';
}

export interface DetectedFeatures {
  hasAuth: boolean;
  hasFirebase: boolean;
  hasStripe: boolean;
  hasI18n: boolean;
  hasTailwind: boolean;
  hasShadcn: boolean;
  hasBackendApi: boolean; // /api routes أو functions
}

export interface EntryPointInfo {
  mainEntries: string[];   // مثل ["src/app/page.tsx"]
  apiEntries: string[];    // مثل ["src/app/api/**/route.ts"]
  mobileEntries: string[]; // لو Flutter/React Native
}

export interface ProjectAnalysis {
  projectType: ProjectType;
  framework: FrameworkInfo;
  features: DetectedFeatures;
  entries: EntryPointInfo;
  dependencies: string[];     // من package.json أو pubspec
  fileCount: number;
  totalSizeBytes: number;
  analyzedAt: string;         // ISO string
}
