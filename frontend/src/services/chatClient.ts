/**
 * Direct client for the AI Gateway's chat endpoints.
 *
 * Bypasses the WebSocket server for the chat flow — the WS server stays useful for real-time
 * non-chat events (compliance alerts, system metrics, analysis progress).
 */

export interface ChatContext {
  realm?: string;
  userId?: string;
  preferredLanguage?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: ChatContext;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  success: boolean;
  strategy?: string;
  toolsCalled?: Array<{ server: string; tool: string }>;
  duration?: number;
  timestamp?: string;
  data?: any;
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: any }
  | { type: 'tool_result'; id: string; name: string; success: boolean; data?: any; error?: string }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }
  | { type: 'done'; toolsCalled: string[]; iterations: number }
  | { type: 'error'; message: string };

export interface StreamHandlers {
  onText?: (delta: string) => void;
  onToolUse?: (event: Extract<StreamEvent, { type: 'tool_use' }>) => void;
  onToolResult?: (event: Extract<StreamEvent, { type: 'tool_result' }>) => void;
  onUsage?: (event: Extract<StreamEvent, { type: 'usage' }>) => void;
  onDone?: (event: Extract<StreamEvent, { type: 'done' }>) => void;
  onError?: (message: string) => void;
}

function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
}

export async function sendChat(req: ChatRequest): Promise<ChatResponse> {
  const url = `${getApiUrl()}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: req.message,
      sessionId: req.sessionId,
      context: req.context
    })
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Chat request failed: ${res.status}`);
  }

  return res.json();
}

/**
 * SSE streaming consumer. Returns full accumulated text after `done`.
 * Throws if the stream errors out or the server returns non-OK before the stream opens.
 */
export async function streamChat(
  req: ChatRequest,
  handlers: StreamHandlers = {},
  signal?: AbortSignal
): Promise<{ text: string; toolsCalled: string[] }> {
  const url = `${getApiUrl()}/api/chat/stream`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: req.message,
      sessionId: req.sessionId,
      context: req.context
    }),
    signal
  });

  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Stream request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';
  let toolsCalled: string[] = [];

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines. Each frame has lines like
    //   event: <name>
    //   data: <json>
    // We split on \n\n and process whatever is complete.
    let sepIdx: number;
    while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);

      const dataLine = frame.split('\n').find(l => l.startsWith('data: '));
      if (!dataLine) continue;

      try {
        const event = JSON.parse(dataLine.slice(6)) as StreamEvent;
        switch (event.type) {
          case 'text':
            accumulated += event.delta;
            handlers.onText?.(event.delta);
            break;
          case 'tool_use':
            handlers.onToolUse?.(event);
            break;
          case 'tool_result':
            handlers.onToolResult?.(event);
            break;
          case 'usage':
            handlers.onUsage?.(event);
            break;
          case 'done':
            toolsCalled = event.toolsCalled;
            handlers.onDone?.(event);
            return { text: accumulated, toolsCalled };
          case 'error':
            handlers.onError?.(event.message);
            throw new Error(event.message);
        }
      } catch (parseErr) {
        // Skip malformed frames rather than aborting the whole stream.
        console.warn('Skipping malformed SSE frame', parseErr);
      }
    }
  }

  return { text: accumulated, toolsCalled };
}

