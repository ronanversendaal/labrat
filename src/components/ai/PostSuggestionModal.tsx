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
        <div className="p-4 bg-surface rounded-lg">
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
          <h4 className="font-medium text-content mb-1">{suggestion.title}</h4>
          <p className="text-sm text-content-secondary mb-2">{suggestion.description}</p>
          <p className="text-xs text-content-tertiary">
            {suggestion.file_path}:{suggestion.start_line}
            {suggestion.end_line > suggestion.start_line && `-${suggestion.end_line}`}
          </p>
        </div>

        {/* Code preview */}
        {suggestion.suggested_code && (
          <div>
            <label className="block text-sm font-medium text-content-muted mb-2">
              Suggested Code Change
            </label>
            <div className="border border-edge rounded-lg overflow-hidden">
              {suggestion.original_code && (
                <div className="bg-negative-muted p-3 border-b border-edge">
                  <span className="text-xs font-medium text-negative-text block mb-1">
                    Original:
                  </span>
                  <pre className="text-xs overflow-x-auto">
                    <code className="text-negative-text">{suggestion.original_code}</code>
                  </pre>
                </div>
              )}
              <div className="bg-positive-muted p-3">
                <span className="text-xs font-medium text-positive-text block mb-1">
                  Suggested:
                </span>
                <pre className="text-xs overflow-x-auto">
                  <code className="text-positive-text">{suggestion.suggested_code}</code>
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Post type selection */}
        {suggestion.suggested_code && (
          <div>
            <label className="block text-sm font-medium text-content-muted mb-2">
              Post As
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border border-edge rounded-lg cursor-pointer hover:bg-surface-hover">
                <input
                  type="radio"
                  name="postType"
                  checked={postAsSuggestion}
                  onChange={() => setPostAsSuggestion(true)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-content">
                    GitLab Suggestion
                  </span>
                  <p className="text-sm text-content-secondary">
                    Code change can be applied directly from the MR in GitLab
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-edge rounded-lg cursor-pointer hover:bg-surface-hover">
                <input
                  type="radio"
                  name="postType"
                  checked={!postAsSuggestion}
                  onChange={() => setPostAsSuggestion(false)}
                  className="mt-1"
                />
                <div>
                  <span className="font-medium text-content">Regular Comment</span>
                  <p className="text-sm text-content-secondary">
                    Post as a regular code review comment
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Additional context */}
        <div>
          <label className="block text-sm font-medium text-content-muted mb-2">
            Additional Context (optional)
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Add any additional context or explanation..."
            rows={3}
            className="w-full px-3 py-2 border border-edge-strong rounded-md bg-surface text-content placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-edge">
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
    code_quality: 'bg-primary-muted text-primary-text',
    potential_bug: 'bg-negative-muted text-negative-text',
    performance: 'bg-caution-muted text-caution-text',
    security: 'bg-info-muted text-info-text',
    best_practice: 'bg-positive-muted text-positive-text',
    readability: 'bg-info-muted text-info-text',
    documentation: 'bg-surface-alt text-content-secondary',
  };
  return colors[category] || colors.code_quality;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    error: 'bg-negative-muted text-negative-text',
    warning: 'bg-caution-muted text-caution-text',
    info: 'bg-primary-muted text-primary-text',
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
