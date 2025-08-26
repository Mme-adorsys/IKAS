'use client';

import React, { useState } from 'react';
import { PromptTemplate } from '@/types/prompts';
import { PromptEditor } from '@/components/prompts/PromptEditor';
import { useIKASStore } from '@/store';

interface PromptManagerProps {
  isOpen: boolean;
  onClose: () => void;
  editingPrompt?: PromptTemplate;
  mode?: 'create' | 'edit';
}

export function PromptManager({ 
  isOpen, 
  onClose, 
  editingPrompt, 
  mode = 'create' 
}: PromptManagerProps) {
  const [isClosing, setIsClosing] = useState(false);
  const { savePrompt, updatePrompt } = useIKASStore();

  const handleSave = async (promptData: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'>) => {
    try {
      if (mode === 'create') {
        await savePrompt(promptData);
      } else if (mode === 'edit' && editingPrompt) {
        await updatePrompt(editingPrompt.id, promptData);
      }
      handleClose();
    } catch (error) {
      console.error('Failed to save prompt:', error);
      // TODO: Add toast notification for error
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 150);
  };

  if (!isOpen && !isClosing) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black bg-opacity-50 transition-opacity z-40 ${
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className={`fixed inset-0 z-50 overflow-y-auto transition-all duration-150 ${
          isOpen && !isClosing ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          <div 
            className={`relative w-full max-w-7xl bg-white dark:bg-gray-900 rounded-lg shadow-xl transform transition-all duration-150 ${
              isOpen && !isClosing ? 'scale-100' : 'scale-95'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Editor Content */}
            <div className="max-h-[90vh] overflow-y-auto">
              <PromptEditor
                prompt={editingPrompt}
                onSave={handleSave}
                onCancel={handleClose}
                mode={mode}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Keyboard shortcut hook for closing modal
export function usePromptManagerKeyboard(isOpen: boolean, onClose: () => void) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
}