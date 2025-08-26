'use client';

import React, { useState, useMemo } from 'react';
import { useIKASStore } from '@/store';
import { PromptTemplate, PromptCategory } from '@/types/prompts';
import { PromptManager, usePromptManagerKeyboard } from '@/components/prompts/PromptManager';

export function PromptManagementView() {
  const {
    prompts,
    getFavoritePrompts,
    setFilter,
    deletePrompt,
    toggleFavorite
  } = useIKASStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<PromptCategory | 'favorites' | 'all'>('all');
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
    let basePrompts: PromptTemplate[] = [];
    
    if (activeCategory === 'favorites') {
      basePrompts = getFavoritePrompts();
    } else if (activeCategory === 'all') {
      basePrompts = prompts.prompts;
    } else {
      basePrompts = prompts.prompts.filter(p => p.category === activeCategory);
    }
    
    // Apply search filter
    if (!searchTerm) return basePrompts;
    
    const term = searchTerm.toLowerCase();
    return basePrompts.filter(prompt =>
      prompt.title.toLowerCase().includes(term) ||
      prompt.description?.toLowerCase().includes(term) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(term)) ||
      prompt.category.toLowerCase().includes(term)
    );
  }, [prompts.prompts, activeCategory, searchTerm, getFavoritePrompts]);

  const handleCategoryChange = (category: PromptCategory | 'favorites' | 'all') => {
    setActiveCategory(category);
    if (category !== 'favorites' && category !== 'all') {
      setFilter({ category });
    } else {
      setFilter({ category: undefined });
    }
  };

  const handleCreateNew = () => {
    setPromptManager({
      isOpen: true,
      mode: 'create'
    });
  };

  const handleEditPrompt = (prompt: PromptTemplate) => {
    setPromptManager({
      isOpen: true,
      mode: 'edit',
      editingPrompt: prompt
    });
  };

  const handleDeletePrompt = (prompt: PromptTemplate) => {
    if (confirm(`Are you sure you want to delete "${prompt.title}"? This action cannot be undone.`)) {
      deletePrompt(prompt.id);
    }
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

  const getCategoryColor = (category: PromptCategory) => {
    switch (category) {
      case 'sync':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      case 'compliance':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'analysis':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
      case 'management':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200';
      case 'monitoring':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'reporting':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Prompt Templates
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage your reusable prompt templates with variables and markdown content
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create New Prompt
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          {/* Search */}
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search Prompts
            </label>
            <div className="relative">
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, description, tags, or category..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Categories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Filter by Category
            </label>
            <div className="flex flex-wrap gap-2">
              {(['all', 'favorites', 'sync', 'compliance', 'analysis', 'management', 'monitoring', 'reporting', 'custom'] as const).map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className={`inline-flex items-center px-3 py-2 rounded-full text-xs font-medium transition-colors ${
                    activeCategory === category
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {getCategoryIcon(category)}
                  <span className="ml-2 capitalize">{category}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {displayPrompts.length} of {prompts.prompts.length} prompt{displayPrompts.length !== 1 ? 's' : ''}
        {searchTerm && (
          <span> matching &ldquo;{searchTerm}&rdquo;</span>
        )}
        {activeCategory !== 'all' && (
          <span> in {activeCategory === 'favorites' ? 'favorites' : activeCategory} category</span>
        )}
      </div>

      {/* Prompts Grid */}
      {displayPrompts.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm || activeCategory !== 'all' ? 'No matching prompts found' : 'No prompts available'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchTerm || activeCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first prompt template'
            }
          </p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Your First Prompt
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(prompt.category)}`}>
                      {prompt.category}
                    </span>
                    {prompt.isFavorite && (
                      <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => toggleFavorite(prompt.id)}
                      className="p-1 text-gray-400 hover:text-yellow-500 transition-colors"
                      title={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg className="w-4 h-4" fill={prompt.isFavorite ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditPrompt(prompt)}
                      className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                      title="Edit prompt"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(prompt)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete prompt"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2 line-clamp-1">
                  {prompt.title}
                </h3>
                
                {prompt.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {prompt.description}
                  </p>
                )}

                {/* Tags */}
                {prompt.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {prompt.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {prompt.tags.length > 3 && (
                      <span className="px-2 py-0.5 text-xs text-gray-500">
                        +{prompt.tags.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center space-x-3">
                    {prompt.variables.length > 0 && (
                      <span className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {prompt.variables.length} var{prompt.variables.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {prompt.usageCount > 0 && (
                      <span>Used {prompt.usageCount}x</span>
                    )}
                  </div>
                  <span>
                    {new Date(prompt.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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