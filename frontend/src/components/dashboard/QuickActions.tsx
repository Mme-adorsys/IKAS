'use client';

import React, { useState } from 'react';
import { useIKASStore } from '@/store';
import { PromptCategory } from '@/types/prompts';

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className = '' }: QuickActionsProps) {
  const { 
    prompts,
    getFavoritePrompts,
    executePrompt,
    addNotification,
    setActiveView
  } = useIKASStore();
  
  const [executingPrompt, setExecutingPrompt] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const favoritePrompts = getFavoritePrompts();
  const allPrompts = prompts.prompts;

  const getCategoryIcon = (category: PromptCategory) => {
    switch (category) {
      case 'sync':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'compliance':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'analysis':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'management':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
          </svg>
        );
      case 'monitoring':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'reporting':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        );
    }
  };

  const getCategoryColor = (category: PromptCategory) => {
    switch (category) {
      case 'sync':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30';
      case 'compliance':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30';
      case 'analysis':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30';
      case 'management':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/30';
      case 'monitoring':
        return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30';
      case 'reporting':
        return 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/30';
      default:
        return 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600';
    }
  };

  const handleExecutePrompt = async (promptId: string) => {
    const prompt = allPrompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Check if prompt has variables that need to be filled
    if (prompt.variables.some(v => v.required && !v.defaultValue)) {
      addNotification({
        type: 'info',
        title: 'Variables Required',
        message: `Prompt "${prompt.title}" requires variables. Loading to chat for customization.`
      });
      setActiveView('voice');
      // Switch to chat tab and load prompt
      return;
    }

    setExecutingPrompt(promptId);
    
    try {
      // Use default values for variables
      const variables: Record<string, string> = {};
      prompt.variables.forEach(variable => {
        if (variable.defaultValue) {
          variables[variable.name] = variable.defaultValue;
        }
      });

      await executePrompt(promptId, variables);
      
      // Switch to voice/chat view to show results
      setActiveView('voice');
      
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Execution Failed',
        message: error instanceof Error ? error.message : 'Failed to execute prompt'
      });
    } finally {
      setExecutingPrompt(null);
    }
  };

  const displayPrompts = showAll ? allPrompts.slice(0, 12) : favoritePrompts;

  if (displayPrompts.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Quick Actions
          </h3>
          <button
            onClick={() => setActiveView('prompts')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Manage Prompts
          </button>
        </div>
        
        <div className="text-center py-8">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No prompts available yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Create your first prompt to see quick actions here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Quick Actions
          {!showAll && favoritePrompts.length > 0 && (
            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
              Favorites
            </span>
          )}
        </h3>
        
        <div className="flex items-center space-x-2">
          {allPrompts.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {showAll ? 'Show Favorites' : 'Show All'}
            </button>
          )}
          <button
            onClick={() => setActiveView('prompts')}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Manage
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className={`relative group cursor-pointer p-4 rounded-lg transition-all duration-200 ${getCategoryColor(prompt.category)}`}
            onClick={() => handleExecutePrompt(prompt.id)}
          >
            {/* Execution indicator */}
            {executingPrompt === prompt.id && (
              <div className="absolute inset-0 bg-black/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {/* Favorite indicator */}
            {prompt.isFavorite && (
              <div className="absolute top-2 right-2 opacity-70">
                <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            )}
            
            <div className="flex items-start space-x-3">
              {/* Category icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getCategoryIcon(prompt.category)}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {prompt.title}
                </p>
                {prompt.description && (
                  <p className="text-xs opacity-75 mt-1 line-clamp-2">
                    {prompt.description}
                  </p>
                )}
                
                {/* Usage count and category */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-60 capitalize">
                    {prompt.category}
                  </span>
                  {prompt.usageCount > 0 && (
                    <span className="text-xs opacity-60">
                      Used {prompt.usageCount} times
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Variables indicator */}
            {prompt.variables.length > 0 && (
              <div className="mt-2 flex items-center text-xs opacity-60">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>{prompt.variables.length} variable{prompt.variables.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Hover effect */}
            <div className="absolute inset-0 rounded-lg ring-2 ring-transparent group-hover:ring-current group-hover:ring-opacity-20 transition-all duration-200" />
          </div>
        ))}
      </div>

      {/* Add new prompt button */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveView('prompts')}
          className="w-full flex items-center justify-center p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="text-sm font-medium">Create New Prompt</span>
        </button>
      </div>
    </div>
  );
}