// src/types/inlineSuggestions.ts

export interface InlineSuggestionRequest {
  projectId: string;
  sessionId?: string; // Optional if Live Bridge is active
  filePath: string;
  languageId?: string;
  prefix: string;   // Code before cursor
  suffix: string;   // Code after cursor
  cursorLine: number;
  cursorCharacter: number;
}

export interface InlineSuggestionResponse {
  suggestion: string; // Suggested text to insert at cursor
}
