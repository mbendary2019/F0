/**
 * Speech Recognition (Browser API)
 * Speech-to-Text for voice commands
 */

/**
 * Start speech recognition
 * @param onText Callback when text is recognized
 * @returns Recognition instance (can call .stop() to end)
 */
export function startRecognition(
  onText: (text: string, isFinal: boolean) => void
): any {
  // Check for browser support
  const SpeechRecognition =
    (window as any).webkitSpeechRecognition ||
    (window as any).SpeechRecognition;

  if (!SpeechRecognition) {
    throw new Error('SpeechRecognition not supported in this browser. Try Chrome.');
  }

  const recognition = new SpeechRecognition();

  // Configuration
  recognition.continuous = false; // Stop after one phrase
  recognition.interimResults = true; // Get partial results
  recognition.lang = 'en-US'; // Language (can be changed)
  recognition.maxAlternatives = 1;

  // Handle results
  recognition.onresult = (event: any) => {
    let finalText = '';
    let interimText = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    // Send final text
    if (finalText) {
      onText(finalText.trim(), true);
    }

    // Send interim text (for live feedback)
    if (interimText) {
      onText(interimText.trim(), false);
    }
  };

  // Error handling
  recognition.onerror = (event: any) => {
    console.error('[SpeechRecognition] Error:', event.error);
    if (event.error === 'no-speech') {
      console.log('[SpeechRecognition] No speech detected');
    }
  };

  // Start recognition
  recognition.start();

  return recognition;
}

/**
 * Check if speech recognition is supported
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).webkitSpeechRecognition ||
    (window as any).SpeechRecognition
  );
}


