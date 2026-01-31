/**
 * AISettings - AI provider management settings panel
 */

import { useState } from 'react';
import {
  useAIProviders,
  useAddProvider,
  useRemoveProvider,
  useSetDefaultProvider,
  useCliStatus,
} from '../../hooks/useAI';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { Button, Input, Modal, Skeleton } from '../common';
import type { AddProviderRequest, AIProviderType } from '../../types';

const providerTypeLabels: Record<AIProviderType, string> = {
  claude_cli: 'Claude CLI',
  anthropic_api: 'Anthropic API',
  openai_api: 'OpenAI API',
};

export function AISettings() {
  const { data: providers, isLoading: isLoadingProviders } = useAIProviders();
  const { data: cliStatus, isLoading: isLoadingCli } = useCliStatus();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const addMutation = useAddProvider();
  const removeMutation = useRemoveProvider();
  const setDefaultMutation = useSetDefaultProvider();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState<string | null>(null);
  const [newProvider, setNewProvider] = useState<AddProviderRequest>({
    provider_type: 'anthropic_api',
    name: '',
    model: '',
    api_key: '',
  });

  const handleAddProvider = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(newProvider, {
      onSuccess: () => {
        setShowAddModal(false);
        setNewProvider({ provider_type: 'anthropic_api', name: '', model: '', api_key: '' });
      },
    });
  };

  const handleRemoveProvider = (providerId: string) => {
    removeMutation.mutate(providerId, {
      onSuccess: () => setShowRemoveModal(null),
    });
  };

  const handleSetDefault = (providerId: string) => {
    setDefaultMutation.mutate(providerId);
  };

  const handleAutoAnalyzeToggle = (enabled: boolean) => {
    updateSettings.mutate({ ai_auto_analyze: enabled });
  };

  return (
    <div>
      {/* Auto-analyze toggle */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Analysis Settings</h2>
        <div className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">Auto-analyze Merge Requests</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatically run AI analysis when opening a merge request
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.ai_auto_analyze ?? false}
              onChange={(e) => handleAutoAnalyzeToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Claude CLI status */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Claude CLI Status</h2>
        {isLoadingCli ? (
          <Skeleton variant="rectangular" height={60} />
        ) : cliStatus?.available ? (
          <div className="p-4 border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium text-green-800 dark:text-green-200">Claude CLI Available</span>
            </div>
            {cliStatus.version && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">Version: {cliStatus.version}</p>
            )}
            {cliStatus.path && (
              <p className="text-sm text-green-600 dark:text-green-400">Path: {cliStatus.path}</p>
            )}
          </div>
        ) : (
          <div className="p-4 border border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-medium text-yellow-800 dark:text-yellow-200">Claude CLI Not Found</span>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Install Claude CLI to use local AI analysis without API keys.
            </p>
            <a
              href="https://docs.anthropic.com/en/docs/claude-code/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
            >
              Learn how to install Claude CLI
            </a>
          </div>
        )}
      </div>

      {/* AI Providers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">AI Providers</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Configure API-based AI providers for code analysis
            </p>
          </div>
          <Button onClick={() => setShowAddModal(true)}>Add Provider</Button>
        </div>

        <div className="space-y-3">
          {isLoadingProviders ? (
            <>
              <Skeleton variant="rectangular" height={80} />
              <Skeleton variant="rectangular" height={80} />
            </>
          ) : providers?.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <svg
                className="w-12 h-12 mx-auto text-gray-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                No AI providers configured
              </p>
              <Button size="sm" onClick={() => setShowAddModal(true)}>
                Add AI Provider
              </Button>
            </div>
          ) : (
            providers?.map((provider) => (
              <div
                key={provider.id}
                className={`
                  flex items-center justify-between p-4 border rounded-lg
                  ${provider.is_default
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      provider.is_available
                        ? 'bg-green-100 dark:bg-green-900'
                        : 'bg-gray-100 dark:bg-gray-800'
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 ${
                        provider.is_available
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-400'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {provider.name}
                      </span>
                      {provider.is_default && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                          Default
                        </span>
                      )}
                      {!provider.is_available && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {providerTypeLabels[provider.provider_type]}
                      {provider.model && ` · ${provider.model}`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!provider.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetDefault(provider.id)}
                      loading={setDefaultMutation.isPending}
                    >
                      Set Default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowRemoveModal(provider.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add provider modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add AI Provider"
        size="md"
      >
        <form onSubmit={handleAddProvider} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Provider Type
            </label>
            <select
              value={newProvider.provider_type}
              onChange={(e) =>
                setNewProvider((prev) => ({
                  ...prev,
                  provider_type: e.target.value as AIProviderType,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="anthropic_api">Anthropic API</option>
              <option value="openai_api">OpenAI API</option>
              <option value="claude_cli">Claude CLI</option>
            </select>
          </div>
          <Input
            label="Name"
            placeholder="e.g., My Anthropic Account"
            value={newProvider.name}
            onChange={(e) => setNewProvider((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          {newProvider.provider_type !== 'claude_cli' && (
            <>
              <Input
                label="API Key"
                type="password"
                placeholder={
                  newProvider.provider_type === 'anthropic_api' ? 'sk-ant-...' : 'sk-...'
                }
                value={newProvider.api_key || ''}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, api_key: e.target.value }))}
                required
              />
              <Input
                label="Model (optional)"
                placeholder={
                  newProvider.provider_type === 'anthropic_api'
                    ? 'claude-sonnet-4-20250514'
                    : 'gpt-4o'
                }
                value={newProvider.model || ''}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, model: e.target.value }))}
                helperText="Leave blank to use the default model"
              />
            </>
          )}
          {addMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {addMutation.error?.message || 'Failed to add provider'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addMutation.isPending}>
              Add Provider
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove confirmation modal */}
      <Modal
        isOpen={!!showRemoveModal}
        onClose={() => setShowRemoveModal(null)}
        title="Remove Provider"
        size="sm"
      >
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Are you sure you want to remove this AI provider? The API key will be deleted from your system.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRemoveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => showRemoveModal && handleRemoveProvider(showRemoveModal)}
              loading={removeMutation.isPending}
            >
              Remove Provider
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
