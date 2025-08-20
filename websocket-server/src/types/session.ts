import { z } from 'zod';

// Session Information Schema
export const SessionSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  realm: z.string().optional(),
  socketId: z.string(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  connectedAt: z.date(),
  lastActivity: z.date(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
  subscriptions: z.array(z.string()).default([]),
  language: z.string().default('de-DE')
});

export type Session = z.infer<typeof SessionSchema>;

// Room Configuration Schema
export const RoomConfigSchema = z.object({
  name: z.string(),
  type: z.enum(['user', 'realm', 'analysis', 'global']),
  maxMembers: z.number().optional(),
  requiresAuth: z.boolean().default(false),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export type RoomConfig = z.infer<typeof RoomConfigSchema>;

// Subscription Schema
export const SubscriptionSchema = z.object({
  sessionId: z.string(),
  eventTypes: z.array(z.string()),
  filters: z.record(z.any()).optional(),
  room: z.string().optional(),
  active: z.boolean().default(true)
});

export type Subscription = z.infer<typeof SubscriptionSchema>;