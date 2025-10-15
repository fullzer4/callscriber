import { z } from 'zod'

export const CreateSessionRequestSchema = z.object({
  meeting_link: z.string().url('Invalid meeting URL'),
  mode: z.enum(['realtime', 'record']).default('realtime'),
})

export type CreateSessionRequest = z.infer<typeof CreateSessionRequestSchema>;

export const CreateSessionResponseSchema = z.object({
  session_id: z.string(),
  status: z.string(),
  ws_audio_url: z.string(),
  ws_transcript_url: z.string().optional(),
})

export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

export const GetSessionResponseSchema = z.object({
  id: z.string(),
  mode: z.enum(['realtime', 'record']),
  status: z.string(),
  meeting_link: z.string(),
  created_at: z.number(),
  started_at: z.number().optional(),
  ended_at: z.number().optional(),
  stats: z.object({
    chunks_received: z.number(),
    bytes_received: z.number(),
    total_duration_ms: z.number(),
  }),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }).optional(),
})

export type GetSessionResponse = z.infer<typeof GetSessionResponseSchema>;

export const DeleteSessionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
})

export type DeleteSessionResponse = z.infer<typeof DeleteSessionResponseSchema>;

export const ChunkMetaSchema = z.object({
  seq: z.number().int().min(0),
  ts: z.number().int().min(0),
  durMs: z.number().int().positive(),
  mime: z.string(),
  len: z.number().int().positive(),
})

export type ChunkMetaMessage = z.infer<typeof ChunkMetaSchema>;

export const ChunkAckSchema = z.object({
  type: z.literal('chunk.ack'),
  seq: z.number(),
  received_at: z.number(),
})

export type ChunkAckMessage = z.infer<typeof ChunkAckSchema>;

export const TranscriptDeltaSchema = z.object({
  type: z.literal('transcript.delta'),
  text: z.string(),
  ts: z.number(),
})

export type TranscriptDeltaMessage = z.infer<typeof TranscriptDeltaSchema>;

export const TranscriptFinalSchema = z.object({
  type: z.literal('transcript.final'),
  text: z.string(),
  startTs: z.number(),
  endTs: z.number(),
})

export type TranscriptFinalMessage = z.infer<typeof TranscriptFinalSchema>;

export const SessionClosedSchema = z.object({
  type: z.literal('session.closed'),
  reason: z.enum(['user_request', 'meeting_ended', 'error']),
  message: z.string().optional(),
})

export type SessionClosedMessage = z.infer<typeof SessionClosedSchema>;

export const ChunkSavedSchema = z.object({
  type: z.literal('chunk.saved'),
  seq: z.number(),
  sha256: z.string(),
})

export type ChunkSavedMessage = z.infer<typeof ChunkSavedSchema>;

export const TranscriptEventSchema = z.discriminatedUnion('type', [
  TranscriptDeltaSchema,
  TranscriptFinalSchema,
  SessionClosedSchema,
  ChunkSavedSchema,
])

export type TranscriptEvent = z.infer<typeof TranscriptEventSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.any().optional(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
