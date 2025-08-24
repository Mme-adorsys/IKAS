'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useIKASStore } from '@/store';

interface ChatInputProps {
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
}

export function ChatInput({ 
  placeholder = "Type your message...", 
  disabled = false, 
  maxLength = 1000 
}: ChatInputProps) {
  const { 
    chat, 
    model,
    sendTextMessage, 
    updateTextInput 
  } = useIKASStore();

  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [chat.textInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chat.textInput.trim() || chat.isLoading || disabled) {
      return;
    }

    await sendTextMessage(chat.textInput);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      updateTextInput(value);
    }
  };

  const isSubmitDisabled = !chat.textInput.trim() || chat.isLoading || disabled;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <form onSubmit={handleSubmit} className="p-4">
        <div className={`relative flex items-end space-x-3 rounded-lg border transition-colors ${
          isFocused 
            ? 'border-blue-500 dark:border-blue-400' 
            : 'border-gray-300 dark:border-gray-600'
        } ${disabled ? 'opacity-50' : ''}`}>
          
          {/* Text Input Area */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={chat.textInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled || chat.isLoading}
              rows={1}
              className="w-full px-3 py-3 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            
            {/* Character count */}
            {chat.textInput && (
              <div className="absolute bottom-1 right-1 text-xs text-gray-400">
                {chat.textInput.length}/{maxLength}
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
              isSubmitDisabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
          >
            {chat.isLoading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>

        {/* Model indicator and shortcuts */}
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-2">
            {model.currentModel && (
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${
                  model.currentModel.available ? 'bg-green-400' : 'bg-red-400'
                }`}></div>
                <span>{model.currentModel.name}</span>
              </div>
            )}
            
            {model.isLoading && (
              <span className="text-blue-500">Switching model...</span>
            )}
          </div>
          
          <div className="hidden sm:block">
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd>
            <span className="ml-1">to send</span>
            <span className="ml-2">•</span>
            <kbd className="ml-2 px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">Shift + Enter</kbd>
            <span className="ml-1">for new line</span>
          </div>
        </div>
      </form>
    </div>
  );
}