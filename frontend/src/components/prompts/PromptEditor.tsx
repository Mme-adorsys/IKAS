'use client';

import React, { useState, useEffect } from 'react';
import { PromptTemplate, PromptVariable, PromptCategory } from '@/types/prompts';
import { TagInput } from '@/components/common/TagInput';
import { MarkdownEditor } from '@/components/prompts/MarkdownEditor';
import { VariableEditor } from '@/components/prompts/VariableEditor';

interface PromptEditorProps {
  prompt?: PromptTemplate;
  onSave: (prompt: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'lastUsed'>) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

const CATEGORY_OPTIONS: { value: PromptCategory; label: string; description: string }[] = [
  { value: 'sync', label: 'Sync', description: 'Data synchronization operations' },
  { value: 'compliance', label: 'Compliance', description: 'Security and compliance checks' },
  { value: 'analysis', label: 'Analysis', description: 'Data analysis and reporting' },
  { value: 'management', label: 'Management', description: 'User and system management' },
  { value: 'monitoring', label: 'Monitoring', description: 'System health and monitoring' },
  { value: 'reporting', label: 'Reporting', description: 'Report generation' },
  { value: 'custom', label: 'Custom', description: 'Custom templates' }
];

const COMMON_TAG_SUGGESTIONS = [
  'sync', 'neo4j', 'realm', 'comprehensive', 'compliance', 'security', 'audit', 
  'risk-assessment', 'user-analysis', 'deep-dive', 'health-check', 'performance', 
  'monitoring', 'system-status', 'roles', 'permissions', 'matrix', 'documentation', 
  'access-control', 'export', 'backup', 'disaster-recovery', 'migration'
];

export function PromptEditor({ prompt, onSave, onCancel, mode }: PromptEditorProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    content: '',
    category: 'custom' as PromptCategory,
    tags: [] as string[],
    isFavorite: false,
    variables: [] as PromptVariable[]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (prompt && mode === 'edit') {
      setFormData({
        title: prompt.title,
        description: prompt.description || '',
        content: prompt.content,
        category: prompt.category,
        tags: prompt.tags,
        isFavorite: prompt.isFavorite,
        variables: prompt.variables
      });
    }
  }, [prompt, mode]);

  const updateFormData = (field: string, value: string | boolean | PromptCategory | string[] | PromptVariable[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Title validation
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    // Content validation
    if (!formData.content.trim()) {
      newErrors.content = 'Content is required';
    } else if (formData.content.length < 10) {
      newErrors.content = 'Content must be at least 10 characters';
    }

    // Description validation (optional but limited)
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }

    // Variables validation - check for unique names
    const variableNames = formData.variables.map(v => v.name.toLowerCase());
    const duplicates = variableNames.filter((name, index) => variableNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      newErrors.variables = `Duplicate variable names: ${duplicates.join(', ')}`;
    }

    // Variables validation - check required variables have content references
    const contentLower = formData.content.toLowerCase();
    const missingVariables = formData.variables
      .filter(v => v.required && !contentLower.includes(`{{${v.name.toLowerCase()}}}`))
      .map(v => v.name);
    
    if (missingVariables.length > 0) {
      newErrors.variables = `Required variables not used in content: ${missingVariables.join(', ')}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      return;
    }

    onSave({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      content: formData.content,
      category: formData.category,
      tags: formData.tags,
      isFavorite: formData.isFavorite,
      variables: formData.variables
    });
  };

  const handleCancel = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Create New Prompt' : 'Edit Prompt'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {mode === 'create' 
              ? 'Create a reusable prompt template with variables and markdown content'
              : 'Modify the prompt template and its configuration'
            }
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {mode === 'create' ? 'Create Prompt' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title and Description */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Basic Information
            </h2>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateFormData('title', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.title 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Enter a descriptive title for your prompt"
                />
                {errors.title && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.title}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData('description', e.target.value)}
                  rows={2}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.description 
                      ? 'border-red-300 dark:border-red-600' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Optional description of what this prompt does"
                />
                {errors.description && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Prompt Content *
            </h2>
            
            <MarkdownEditor
              value={formData.content}
              onChange={(value) => updateFormData('content', value)}
              variables={formData.variables}
              placeholder="Write your prompt content in markdown. Use {{variableName}} syntax for variables."
              height={400}
            />
            
            {errors.content && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.content}</p>
            )}
          </div>

          {/* Variables */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <VariableEditor
              variables={formData.variables}
              onChange={(variables) => updateFormData('variables', variables)}
            />
            
            {errors.variables && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{errors.variables}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Category */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Category</h3>
            
            <select
              value={formData.category}
              onChange={(e) => updateFormData('category', e.target.value as PromptCategory)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {CATEGORY_OPTIONS.find(opt => opt.value === formData.category)?.description}
            </p>
          </div>

          {/* Tags */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Tags</h3>
            
            <TagInput
              tags={formData.tags}
              onChange={(tags) => updateFormData('tags', tags)}
              suggestions={COMMON_TAG_SUGGESTIONS}
              placeholder="Add tags to categorize your prompt"
              maxTags={8}
            />
          </div>

          {/* Options */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Options</h3>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="favorite"
                checked={formData.isFavorite}
                onChange={(e) => updateFormData('isFavorite', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="favorite" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                Mark as favorite
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Favorites appear at the top of the prompt library
            </p>
          </div>

          {/* Preview Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              Template Preview
            </h4>
            <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <div>Variables: {formData.variables.length}</div>
              <div>Required: {formData.variables.filter(v => v.required).length}</div>
              <div>Content length: {formData.content.length} characters</div>
              <div>Tags: {formData.tags.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}