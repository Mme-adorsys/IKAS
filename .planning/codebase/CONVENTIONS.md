# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- React components: PascalCase with `.tsx` extension, e.g., `VoicePanel.tsx`, `IKASDashboard.tsx`
- Services: camelCase with descriptive names, e.g., `websocket.ts`, `voice.ts`, `logger.ts`
- Type/interface files: camelCase with descriptive names, e.g., `orchestration.ts`, `events.ts`, `mcp.ts`
- Test files: Same name as source file with `.test.ts` or `.test.tsx`, e.g., `VoicePanel.test.tsx`, `websocket.test.ts`
- Store files: `index.ts` in store directory for Zustand stores

**Functions:**
- Camel case: `determineExecutionStrategy`, `checkGraphDataFreshness`, `handleTestCommand`
- Async functions follow same naming: `startAnalysis`, `sendVoiceCommand`
- Event handlers: `handle` prefix, e.g., `handleTestCommand`, `handleStartListening`
- Service methods: Verb-based descriptive names, e.g., `startListening`, `stopListening`, `toggleHotwordMode`

**Variables:**
- Camel case throughout: `userInput`, `isListening`, `currentTranscript`, `lastCommand`
- Boolean variables: `is` or `has` prefix, e.g., `isListening`, `hasError`, `voiceSupported`
- Constants: UPPER_SNAKE_CASE, e.g., `EXECUTION_STRATEGY`, `FRESHNESS_THRESHOLD`
- State objects: Use descriptive names matching their domain, e.g., `voice`, `system`, `events`

**Types:**
- Interfaces: PascalCase, e.g., `VoiceState`, `SystemStatus`, `RoutingPattern`, `OrchestrationRequest`
- Enums: PascalCase values, e.g., `ExecutionStrategy.KEYCLOAK_FRESH_DATA`, `EventType.VOICE_COMMAND`
- Generic type parameters: Single uppercase letters or descriptive PascalCase, e.g., `T`, `Response`, `RequestData`

## Code Style

**Formatting:**
- No explicit formatter configured (Prettier not enforced in config)
- Indentation: 2 spaces (observed in all source files)
- Line length: No enforced limit, but typically under 120 characters
- Semicolons: Required at end of statements
- Quotes: Single quotes in most places, but double quotes acceptable in JSX

**Linting:**
- Tool: ESLint with Next.js core rules for frontend, TypeScript ESLint for backend
- Frontend ESLint config (`frontend/.eslintrc.json`):
  - Extends: `next/core-web-vitals`
  - No explicit `any` types disallowed (off)
  - Unused variables with `_` prefix ignored
  - React unescaped entities as error
- AI Gateway ESLint config (`ai-gateway/.eslintrc.json`):
  - Root: true
  - Parser: @typescript-eslint/parser
  - Extends: eslint:recommended, @typescript-eslint/recommended, @typescript-eslint/recommended-requiring-type-checking
  - Unused variables treated as errors (with `_` prefix exemption)
  - Explicit function return types: warning
  - `any` types: warning
  - Prefer const: error
  - Inferrable types: off

## Import Organization

**Order:**
1. External dependencies (from node_modules): `import express from 'express'`, `import React from 'react'`
2. Type imports: `import type { VoiceState } from '@/types/events'`
3. Absolute imports with path aliases: `import { useIKASStore } from '@/store'`, `import { VoiceService } from '@/services/voice'`
4. Relative imports: `import { IntelligentRouter } from '../orchestration/routing'`
5. Blank line between groups

**Path Aliases:**
- Frontend: `@/` maps to `frontend/src/`
- AI Gateway: `@/` pattern used for internal imports (tsconfig.json configured)
- Shared-types: Direct import paths maintained

