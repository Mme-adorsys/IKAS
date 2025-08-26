'use client';

import React, { useState, useMemo } from 'react';
import { useIKASStore } from '@/store';
import { PromptTemplate, PromptCategory } from '@/types/prompts';
import { PromptManager, usePromptManagerKeyboard } from '@/components/prompts/PromptManager';

interface PromptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PromptLibrary({ isOpen, onClose }: PromptLibraryProps) {
  const {
    prompts,
    getFilteredPrompts,
    getFavoritePrompts,
    setFilter,
    setSearchQuery,
    loadPromptToChat,
    toggleFavorite,
    selectPrompt,
    setActiveView,
    deletePrompt
  } = useIKASStore();

  const [activeCategory, setActiveCategory] = useState<PromptCategory | 'favorites' | 'all'>('favorites');
  const [searchTerm, setSearchTerm] = useState('');
  const [promptManager, setPromptManager] = useState<{
    isOpen: boolean;
    mode: 'create' | 'edit';
    editingPrompt?: PromptTemplate;
  }>({ isOpen: false, mode: 'create' });

  // Setup keyboard shortcuts for prompt manager
  usePromptManagerKeyboard(promptManager.isOpen, () => 
    setPromptManager({ isOpen: false, mode: 'create' })
  );

  // Get prompts based on active category
  const displayPrompts = useMemo(() => {
    if (activeCategory === 'favorites') {
      return getFavoritePrompts();
    }
    
    if (activeCategory === 'all') {
      return getFilteredPrompts();
    }
    
    return prompts.prompts.filter(p => p.category === activeCategory);
  }, [activeCategory, prompts.prompts, getFilteredPrompts, getFavoritePrompts]);

  // Filter by search term
  const filteredPrompts = useMemo(() => {
    if (!searchTerm) return displayPrompts;
    
    const term = searchTerm.toLowerCase();
    return displayPrompts.filter(prompt =>
      prompt.title.toLowerCase().includes(term) ||
      prompt.description?.toLowerCase().includes(term) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(term))
    );
  }, [displayPrompts, searchTerm]);

  const handleCategoryChange = (category: PromptCategory | 'favorites' | 'all') => {
    setActiveCategory(category);
    if (category !== 'favorites' && category !== 'all') {
      setFilter({ category });
    } else {
      setFilter({ category: undefined });
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSearchQuery(value);
  };

  const handleLoadPrompt = (prompt: PromptTemplate) => {
    // Check if prompt has required variables without defaults
    const missingVariables = prompt.variables.filter(v => v.required && !v.defaultValue);
    
    if (missingVariables.length > 0) {
      // Select prompt for variable filling
      selectPrompt(prompt);
    } else {
      // Load directly with default values
      const defaultVariables: Record<string, string> = {};
      prompt.variables.forEach(v => {
        if (v.defaultValue) {
          defaultVariables[v.name] = v.defaultValue;
        }
      });
      
      loadPromptToChat(prompt.id, defaultVariables);
      onClose();
    }
  };

  const handleEditPrompt = (prompt: PromptTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setPromptManager({
      isOpen: true,
      mode: 'edit',
      editingPrompt: prompt
    });
  };

  const handleDeletePrompt = (prompt: PromptTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`)) {
      deletePrompt(prompt.id);
    }
  };

  const handleCreateNew = () => {
    setPromptManager({
      isOpen: true,
      mode: 'create'
    });
  };

  const handleCloseManager = () => {
    setPromptManager({ isOpen: false, mode: 'create' });
  };

  const getCategoryIcon = (category: PromptCategory | 'favorites' | 'all') => {
    switch (category) {
      case 'favorites':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        );
      case 'all':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2" />
          </svg>
        );
      case 'sync':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'compliance':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'analysis':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 9a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2" />
          </svg>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="absolute right-0 top-0 h-full w-96 bg-white dark:bg-gray-800 shadow-xl transform transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Prompt Library
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {filteredPrompts.length} prompt{filteredPrompts.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCreateNew}
              className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              title="Create new prompt"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search prompts..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Categories */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {(['favorites', 'all', 'sync', 'compliance', 'analysis', 'management', 'monitoring', 'reporting'] as const).map((category) => (
              <button
                key={category}
                onClick={() => handleCategoryChange(category)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === category
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {getCategoryIcon(category)}
                <span className="ml-1.5 capitalize">{category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Prompts List */}
        <div className="flex-1 overflow-y-auto">
          {filteredPrompts.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 'No prompts match your search' : 'No prompts in this category'}
              </p>
              <button
                onClick={() => setActiveView('prompts')}
                className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                Create your first prompt
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group"
                  onClick={() => handleLoadPrompt(prompt)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {prompt.title}
                        </h3>
                        {prompt.isFavorite && (
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        )}
                      </div>
                      
                      {prompt.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {prompt.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                          {prompt.category}
                        </span>
                        <div className="flex items-center space-x-2 text-xs text-gray-400 dark:text-gray-500">
                          {prompt.variables.length > 0 && (
                            <span>{prompt.variables.length} vars</span>
                          )}
                          {prompt.usageCount > 0 && (
                            <span>Used {prompt.usageCount}x</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(prompt.id);
                        }}
                        className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                        title={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg className="w-4 h-4" fill={prompt.isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleEditPrompt(prompt, e)}
                        className="p-1 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                        title="Edit prompt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => handleDeletePrompt(prompt, e)}
                        className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Delete prompt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCreateNew}
            className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Prompt
          </button>
        </div>
      </div>

      {/* Prompt Manager Modal */}
      <PromptManager
        isOpen={promptManager.isOpen}
        onClose={handleCloseManager}
        editingPrompt={promptManager.editingPrompt}
        mode={promptManager.mode}
      />
    </div>
  );
}