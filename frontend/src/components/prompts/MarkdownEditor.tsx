'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { PromptVariable } from '@/types/prompts';

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: PromptVariable[];
  placeholder?: string;
  height?: number;
  className?: string;
}

export function MarkdownEditor({
  value,
  onChange,
  variables = [],
  placeholder = "Write your prompt content in markdown...",
  height = 300,
  className = ""
}: MarkdownEditorProps) {
  const [previewMode, setPreviewMode] = useState<'edit' | 'live' | 'preview'>('live');


  const insertVariable = (variableName: string) => {
    const variableTag = `{{${variableName}}}`;
    const textarea = document.querySelector('[data-color-mode] textarea') as HTMLTextAreaElement;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + variableTag + value.substring(end);
      onChange(newValue);
      
      // Set cursor after inserted variable
      setTimeout(() => {
        textarea.setSelectionRange(start + variableTag.length, start + variableTag.length);
        textarea.focus();
      }, 10);
    } else {
      onChange(value + variableTag);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 p-1">
            <button
              type="button"
              onClick={() => setPreviewMode('edit')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                previewMode === 'edit' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('live')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                previewMode === 'live' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Live
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('preview')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                previewMode === 'preview' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Preview
            </button>
          </div>

          {/* Variable Insertion Buttons */}
          {variables.length > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">Variables:</span>
              {variables.map((variable) => (
                <button
                  key={variable.name}
                  type="button"
                  onClick={() => insertVariable(variable.name)}
                  className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  title={variable.description || `Insert {{${variable.name}}}`}
                >
                  {variable.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Character Count */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {value.length} characters
        </div>
      </div>

      {/* Editor */}
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
        <MDEditor
          value={value}
          onChange={(val) => onChange(val || '')}
          data-color-mode="light"
          preview={previewMode}
          hideToolbar={false}
          visibleDragbar={false}
          height={height}
          textareaProps={{
            placeholder: placeholder,
            style: {
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace'
            }
          }}
          previewOptions={{
            // Custom preview with variable substitution
            components: {
              code: ({ children, className }) => {
                const isInline = !className;
                if (isInline) {
                  return (
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  );
                }
                return (
                  <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
                    <code className={className}>{children}</code>
                  </pre>
                );
              }
            }
          }}
        />
      </div>

      {/* Variable Preview */}
      {variables.length > 0 && previewMode !== 'edit' && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-1">
            Preview with example values:
          </div>
          <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
            {variables.map((variable) => (
              <div key={variable.name} className="font-mono">
                <span className="font-semibold">{'{{' + variable.name + '}}'}</span> → {' '}
                <span className="text-yellow-600 dark:text-yellow-400">
                  {variable.defaultValue || 
                   (variable.type === 'realm' ? 'master' :
                    variable.type === 'user' ? 'john.doe' :
                    `[${variable.name}]`)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-4">
          <span>💡 Use **bold** and *italic* for emphasis</span>
          <span>• Use `code` for inline code</span>
          <span>• Use ```code blocks``` for longer code</span>
          {variables.length > 0 && <span>• Click variable buttons to insert {"{{variable}}"}</span>}
        </div>
      </div>
    </div>
  );
}