"use client";

/**
 * Speech recognition client using the Web Speech API.
 *
 * Free, no API key required — works in Chrome/Edge (uses Google's speech servers).
 */

export interface SpeechStream {
  stop: () => void;
}

// Web Speech API types (not in all TS libs)
/* eslint-disable @typescript-eslint/no-explicit-any */
interface SpeechWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * Start speech recognition using the Web Speech API.
 *
 * Same callback interface as the old Deepgram integration — live page
 * doesn't need to change.
 */
export function startSpeechStream(
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (error: Error) => void,
): SpeechStream {
  const win = window as unknown as SpeechWindow;
  const SpeechRecognitionAPI =
    win.SpeechRecognition ?? win.webkitSpeechRecognition;

  if (!SpeechRecognitionAPI) {
    onError(
      new Error(
        "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
      ),
    );
    return { stop: () => {} };
  }

  let stopped = false;

  const recognition = new SpeechRecognitionAPI();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    if (stopped) return;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript.trim();
      if (transcript) {
        onTranscript(transcript, result.isFinal);
      }
    }
  };

  recognition.onerror = (event: any) => {
    if (stopped) return;

    const errorMessages: Record<string, string> = {
      "not-allowed": "Microphone permission required. Please allow microphone access.",
      "no-speech": "No speech detected. Please try speaking louder.",
      "audio-capture": "No microphone found. Please check your audio device.",
      "network": "Network error during speech recognition.",
      "aborted": "Speech recognition was aborted.",
      "service-not-allowed": "Speech recognition service is not available.",
    };

    const message =
      errorMessages[event.error] ?? `Speech recognition error: ${event.error}`;

    // Non-fatal errors — just warn and let auto-restart handle it
    if (event.error === "no-speech" || event.error === "aborted") {
      console.warn(`[Speech] ${message}`);
      return;
    }

    onError(new Error(message));
  };

  // Auto-restart on end (browser stops after silence)
  recognition.onend = () => {
    if (!stopped) {
      try {
        recognition.start();
      } catch {
        // Already started or blocked
      }
    }
  };

  try {
    recognition.start();
  } catch (err) {
    onError(
      new Error(
        err instanceof Error ? err.message : "Failed to start speech recognition",
      ),
    );
  }

  return {
    stop: () => {
      stopped = true;
      try {
        recognition.stop();
      } catch {
        // Already stopped
      }
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    },
  };
}
