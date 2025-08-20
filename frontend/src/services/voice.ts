import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '@/types/speech-recognition';
import { VoiceCommand } from '@/types/events';

export interface VoiceConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
  hotwordEnabled?: boolean;
  hotwords?: string[];
}

export interface VoiceEventHandlers {
  onResult?: (transcript: string, isFinal: boolean, confidence: number) => void;
  onCommand?: (command: VoiceCommand) => void;
  onHotword?: (transcript: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis | null = null;
  private isListening = false;
  private hotwordMode = false;
  private config: VoiceConfig;
  private handlers: VoiceEventHandlers;

  constructor(config: VoiceConfig = {}, handlers: VoiceEventHandlers = {}) {
    this.config = {
      language: 'de-DE',
      continuous: false,
      interimResults: true,
      maxAlternatives: 3,
      hotwordEnabled: true,
      hotwords: ['hey keycloak', 'hallo keycloak'],
      ...config
    };
    
    this.handlers = handlers;

    if (typeof window !== 'undefined') {
      this.initializeSpeechRecognition();
      this.initializeSpeechSynthesis();
    }
  }

  private initializeSpeechRecognition(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Speech Recognition not supported in this browser');
      this.handlers.onError?.('Speech Recognition wird nicht unterstützt');
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();

    // Configure recognition
    if (this.recognition) {
      this.recognition.lang = this.config.language!;
      this.recognition.continuous = this.config.continuous!;
      this.recognition.interimResults = this.config.interimResults!;
      this.recognition.maxAlternatives = this.config.maxAlternatives!;
    }

    this.setupRecognitionHandlers();
  }

  private initializeSpeechSynthesis(): void {
    if ('speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
    } else {
      console.warn('Speech Synthesis not supported in this browser');
    }
  }

  private setupRecognitionHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      console.log('🎤 Speech recognition started');
      this.handlers.onStart?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.handleSpeechResult(event);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      this.handlers.onError?.(event.error);
      this.stopListening();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('🎤 Speech recognition ended');
      this.handlers.onEnd?.();

      // If hotword mode is active, restart listening
      if (this.hotwordMode) {
        setTimeout(() => {
          this.startListening();
        }, 1000);
      }
    };
  }

  private handleSpeechResult(event: SpeechRecognitionEvent): void {
    let finalTranscript = '';
    let interimTranscript = '';
    let bestConfidence = 0;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence || 1.0;

      if (result.isFinal) {
        finalTranscript += transcript;
        bestConfidence = Math.max(bestConfidence, confidence);
      } else {
        interimTranscript += transcript;
      }
    }

    // Call result handler
    const currentTranscript = finalTranscript || interimTranscript;
    this.handlers.onResult?.(currentTranscript, !!finalTranscript, bestConfidence);

    // Process final transcript
    if (finalTranscript) {
      this.processFinalTranscript(finalTranscript.trim(), bestConfidence);
    }
  }

  private processFinalTranscript(transcript: string, confidence: number): void {
    const lowerTranscript = transcript.toLowerCase();

    console.log('🎯 Processing transcript:', { transcript, confidence });

    // Check for hotwords
    if (this.config.hotwordEnabled) {
      const hotwordDetected = this.config.hotwords!.some(hotword => 
        lowerTranscript.includes(hotword.toLowerCase())
      );

      if (hotwordDetected) {
        console.log('🔥 Hotword detected:', transcript);
        this.handlers.onHotword?.(transcript);

        // Extract command after hotword
        let command = lowerTranscript;
        this.config.hotwords!.forEach(hotword => {
          command = command.replace(hotword.toLowerCase(), '').trim();
        });

        if (command) {
          const voiceCommand: VoiceCommand = {
            command,
            transcript,
            confidence,
            language: this.config.language!,
            timestamp: new Date().toISOString()
          };

          this.handlers.onCommand?.(voiceCommand);
        }
        return;
      }
    }

    // If not in hotword mode or no hotword detected, treat as direct command
    if (!this.hotwordMode || !this.config.hotwordEnabled) {
      const voiceCommand: VoiceCommand = {
        command: transcript,
        transcript,
        confidence,
        language: this.config.language!,
        timestamp: new Date().toISOString()
      };

      this.handlers.onCommand?.(voiceCommand);
    }
  }

  // Public methods
  async startListening(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not initialized');
    }

    if (this.isListening) {
      console.warn('Already listening...');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      this.handlers.onError?.('Fehler beim Starten der Spracherkennung');
      throw error;
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
    this.isListening = false;
  }

  toggleHotwordMode(): boolean {
    this.hotwordMode = !this.hotwordMode;
    
    if (this.hotwordMode) {
      console.log('🔥 Hotword mode activated');
      this.startListening();
    } else {
      console.log('🔥 Hotword mode deactivated');
      this.stopListening();
    }
    
    return this.hotwordMode;
  }

  async speak(text: string, language?: string): Promise<void> {
    if (!this.synthesis) {
      console.warn('Speech synthesis not available');
      return;
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language || this.config.language!;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => {
        console.log('🔊 Speech synthesis completed');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        reject(new Error('Fehler bei der Sprachausgabe'));
      };

      // Cancel any ongoing speech
      if (this.synthesis) {
        this.synthesis.cancel();
        this.synthesis.speak(utterance);
      }
    });
  }

  cancelSpeech(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  // Getters
  getIsListening(): boolean {
    return this.isListening;
  }

  getHotwordMode(): boolean {
    return this.hotwordMode;
  }

  getConfig(): VoiceConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.recognition) {
      this.recognition.lang = this.config.language!;
      this.recognition.continuous = this.config.continuous!;
      this.recognition.interimResults = this.config.interimResults!;
      this.recognition.maxAlternatives = this.config.maxAlternatives!;
    }
  }

  // Update handlers
  updateHandlers(newHandlers: Partial<VoiceEventHandlers>): void {
    this.handlers = { ...this.handlers, ...newHandlers };
  }

  // Cleanup
  destroy(): void {
    this.stopListening();
    this.cancelSpeech();
    this.recognition = null;
    this.synthesis = null;
  }
}

// Utility function to check browser support
export function checkVoiceSupport(): {
  speechRecognition: boolean;
  speechSynthesis: boolean;
} {
  if (typeof window === 'undefined') {
    return { speechRecognition: false, speechSynthesis: false };
  }

  return {
    speechRecognition: 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
    speechSynthesis: 'speechSynthesis' in window
  };
}