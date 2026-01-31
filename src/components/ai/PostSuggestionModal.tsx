/**
 * PostSuggestionModal - Modal for editing and posting AI suggestions to GitLab
 */

import { useState } from 'react';
import type { AISuggestion } from '../../types';
import { Button, Modal } from '../common';

interface PostSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestion: AISuggestion | null;
  onPost: (suggestion: AISuggestion, body: string, asSuggestion: boolean) => void;
  isPosting?: boolean;
}

export function PostSuggestionModal({
  isOpen,
  onClose,
  suggestion,
  onPost,
  isPosting,
}: PostSuggestionModalProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const [postAsSuggestion, setPostAsSuggestion] = useState(true);

  if (!suggestion) return null;

  const handlePost = () => {
    // Build the comment body
    let body = `**${suggestion.title}**\n\n${suggestion.description}`;

    if (additionalContext.trim()) {
      body += `\n\n${additionalContext.trim()}`;
    }

    if (postAsSuggestion && suggestion.suggested_code) {
      // When posting as suggestion, the backend will format it with ```suggestion
      body = suggestion.suggested_code;
      if (additionalContext.trim()) {
        body = `${additionalContext.trim()}\n\n${body}`;
      }
    }

    onPost(suggestion, body, postAsSuggestion && !!suggestion.suggested_code);
  };

  const handleClose = () => {
    setAdditionalContext('');
    setPostAsSuggestion(true);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Post Suggestion to GitLab" size="lg">
      <div className="p-4 space-y-4">
        {/* Suggestion preview */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(suggestion.category)}`}
            >
              {formatCategory(suggestion.category)}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(suggestion.severity)}`}
            >
              {suggestion.severity}
            </span>
          </div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{suggestion.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{suggestion.description}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {suggestion.file_path}:{suggestion.start_line}
            {suggestion.end_line > suggestion.start_line && `-${suggestion.end_line}`}
          </p>
        </div>

        {/* Code preview */}
        {suggestion.suggested_code && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Suggested Code Change
            </label>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {suggestion.original_code && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-red-700 dark:text-red-300 block mb-1">
                    Original:
                  </span>
                  <pre className="text-xs overflow-x-auto">
                    <code className="text-red-700 dark:text-red-300">{suggestion.original_code}</code>
                  </pre>
                </div>
              )}
              <div className="bg-green-50 dark:bg-green-900/20 p-3">
                <span className="text-xs font-medium text-green-700 dark:text-green-300 block mb-1">
                  Suggested:
                </span>
                <pre className="text-xs overflow-x-auto">
                  <code className="text-green-700 dark:text-green-300">{suggestion.suggested_code}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Post type selection */}
        {suggestion.suggested_code && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Post As
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="radio"
                  name="postType"
                  checked={postAsSuggestion}
                  onChange={() => setPostAsSuggestion(true)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    GitLab Suggestion
                  </span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Code change can be applied directly from the MR in GitLab
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="radio"
                  name="postType"
                  checked={!postAsSuggestion}
                  onChange={() => setPostAsSuggestion(false)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">Regular Comment</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Post as a regular code review comment
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Additional context */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Context (optional)
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Add any additional context or explanation..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handlePost} loading={isPosting}>
            Post to GitLab
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    code_quality: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    potential_bug: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    performance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    security: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    best_practice: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    readability: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
    documentation: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[category] || colors.code_quality;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return colors[severity] || colors.info;
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    code_quality: 'Code Quality',
    potential_bug: 'Potential Bug',
    performance: 'Performance',
    security: 'Security',
    best_practice: 'Best Practice',
    readability: 'Readability',
    documentation: 'Documentation',
  };
  return labels[category] || category;
}
