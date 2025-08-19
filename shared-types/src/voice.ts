/**
 * Voice Interface Types
 * Defines interfaces for speech recognition and text-to-speech
 */

export interface VoiceCommand {
  text: string;
  confidence: number;
  language: string;
  timestamp: string;
  sessionId: string;
  hotwordDetected: boolean;
}

export interface VoiceResponse {
  text: string;
  audioUrl?: string;
  language: string;
  speak: boolean;
  timestamp: string;
}

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  hotwords: string[];
}

export interface TextToSpeechConfig {
  language: string;
  voice?: string;
  rate: number;
  pitch: number;
  volume: number;
}

export interface VoiceSessionState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  lastCommand?: VoiceCommand;
  lastResponse?: VoiceResponse;
  errorCount: number;
  sessionStartTime: string;
}

export interface VoiceMetrics {
  totalCommands: number;
  successfulCommands: number;
  averageConfidence: number;
  averageResponseTime: number;
  errorRate: number;
  mostUsedCommands: Array<{
    command: string;
    count: number;
  }>;
}