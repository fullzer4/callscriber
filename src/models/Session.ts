export type SessionMode = 'realtime' | 'record';

export type SessionStatus = 
  | 'created'
  | 'joining'
  | 'active'
  | 'stopping'
  | 'completed'
  | 'error';

export interface Session {
  id: string;

  mode: SessionMode;

  status: SessionStatus;

  meetingLink: string;

  paths: {
    base: string;
    manifest: string;
    chunks: string;
    transcript?: string;
  };

  createdAt: number;
  startedAt?: number;
  endedAt?: number;

  stats: {
    chunksReceived: number;
    bytesReceived: number;
    totalDurationMs: number;
  };

  error?: {
    message: string;
    code?: string;
  };
}

export function createSession(
  id: string,
  meetingLink: string,
  mode: SessionMode,
  basePath: string,
): Session {
  return {
    id,
    mode,
    status: 'created',
    meetingLink,
    paths: {
      base: basePath,
      manifest: `${basePath}/manifest.json`,
      chunks: `${basePath}/chunks`,
      transcript: mode === 'record' ? `${basePath}/transcript.json` : undefined,
    },
    createdAt: Date.now(),
    stats: {
      chunksReceived: 0,
      bytesReceived: 0,
      totalDurationMs: 0,
    },
  }
}
