'use client';

import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useIKASStore } from '@/store';

interface MessageContentProps {
  content: string;
  messageType: 'user' | 'assistant' | 'system';
}

function MessageContent({ content, messageType }: MessageContentProps) {
  // Check if content contains markdown syntax
  const hasMarkdown = /[*_#`\[\]()>-]/.test(content) || content.includes('\n\n');

  if (!hasMarkdown) {
    return (
      <div className="text-sm whitespace-pre-wrap break-words">
        {content}
      </div>
    );
  }

  return (
    <div className="text-sm max-w-none break-words">
      <ReactMarkdown
        components={{
          // Custom styling for different elements
          h1: ({ children }) => <h1 className="text-lg font-bold mb-3 mt-4 first:mt-0 text-current">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0 text-current">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-2 mt-3 first:mt-0 text-current">{children}</h3>,
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="ml-4 mb-3 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 mb-3 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono border">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-black/10 dark:bg-white/10 p-3 rounded text-xs font-mono overflow-x-auto border">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-black/10 dark:bg-white/10 p-3 rounded overflow-x-auto mb-3 border">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-current/30 pl-4 italic mb-3 opacity-80">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="border-current/20 my-4" />,
          a: ({ children, href }) => (
            <a 
              href={href} 
              className="text-blue-600 dark:text-blue-400 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function ChatMessages() {
  const { chat } = useIKASStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat.messages]);

  if (chat.messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm">Start a conversation</p>
          <p className="text-xs mt-1">Type a message to start chatting with IKAS</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-4 p-4">
      {chat.messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.type === 'user'
                ? 'bg-blue-600 text-white'
                : message.type === 'system'
                ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
            }`}
          >
            {/* Message Content */}
            <MessageContent 
              content={message.content}
              messageType={message.type}
            />

            {/* Message Metadata */}
            <div
              className={`flex items-center justify-between text-xs mt-2 ${
                message.type === 'user'
                  ? 'text-blue-200'
                  : message.type === 'system'
                  ? 'text-red-500 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span>
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
                
                {message.model && (
                  <>
                    <span>•</span>
                    <span>{message.model}</span>
                  </>
                )}
              </div>

              {/* Token Usage */}
              {message.tokens && (
                <div className="flex items-center space-x-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>{message.tokens.total.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      
      {/* Typing indicator */}
      {chat.isLoading && (
        <div className="flex justify-start">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-1">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">AI is thinking...</span>
            </div>
          </div>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}