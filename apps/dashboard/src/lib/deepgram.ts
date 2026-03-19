export interface DeepgramStream {
  stop: () => void;
}

export function startDeepgramStream(
  apiKey: string,
  onTranscript: (text: string, isFinal: boolean) => void,
  onError: (error: Error) => void
): DeepgramStream {
  let mediaRecorder: MediaRecorder | null = null;
  let socket: WebSocket | null = null;
  let stream: MediaStream | null = null;
  let stopped = false;

  async function init() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen?model=nova-2&language=tr&punctuate=true",
        ["token", apiKey]
      );

      socket.onopen = () => {
        if (stopped || !stream) return;

        mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm",
        });

        mediaRecorder.ondataavailable = (event) => {
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

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const transcript = data?.channel?.alternatives?.[0]?.transcript;
          if (transcript && transcript.trim().length > 0) {
            const isFinal = data.is_final === true;
            onTranscript(transcript, isFinal);
          }
        } catch {
          // Ignore malformed messages
        }
      };

      socket.onerror = () => {
        onError(new Error("Deepgram WebSocket connection error"));
      };

      socket.onclose = (event) => {
        if (!stopped) {
          onError(
            new Error(
              `Deepgram connection closed unexpectedly (code: ${event.code})`
            )
          );
        }
      };
    } catch (err) {
      onError(
        err instanceof Error ? err : new Error("Failed to start audio capture")
      );
    }
  }

  init();

  return {
    stop() {
      stopped = true;

      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      mediaRecorder = null;

      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socket = null;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      stream = null;
    },
  };
}
