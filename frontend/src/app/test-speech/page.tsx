'use client';

import { useState, useEffect } from 'react';
import { VoiceService } from '@/services/voice';

export default function TestSpeechPage() {
  const [voiceService, setVoiceService] = useState<VoiceService | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        addLog('Initializing Voice Service...');
        
        const service = new VoiceService(
          {
            language: 'en-US',
            continuous: false,
            interimResults: true,
            hotwordEnabled: true,
            hotwords: ['ikas', 'hey ikas']
          },
          {
            onResult: (text, isFinal, confidence) => {
              setTranscript(text);
              addLog(`Voice result: "${text}" (final: ${isFinal}, confidence: ${confidence})`);
            },
            onCommand: async (command) => {
              addLog(`Voice command detected: ${command.command}`);
            },
            onHotword: (text) => {
              addLog(`Hotword detected: "${text}"`);
            },
            onStart: () => {
              setIsListening(true);
              addLog('Voice recognition started');
            },
            onEnd: () => {
              setIsListening(false);
              addLog('Voice recognition ended');
            },
            onError: (error) => {
              setError(error);
              addLog(`Voice error: ${error}`);
            }
          }
        );

        setVoiceService(service);
        addLog('Voice Service initialized successfully');
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        addLog(`Initialization error: ${errorMsg}`);
      }
    }
  }, []);

  const startListening = () => {
    if (voiceService) {
      addLog('Starting voice recognition...');
      voiceService.startListening();
    }
  };

  const stopListening = () => {
    if (voiceService) {
      addLog('Stopping voice recognition...');
      voiceService.stopListening();
    }
  };

  const testSpeech = async () => {
    if (voiceService) {
      try {
        addLog('Testing speech synthesis...');
        await voiceService.speak('Hello, this is a speech synthesis test in English.');
        addLog('Speech synthesis completed');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        addLog(`Speech synthesis error: ${errorMsg}`);
      }
    }
  };

  const testHotword = () => {
    if (voiceService) {
      addLog('Toggling hotword mode...');
      const enabled = voiceService.toggleHotwordMode();
      addLog(`Hotword mode: ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Speech Functionality Test</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Controls</h2>
          
          <div className="space-y-2">
            <button
              onClick={startListening}
              disabled={isListening || !voiceService}
              className="w-full bg-blue-500 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded"
            >
              {isListening ? 'Listening...' : 'Start Listening'}
            </button>
            
            <button
              onClick={stopListening}
              disabled={!isListening || !voiceService}
              className="w-full bg-red-500 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded"
            >
              Stop Listening
            </button>
            
            <button
              onClick={testSpeech}
              disabled={!voiceService}
              className="w-full bg-green-500 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded"
            >
              Test Speech Synthesis
            </button>
            
            <button
              onClick={testHotword}
              disabled={!voiceService}
              className="w-full bg-purple-500 hover:bg-purple-700 disabled:bg-gray-300 text-white font-bold py-2 px-4 rounded"
            >
              Toggle Hotword Mode
            </button>
          </div>

          <div className="mt-4">
            <h3 className="font-semibold">Current Transcript:</h3>
            <div className="bg-gray-100 p-3 rounded min-h-[60px] break-words">
              {transcript || 'No speech detected yet...'}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Activity Log</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded max-h-96 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No activity yet...</div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <h3 className="font-semibold">Instructions for testing:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Click "Start Listening" and say something in English</li>
          <li>Try saying "ikas" or "hey ikas" to test hotword detection</li>
          <li>Use "Test Speech Synthesis" to hear English text-to-speech</li>
          <li>Monitor the Activity Log for any errors</li>
        </ul>
      </div>
    </div>
  );
}