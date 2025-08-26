'use client';

import React, { useState } from 'react';
import { PromptVariable } from '@/types/prompts';

interface VariableEditorProps {
  variables: PromptVariable[];
  onChange: (variables: PromptVariable[]) => void;
  className?: string;
}

interface EditingVariable extends PromptVariable {
  isEditing?: boolean;
  isNew?: boolean;
}

export function VariableEditor({ variables, onChange, className = "" }: VariableEditorProps) {
  const [editingVariables, setEditingVariables] = useState<EditingVariable[]>(
    variables.map(v => ({ ...v, isEditing: false }))
  );

  const addVariable = () => {
    const newVariable: EditingVariable = {
      name: '',
      description: '',
      defaultValue: '',
      required: false,
      type: 'text',
      isEditing: true,
      isNew: true
    };
    
    setEditingVariables([...editingVariables, newVariable]);
  };

  const updateVariable = (index: number, updates: Partial<EditingVariable>) => {
    const updated = editingVariables.map((variable, i) => 
      i === index ? { ...variable, ...updates } : variable
    );
    setEditingVariables(updated);
  };

  const saveVariable = (index: number) => {
    const variable = editingVariables[index];
    
    // Validation
    if (!variable.name.trim()) {
      alert('Variable name is required');
      return;
    }
    
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(variable.name)) {
      alert('Variable name must start with a letter and contain only letters, numbers, and underscores');
      return;
    }
    
    // Check for duplicate names
    const duplicateIndex = editingVariables.findIndex((v, i) => 
      i !== index && v.name.toLowerCase() === variable.name.toLowerCase()
    );
    
    if (duplicateIndex !== -1) {
      alert('Variable name must be unique');
      return;
    }

    const updated = editingVariables.map((v, i) => 
      i === index ? { ...v, isEditing: false, isNew: false } : v
    );
    
    setEditingVariables(updated);
    
    // Update parent with clean variables (without editing flags)
    const cleanVariables = updated.map(({ isEditing: _isEditing, isNew: _isNew, ...v }) => v as PromptVariable);
    onChange(cleanVariables);
  };

  const cancelEdit = (index: number) => {
    if (editingVariables[index].isNew) {
      // Remove new variable if cancelled
      const updated = editingVariables.filter((_, i) => i !== index);
      setEditingVariables(updated);
      const cleanVariables = updated.map(({ isEditing: _isEditing, isNew: _isNew, ...v }) => v as PromptVariable);
      onChange(cleanVariables);
    } else {
      // Restore original variable
      const original = variables.find(v => v.name === editingVariables[index].name);
      if (original) {
        const updated = editingVariables.map((v, i) => 
          i === index ? { ...original, isEditing: false, isNew: false } : v
        );
        setEditingVariables(updated);
      }
    }
  };

  const deleteVariable = (index: number) => {
    if (confirm('Are you sure you want to delete this variable?')) {
      const updated = editingVariables.filter((_, i) => i !== index);
      setEditingVariables(updated);
      const cleanVariables = updated.map(({ isEditing: _isEditing, isNew: _isNew, ...v }) => v as PromptVariable);
      onChange(cleanVariables);
    }
  };

  const startEdit = (index: number) => {
    const updated = editingVariables.map((v, i) => 
      i === index ? { ...v, isEditing: true } : v
    );
    setEditingVariables(updated);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Variables</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Define variables that can be used in your prompt with {'{{variableName}}'} syntax
          </p>
        </div>
        <button
          type="button"
          onClick={addVariable}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Variable
        </button>
      </div>

      {editingVariables.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h4 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No variables defined</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add variables to make your prompts dynamic and reusable
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {editingVariables.map((variable, index) => (
            <div
              key={`${variable.name}-${index}`}
              className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              {variable.isEditing ? (
                <div className="space-y-4">
                  {/* Variable Name and Type */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Variable Name *
                      </label>
                      <input
                        type="text"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., realm, username"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={variable.type}
                        onChange={(e) => updateVariable(index, { type: e.target.value as PromptVariable['type'] })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="text">Text</option>
                        <option value="select">Select</option>
                        <option value="realm">Realm</option>
                        <option value="user">User</option>
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={variable.description || ''}
                      onChange={(e) => updateVariable(index, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Brief description of this variable"
                    />
                  </div>

                  {/* Default Value and Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Default Value
                      </label>
                      <input
                        type="text"
                        value={variable.defaultValue || ''}
                        onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Optional default value"
                      />
                    </div>

                    {variable.type === 'select' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Options (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={variable.options?.join(', ') || ''}
                          onChange={(e) => updateVariable(index, { 
                            options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="option1, option2, option3"
                        />
                      </div>
                    )}
                  </div>

                  {/* Required Checkbox */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`required-${index}`}
                      checked={variable.required}
                      onChange={(e) => updateVariable(index, { required: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`required-${index}`} className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                      Required variable
                    </label>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => cancelEdit(index)}
                      className="px-3 py-1 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveVariable(index)}
                      className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-medium text-gray-900 dark:text-white">
                        {'{{' + variable.name + '}}'}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        variable.type === 'text' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' :
                        variable.type === 'select' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' :
                        variable.type === 'realm' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' :
                        'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
                      }`}>
                        {variable.type}
                      </span>
                      {variable.required && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
                          Required
                        </span>
                      )}
                    </div>
                    
                    {variable.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {variable.description}
                      </p>
                    )}
                    
                    {variable.defaultValue && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Default: <span className="font-mono">{variable.defaultValue}</span>
                      </p>
                    )}
                    
                    {variable.options && variable.options.length > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Options: {variable.options.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 ml-4">
                    <button
                      type="button"
                      onClick={() => startEdit(index)}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Edit variable"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => deleteVariable(index)}
                      className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete variable"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}