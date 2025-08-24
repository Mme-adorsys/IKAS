'use client';

import React, { useState } from 'react';
import { useIKASStore } from '@/store';

export function ModelSelector() {
  const { 
    model, 
    switchModel, 
    loadAvailableModels 
  } = useIKASStore();
  
  const [isOpen, setIsOpen] = useState(false);

  const handleModelSwitch = async (modelId: string) => {
    if (modelId === model.currentModel?.id || model.isLoading) {
      return;
    }
    
    setIsOpen(false);
    await switchModel(modelId);
  };

  const handleRefreshModels = async () => {
    await loadAvailableModels();
  };

  return (
    <div className="relative">
      {/* Current Model Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={model.isLoading}
        className={`flex items-center justify-between w-full px-3 py-2 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
          model.isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center space-x-3">
          {/* Model Status Indicator */}
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            model.currentModel?.available 
              ? 'bg-green-400' 
              : 'bg-red-400'
          }`}></div>
          
          {/* Model Info */}
          <div className="min-w-0 flex-1">
            {model.currentModel ? (
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {model.currentModel.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {model.currentModel.provider} • {model.currentModel.model}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {model.isLoading ? 'Loading models...' : 'No model selected'}
              </div>
            )}
          </div>

          {/* Loading Spinner or Chevron */}
          {model.isLoading ? (
            <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Dropdown Content */}
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
            {/* Header */}
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Available Models
                </h3>
                <button
                  onClick={handleRefreshModels}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Model List */}
            <div className="py-1">
              {model.availableModels.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No models available
                </div>
              ) : (
                model.availableModels.map((modelInfo) => (
                  <button
                    key={modelInfo.id}
                    onClick={() => handleModelSwitch(modelInfo.id)}
                    disabled={!modelInfo.available}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 transition-colors ${
                      !modelInfo.available ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Selection Indicator */}
                      <div className="flex-shrink-0">
                        {modelInfo.current ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        ) : (
                          <div className="w-2 h-2 border border-gray-300 dark:border-gray-600 rounded-full"></div>
                        )}
                      </div>

                      {/* Model Info */}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {modelInfo.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {modelInfo.provider} • {modelInfo.description}
                        </div>
                        
                        {/* Capabilities */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {modelInfo.capabilities.slice(0, 3).map((capability) => (
                            <span
                              key={capability}
                              className="inline-flex px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded"
                            >
                              {capability}
                            </span>
                          ))}
                          {modelInfo.capabilities.length > 3 && (
                            <span className="inline-flex px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                              +{modelInfo.capabilities.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${
                          modelInfo.available 
                            ? 'bg-green-400' 
                            : 'bg-red-400'
                        }`}></div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Error Message */}
            {model.lastError && (
              <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                <div className="text-xs text-red-600 dark:text-red-400">
                  {model.lastError}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}