'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useIKASStore } from '@/store';

interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'response' | 'error';
  content: string;
  timestamp: Date;
  details?: any;
}

export function ChatPanel() {
  const { system } = useIKASStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'system',
      content: 'IKAS Chat Interface ready. You can test Keycloak MCP commands here.',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const addMessage = (type: ChatMessage['type'], content: string, details?: any) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      details
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Add user message
    addMessage('user', userMessage);

    try {
      // Call AI Gateway API directly
      const response = await fetch('http://localhost:8005/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: system.sessionId || 'chat-session',
          language: 'en-US'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Handle successful response
      if (result.success && result.response) {
        addMessage('response', result.response, result);
      } else if (result.error) {
        addMessage('error', result.error);
      } else {
        addMessage('response', 'Command processed successfully');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addMessage('error', `Error sending command: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickCommand = (command: string) => {
    setInputValue(command);
  };

  const quickCommands = [
    'list all users',
    'show metrics', 
    'list realms',
    'create user test.user',
    'get user admin',
    'show system status'
  ];

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getMessageStyle = (type: ChatMessage['type']) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 dark:bg-blue-900 border-l-blue-500 text-blue-900 dark:text-blue-100';
      case 'system':
        return 'bg-gray-100 dark:bg-gray-700 border-l-gray-500 text-gray-900 dark:text-gray-100';
      case 'response':
        return 'bg-green-100 dark:bg-green-900 border-l-green-500 text-green-900 dark:text-green-100';
      case 'error':
        return 'bg-red-100 dark:bg-red-900 border-l-red-500 text-red-900 dark:text-red-100';
      default:
        return 'bg-gray-100 dark:bg-gray-700 border-l-gray-500 text-gray-900 dark:text-gray-100';
    }
  };

  const getMessageIcon = (type: ChatMessage['type']) => {
    switch (type) {
      case 'user':
        return '👤';
      case 'system':
        return '🤖';
      case 'response':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '💬';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              💬 IKAS Chat Interface
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Test Keycloak MCP commands directly
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              system.websocketConnected ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {system.websocketConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Commands */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Commands:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickCommands.map((command, index) => (
            <button
              key={index}
              onClick={() => handleQuickCommand(command)}
              className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              {command}
            </button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50 dark:bg-gray-900">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`border-l-4 rounded-r-lg p-4 ${getMessageStyle(message.type)}`}
          >
            <div className="flex items-start space-x-3">
              <span className="text-lg">{getMessageIcon(message.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium capitalize">
                    {message.type}
                  </span>
                  <span className="text-xs opacity-75">
                    {formatTimestamp(message.timestamp)}
                  </span>
                </div>
                <p className="text-sm font-mono break-words">
                  {message.content}
                </p>
                {message.details && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs opacity-75 hover:opacity-100">
                      Show Details
                    </summary>
                    <pre className="mt-2 text-xs bg-black bg-opacity-10 dark:bg-white dark:bg-opacity-10 p-2 rounded overflow-auto">
                      {JSON.stringify(message.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="border-l-4 border-l-yellow-500 bg-yellow-100 dark:bg-yellow-900 rounded-r-lg p-4">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent"></div>
              <span className="text-sm text-yellow-800 dark:text-yellow-200">
                Processing command...
              </span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your IKAS command here... (e.g., 'list all users')"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              disabled={!system.websocketConnected || isLoading}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !system.websocketConnected || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>
        
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Press Enter to send • Shift+Enter for new line</span>
          <span>
            {system.websocketConnected ? '🟢 WebSocket Connected' : '🔴 WebSocket Disconnected'}
          </span>
        </div>
      </div>
    </div>
  );
}