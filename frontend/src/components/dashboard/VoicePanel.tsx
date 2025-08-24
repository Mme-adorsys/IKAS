'use client';

import React, { useState } from 'react';
import { useIKASStore } from '@/store';
import { ModelSelector } from '../chat/ModelSelector';
import { ChatMessages } from '../chat/ChatMessages';
import { ChatInput } from '../chat/ChatInput';

export function VoicePanel() {
  const {
    voice,
    chat,
    model,
    startListening,
    stopListening,
    toggleHotwordMode,
    clearChatHistory,
    addNotification
  } = useIKASStore();

  const [testMode, setTestMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'voice'>('chat');

  const handleTestCommand = () => {
    setTestMode(true);
    addNotification({
      type: 'info',
      title: 'Test Mode',
      message: 'Sage &ldquo;Hey Keycloak, zeige alle Benutzer&rdquo; zum Testen'
    });
    
    setTimeout(() => {
      setTestMode(false);
    }, 10000);
  };

  const handleClearChat = () => {
    clearChatHistory();
    addNotification({
      type: 'info',
      title: 'Chat Cleared',
      message: 'Chat history has been cleared'
    });
  };

  const sampleCommands = [
    'Hey Keycloak, zeige alle Benutzer',
    'Hey Keycloak, analysiere die Compliance',
    'Hey Keycloak, finde doppelte Benutzer',
    'Hey Keycloak, erstelle einen neuen Benutzer',
    'Hey Keycloak, zeige die letzten Admin-Events',
    'Hey Keycloak, prüfe die Systemmetriken'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            IKAS Interface
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Communicate with IKAS using voice commands or text messages
          </p>
        </div>

        {/* Model Selector */}
        <div className="w-64">
          <ModelSelector />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('chat')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'chat'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>Text Chat</span>
              {chat.messages.length > 0 && (
                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-0.5 rounded-full">
                  {chat.messages.length}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => setActiveTab('voice')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'voice'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <span>Voice Control</span>
              {(voice.isListening || voice.hotwordMode) && (
                <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'chat' ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-96 flex flex-col">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Chat with {model.currentModel?.name || 'AI'}
              </h3>
              {chat.sessionId && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Session: {chat.sessionId.slice(-8)}
                </span>
              )}
            </div>
            
            {chat.messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Chat Messages */}
          <ChatMessages />

          {/* Chat Input */}
          <ChatInput placeholder="Type your message to IKAS..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice Control Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Kontrolle
          </h3>

          {!voice.voiceSupported ? (
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <svg className="mx-auto h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800 dark:text-red-200">
                Spracherkennung wird von diesem Browser nicht unterstützt
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Display */}
              <div className="flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-center">
                  <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                    voice.isListening ? 'bg-red-100 dark:bg-red-900/20' : 
                    voice.hotwordMode ? 'bg-blue-100 dark:bg-blue-900/20' : 
                    'bg-gray-100 dark:bg-gray-600'
                  }`}>
                    <svg className={`h-6 w-6 ${
                      voice.isListening ? 'text-red-600 dark:text-red-400' :
                      voice.hotwordMode ? 'text-blue-600 dark:text-blue-400' :
                      'text-gray-400'
                    }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <p className={`text-sm font-medium ${
                    voice.isListening ? 'text-red-700 dark:text-red-300' :
                    voice.hotwordMode ? 'text-blue-700 dark:text-blue-300' :
                    'text-gray-600 dark:text-gray-400'
                  }`}>
                    {voice.isListening ? 'Hört zu...' :
                     voice.hotwordMode ? 'Wartet auf &ldquo;Hey Keycloak&rdquo;' :
                     'Inaktiv'}
                  </p>
                  
                  {voice.currentTranscript && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      &ldquo;{voice.currentTranscript}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Control Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={voice.isListening ? stopListening : startListening}
                  className={`flex items-center justify-center p-3 rounded-lg text-sm font-medium transition-colors ${
                    voice.isListening 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30'
                  }`}
                >
                  {voice.isListening ? 'Stoppen' : 'Hören'}
                </button>

                <button
                  onClick={toggleHotwordMode}
                  className={`flex items-center justify-center p-3 rounded-lg text-sm font-medium transition-colors ${
                    voice.hotwordMode
                      ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:hover:bg-purple-900/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'
                  }`}
                >
                  {voice.hotwordMode ? 'Hotword An' : 'Hotword Aus'}
                </button>
              </div>

              {/* Test Mode */}
              <button
                onClick={handleTestCommand}
                disabled={testMode}
                className={`w-full p-3 rounded-lg text-sm font-medium transition-colors ${
                  testMode
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-600 dark:text-gray-500'
                    : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30'
                }`}
              >
                {testMode ? 'Test läuft...' : 'Test Sprachbefehl'}
              </button>
            </div>
          )}
        </div>

        {/* Voice History and Commands */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Befehle & Verlauf
          </h3>

          {/* Last Command */}
          {voice.lastCommand && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Letzter Befehl:
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                &ldquo;{voice.lastCommand.command}&rdquo;
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Vertrauen: {Math.round((voice.lastCommand.confidence || 0) * 100)}%
              </p>
            </div>
          )}

          {/* Last Response */}
          {voice.lastResponse && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-green-900 dark:text-green-200">
                Letzte Antwort:
              </p>
              <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                {voice.lastResponse}
              </p>
            </div>
          )}

          {/* Sample Commands */}
          <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              Beispielbefehle:
            </p>
            
            <div className="space-y-2">
              {sampleCommands.map((command, index) => (
                <div
                  key={index}
                  className="p-2 text-xs bg-gray-50 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-300 font-mono"
                >
                  {command}
                </div>
              ))}
            </div>
          </div>

          {/* Usage Tips */}
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-1">
              💡 Tipps:
            </p>
            <ul className="text-xs text-yellow-800 dark:text-yellow-300 space-y-1">
              <li>• Spreche deutlich und nicht zu schnell</li>
              <li>• Nutze &ldquo;Hey Keycloak&rdquo; als Hotword</li>
              <li>• Warte auf die Bestätigung bevor du weitersprichst</li>
              <li>• Chrome/Edge bieten die beste Unterstützung</li>
            </ul>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}