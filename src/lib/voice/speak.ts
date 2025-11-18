/**
 * Text-to-Speech (Browser API)
 * Speak text aloud using browser's speech synthesis
 */

/**
 * Speak text aloud
 * @param text Text to speak
 * @param options Speech options
 */
export function speak(
  text: string,
  options?: {
    rate?: number; // 0.1 to 10 (default: 1)
    pitch?: number; // 0 to 2 (default: 1)
    volume?: number; // 0 to 1 (default: 1)
    lang?: string; // Language (default: 'en-US')
  }
): void {
  if (!('speechSynthesis' in window)) {
    console.warn('[TTS] Speech synthesis not supported');
    return;
  }

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  // Create utterance
  const utterance = new SpeechSynthesisUtterance(text);

  // Apply options
  utterance.rate = options?.rate ?? 1.0;
  utterance.pitch = options?.pitch ?? 1.0;
  utterance.volume = options?.volume ?? 1.0;
  utterance.lang = options?.lang ?? 'en-US';

  // Error handling
  utterance.onerror = (event) => {
    console.error('[TTS] Error:', event);
  };

  // Speak
  window.speechSynthesis.speak(utterance);
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Check if text-to-speech is supported
 */
export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

/**
 * Get available voices
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) {
    return [];
  }

  return window.speechSynthesis.getVoices();
}


