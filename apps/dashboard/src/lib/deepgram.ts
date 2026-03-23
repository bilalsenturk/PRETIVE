export interface DeepgramStream {
  stop: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export function startDeepgramStream(
  apiKey: string,
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (error: Error) => void
): DeepgramStream {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "Deepgram API key not configured. Please set the NEXT_PUBLIC_DEEPGRAM_API_KEY environment variable."
    );
  }

  let mediaRecorder: MediaRecorder | null = null;
  let socket: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let stopped = false;
  let reconnectAttempts = 0;

  function cleanupMediaRecorder() {
    if (mediaRecorder) {
      try {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      } catch {
        // MediaRecorder may already be in an invalid state
      }
      mediaRecorder.ondataavailable = null;
      mediaRecorder = null;
    }
  }

  function cleanupWebSocket() {
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      } catch {
        // Socket may already be closed
      }
      socket = null;
    }
  }

  function cleanupStream() {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Track may already be stopped
        }
      });
      stream = null;
    }
  }

  function cleanupAll() {
    cleanupMediaRecorder();
    cleanupWebSocket();
    cleanupStream();
  }

  function attemptReconnect() {
    if (stopped) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      onError(
        new Error(
          `Deepgram connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Please try again.`
        )
      );
      return;
    }

    reconnectAttempts++;
    cleanupWebSocket();
    cleanupMediaRecorder();

    setTimeout(() => {
      if (stopped) return;
      connectWebSocket();
    }, RECONNECT_DELAY_MS);
  }

  function connectWebSocket() {
    if (stopped || !stream) return;

    try {
      socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-2&language=en&punctuate=true",
        ["token", apiKey]
      );
    } catch (err) {
      onError(
        new Error(
          `Failed to create Deepgram WebSocket connection: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      );
      return;
    }

    socket.onopen = () => {
      if (stopped || !stream) return;
      reconnectAttempts = 0;

      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });
      } catch (err) {
        onError(
          new Error(
            `Failed to create MediaRecorder: ${err instanceof Error ? err.message : "Unknown error"}`
          )
        );
        return;
      }

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (
          event.data.size > 0 &&
          socket &&
          socket.readyState === WebSocket.OPEN
        ) {
          socket.send(event.data);
        }
      };

      mediaRecorder.start(250);
    };

    socket.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          channel?: {
            alternatives?: Array<{ transcript?: string }>;
          };
          is_final?: boolean;
        };
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (transcript && transcript.trim().length > 0) {
          const isFinal = data.is_final === true;
          onTranscript(transcript, isFinal);
        }
      } catch {
        // Malformed messages from Deepgram are non-critical; skip them
      }
    };

    socket.onerror = () => {
      if (stopped) return;
      onError(new Error("Deepgram WebSocket connection error occurred"));
      attemptReconnect();
    };

    socket.onclose = (event: CloseEvent) => {
      if (stopped) return;
      // Code 1000 = normal close; anything else is unexpected
      if (event.code !== 1000) {
        onError(
          new Error(
            `Deepgram connection closed unexpectedly (code: ${event.code})`
          )
        );
        attemptReconnect();
      }
    };
  }

  async function init() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
      ) {
        onError(new Error("Microphone permission required. Please allow microphone access in your browser settings."));
      } else if (
        err instanceof DOMException &&
        err.name === "NotFoundError"
      ) {
        onError(new Error("No microphone found. Please connect a microphone."));
      } else {
        onError(
          err instanceof Error
            ? new Error(`Failed to start audio capture: ${err.message}`)
            : new Error("Failed to start audio capture")
        );
      }
      return;
    }

    connectWebSocket();
  }

  init();

  return {
    stop() {
      stopped = true;
      cleanupAll();
    },
  };
}
