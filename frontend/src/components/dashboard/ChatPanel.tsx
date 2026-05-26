'use client';

import React from 'react';
import { useIKASStore } from '@/store';
import { ModelSelector } from '../chat/ModelSelector';
import { ChatMessages } from '../chat/ChatMessages';
import { ChatInput } from '../chat/ChatInput';

export function ChatPanel() {
  const {
    chat,
    model,
    clearChatHistory,
    addNotification
  } = useIKASStore();

  const handleClearChat = () => {
    clearChatHistory();
    addNotification({
      type: 'info',
      title: 'Chat Cleared',
      message: 'Chat history has been cleared'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            IKAS Chat
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Send text commands to IKAS and stream responses back.
          </p>
        </div>

        <div className="w-64">
          <ModelSelector />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow h-[calc(100vh-220px)] flex flex-col">
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

        <ChatMessages />
        <ChatInput placeholder="Type your message to IKAS..." />
      </div>
    </div>
  );
}