**Example:**
```typescript
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

import type { OrchestrationRequest, ExecutionStrategy } from '@/types';

import { logger } from '@/utils/logger';
import { IntelligentRouter } from '@/orchestration/routing';

import { someLocalHelper } from '../helpers/local';
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations: Common pattern throughout codebase
- Error logging with context: All errors logged with Winston logger including message, stack, and metadata
- Error objects: Caught errors checked with `error instanceof Error` pattern before accessing `.message`
- Graceful fallbacks: Services handle unavailable MCPs with fallback strategies
- Error responses: Sent as JSON with `{ error: string, message?: string }` structure

**Example from `ai-gateway/src/main.ts`:**
```typescript
try {
  // Operation
} catch (error) {
  logger.error('Error description', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    context: additionalContext
  });
  // Handle or respond
}
```

## Logging

**Framework:** Winston with component-specific loggers

**Transport Outputs:**
- `logs/combined.log` - All logs with unified formatting
- `logs/gemini.log` - Gemini LLM operations with component-specific format
- `logs/mcp.log` - MCP service calls with component-specific format
- `logs/error.log` - Error level logs only
- Console output in development with colored formatting

**Patterns:**
- Development: Pretty-printed format with timestamp, log level, request ID, and metadata
- Production: JSON format for machine readability
- Logger instances: `logger`, `geminiLogger`, `mcpLogger` used in appropriate contexts

**Log Metadata Structure:**
```typescript
logger.info('Operation description', {
  requestId: '9d7c8db5',
  duration: '1234ms',
  userId: 'user-id',
  realm: 'master',
  toolsCalled: ['keycloak_list-users'],
  success: true
});
```

## Comments

**When to Comment:**
- Complex orchestration logic with decision paths
- Non-obvious algorithm implementations
- Important business rules or constraints
- Workarounds for known issues
- Clarification of ambiguous type definitions

**JSDoc/TSDoc:**
- Not widely used, limited to function declarations
- TypeScript interfaces provide implicit documentation
- Service methods have inline comments explaining strategy

**Example from routing service:**
```typescript
// Check for write operations (always route to Keycloak first)
if (this.containsKeywords(userLower, this.patterns.writeKeywords)) {
  logger.info('Detected write operation, using KEYCLOAK_WRITE_THEN_SYNC strategy');
  return ExecutionStrategy.KEYCLOAK_WRITE_THEN_SYNC;
}
```

## Function Design

**Size:** Functions typically 20-50 lines for orchestration logic, 10-20 lines for utility functions

**Parameters:**
- Named parameters preferred over positional, especially for complex functions
- Use object destructuring for multiple parameters: `{ realm?: string }`
- Optional parameters marked with `?` in interfaces

**Return Values:**
- Async functions return Promises with typed results: `async function(): Promise<ExecutionStrategy>`
- Union return types used for error scenarios: `Promise<Result | Error>`
- Status objects return structured data: `{ success: boolean, data?: T, error?: string }`

**Example:**
```typescript
async determineExecutionStrategy(
  userInput: string, 
  context?: { realm?: string }
): Promise<ExecutionStrategy> {
  // Implementation
}
```

## Module Design

**Exports:**
- Default exports for React components: `export default function Home()`
- Named exports for services and utilities: `export class IntelligentRouter`, `export const logger`
- Type exports with `export type`: `export type OrchestrationRequest = { ... }`

**Barrel Files:**
- Used in type definitions: `ai-gateway/src/types/index.ts` exports all types
- Services directory doesn't use barrel files, imports are direct
- Components import directly from specific component files

**Module Structure Pattern:**
```typescript
// src/orchestration/routing.ts - Class-based service
export class IntelligentRouter {
  private patterns: RoutingPattern;
  async determineExecutionStrategy(...): Promise<ExecutionStrategy> { }
}

// src/utils/logger.ts - Exported instances and classes
export const logger = winston.createLogger({ ... });
export class RequestTracker { }
export const geminiLogger = winston.createLogger({ ... });
```

---

*Convention analysis: 2026-04-29*
