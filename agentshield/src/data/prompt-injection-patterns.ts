import { ToolDefinition } from '../types/discovery';
import { SeverityLevel } from '../types/findings';

export interface InjectionPattern {
  id: string;
  name: string;
  severity: SeverityLevel;
  score: number;
  owaspCategory: string;
  match: (tool: ToolDefinition) => boolean;
}

export const PROMPT_INJECTION_PATTERNS: InjectionPattern[] = [
  // CRITICAL tier — role takeover (D-02)
  {
    id: 'PI-ROLE-TAKEOVER-01',
    name: 'Role Takeover Payload',
    severity: 'critical',
    score: 9.0,
    owaspCategory: 'MCP06:2025',
    match: (t) =>
      /\b(you are now|act as|pretend (you are|to be)|your (new|true) (role|instructions|persona))\b/i
        .test(`${t.name ?? ''} ${t.description ?? ''}`),
  },
  // HIGH tier — instruction override (D-02)
  {
    id: 'PI-INSTR-OVERRIDE-01',
    name: 'Instruction Override Payload',
    severity: 'high',
    score: 7.5,
    owaspCategory: 'MCP06:2025',
    match: (t) =>
      /\b(ignore (previous|prior|all|above)|disregard (your|previous)|forget (all|your|previous)|override (system|instructions))\b/i
        .test(`${t.name ?? ''} ${t.description ?? ''}`),
  },
  // MEDIUM tier — structural markers (D-02)
  {
    id: 'PI-LONG-DESC-01',
    name: 'Unusually Long Tool Description',
    severity: 'medium',
    score: 4.5,
    owaspCategory: 'MCP06:2025',
    match: (t) => (t.description?.length ?? 0) > 500,
  },
  {
    id: 'PI-BASE64-01',
    name: 'Base64 Blob in Tool Description',
    severity: 'medium',
    score: 5.0,
    owaspCategory: 'MCP06:2025',
    // Require at least one trailing '=' padding character to distinguish real base64 blobs
    // from URL path segments. The previous ={0,2} allowance matched long URL paths such as
    // "https://docs.example.com/api/v1/authentication/oauth2callback/verylongpathhere"
    // because '/' is in the character class. Requiring ={1,2} substantially reduces false
    // positives while still catching typical base64-encoded payloads (WR-04).
    match: (t) => /[A-Za-z0-9+/]{40,}={1,2}/.test(t.description ?? ''),
  },
  {
    id: 'PI-UNICODE-ZWC-01',
    name: 'Unicode Zero-Width Character in Tool Description',
    severity: 'medium',
    score: 5.5,
    owaspCategory: 'MCP06:2025',
    match: (t) => /[​-‍﻿⁠­]/.test(`${t.name ?? ''}${t.description ?? ''}`),
  },
];
