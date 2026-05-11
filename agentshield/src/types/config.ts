import { z } from 'zod';

export const STAGE_IDS = [
  'discovery',
  'staticAnalysis',
  'dynamicTesting',
  'runtimeMonitoring',
  'report',
] as const;

export type StageId = typeof STAGE_IDS[number];

export const AuthConfigSchema = z.object({
  apiKey: z.string().optional(),
  token: z.string().optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

export const AgentShieldConfigSchema = z.object({
  target: z.string().url({ message: 'target must be a valid URL' }),
  allowedServers: z
    .array(z.string().url({ message: 'each allowedServer must be a valid URL' }))
    .default([]),
  auth: AuthConfigSchema.optional(),
  outputDir: z.string().default('./agentshield-output'),
  stages: z.array(z.enum(STAGE_IDS)).default([...STAGE_IDS]),
  configPaths: z.array(z.string()).optional(),
});

export type AgentShieldConfig = z.infer<typeof AgentShieldConfigSchema>;
