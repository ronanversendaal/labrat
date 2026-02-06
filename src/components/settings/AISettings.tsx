/**
 * AISettings - AI provider management settings panel
 */

import { useState, useMemo } from 'react';
import {
  useAIProviders,
  useAddProvider,
  useRemoveProvider,
  useSetDefaultProvider,
  useCliBinaryStatus,
  useAvailableModels,
  useValidateCliPath,
} from '../../hooks/useAI';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { Button, Input, Modal, Skeleton } from '../common';
import type { AddProviderRequest, AIProviderType } from '../../types';

const CLI_PROVIDER_TYPES: { value: AIProviderType; label: string }[] = [
  { value: 'claude_cli', label: 'Claude CLI' },
  { value: 'opencode_cli', label: 'OpenCode' },
  { value: 'ollama_cli', label: 'Ollama' },
  { value: 'llm_cli', label: 'llm (Simon Willison)' },
  { value: 'gemini_cli', label: 'Gemini CLI' },
  { value: 'custom_cli', label: 'Custom CLI Binary' },
];

const API_PROVIDER_TYPES: { value: AIProviderType; label: string }[] = [
  { value: 'anthropic_api', label: 'Anthropic API' },
  { value: 'openai_api', label: 'OpenAI API' },
];

const providerTypeLabels: Record<AIProviderType, string> = {
  claude_cli: 'Claude CLI',
  opencode_cli: 'OpenCode',
  ollama_cli: 'Ollama',
  llm_cli: 'llm',
  gemini_cli: 'Gemini CLI',
  custom_cli: 'Custom CLI',
  anthropic_api: 'Anthropic API',
  openai_api: 'OpenAI API',
};

function isCliType(type: AIProviderType): boolean {
  return type.endsWith('_cli');
}

function defaultNameForType(type: AIProviderType): string {
  return providerTypeLabels[type] || type;
}

/** Detected CLI Binaries section */
function DetectedCliBinaries() {
  const typesToCheck: AIProviderType[] = [
    'claude_cli',
    'opencode_cli',
    'ollama_cli',
    'llm_cli',
    'gemini_cli',
  ];

  return (
    <div className="mb-8">
      <h2 className="text-lg font-medium text-content mb-2">Detected CLI Binaries</h2>
      <div className="space-y-2">
        {typesToCheck.map((pt) => (
          <CliBinaryRow key={pt} providerType={pt} />
        ))}
      </div>
    </div>
  );
}

function CliBinaryRow({ providerType }: { providerType: AIProviderType }) {
  const { data, isLoading } = useCliBinaryStatus(providerType);
  const label = providerTypeLabels[providerType];

  if (isLoading) {
    return (
      <div className="flex items-center justify-between p-3 border border-edge rounded-lg">
        <span className="text-sm text-content">{label}</span>
        <Skeleton variant="text" width={80} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border border-edge rounded-lg">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            data?.available ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
        <span className="text-sm font-medium text-content">{label}</span>
      </div>
      <div className="text-sm text-content-secondary">
        {data?.available ? (
          <span className="text-positive-text">
            {data.version ? data.version.slice(0, 40) : 'Available'}
            {data.path && (
              <span className="text-content-secondary ml-2 hidden sm:inline">
                {data.path}
              </span>
            )}
          </span>
        ) : (
          <span className="text-content-secondary">Not found</span>
        )}
      </div>
    </div>
  );
}

/** Model selector combobox */
function ModelSelector({
  providerType,
  providerId,
  cliPath,
  apiKey,
  value,
  onChange,
}: {
  providerType: AIProviderType;
  providerId?: string;
  cliPath?: string;
  apiKey?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { data, isLoading, refetch } = useAvailableModels(
    providerType,
    providerId,
    cliPath,
    apiKey
  );

  const models = data?.models ?? [];
  const hasModels = models.length > 0;

  return (
    <div>
      <label className="block text-sm font-medium text-content-muted mb-1">
        Model (optional)
      </label>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            list={`models-${providerType}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              isLoading
                ? 'Loading models...'
                : hasModels
                  ? 'Select or type a model...'
                  : 'Type a model ID...'
            }
            className="w-full px-3 py-2 border border-edge-strong rounded-md bg-surface text-content placeholder:text-content-secondary"
          />
          {hasModels && (
            <datalist id={`models-${providerType}`}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </datalist>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          loading={isLoading}
          title="Refresh model list"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </Button>
      </div>
      <p className="text-xs text-content-secondary mt-1">
        Leave blank to use the provider's default model
      </p>
    </div>
  );
}

export function AISettings() {
  const { data: providers, isLoading: isLoadingProviders } = useAIProviders();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const addMutation = useAddProvider();
  const removeMutation = useRemoveProvider();
  const setDefaultMutation = useSetDefaultProvider();
  const validatePathMutation = useValidateCliPath();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState<string | null>(null);
  const [newProvider, setNewProvider] = useState<AddProviderRequest>({
    provider_type: 'anthropic_api',
    name: '',
    model: '',
    api_key: '',
    cli_path: '',
  });

  const selectedIsCliType = useMemo(
    () => isCliType(newProvider.provider_type),
    [newProvider.provider_type]
  );

  const handleAddProvider = (e: React.FormEvent) => {
    e.preventDefault();
    // Clean up empty strings to undefined
    const request: AddProviderRequest = {
      provider_type: newProvider.provider_type,
      name: newProvider.name || defaultNameForType(newProvider.provider_type),
      model: newProvider.model || undefined,
      api_key: newProvider.api_key || undefined,
      cli_path: newProvider.cli_path || undefined,
    };
    addMutation.mutate(request, {
      onSuccess: () => {
        setShowAddModal(false);
        resetAddForm();
      },
    });
  };

  const resetAddForm = () => {
    setNewProvider({
      provider_type: 'anthropic_api',
      name: '',
      model: '',
      api_key: '',
      cli_path: '',
    });
    validatePathMutation.reset();
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

  const handleProviderTypeChange = (type: AIProviderType) => {
    setNewProvider((prev) => ({
      ...prev,
      provider_type: type,
      name: '',
      model: '',
      api_key: '',
      cli_path: '',
    }));
    validatePathMutation.reset();
  };

  const handleValidatePath = () => {
    if (newProvider.cli_path) {
      validatePathMutation.mutate(newProvider.cli_path);
    }
  };

  return (
    <div>
      {/* Auto-analyze toggle */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-content mb-2">Analysis Settings</h2>
        <div className="flex items-center justify-between p-4 border border-edge rounded-lg">
          <div>
            <p className="font-medium text-content">Auto-analyze Merge Requests</p>
            <p className="text-sm text-content-secondary">
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
            <div className="w-11 h-6 bg-surface-alt peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-edge-strong after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      {/* Detected CLI Binaries */}
      <DetectedCliBinaries />

      {/* AI Providers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-content">AI Providers</h2>
            <p className="text-sm text-content-secondary">
              Configure CLI binaries or API-based AI providers for code analysis
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
            <div className="text-center py-8 border border-dashed border-edge-strong rounded-lg">
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
              <p className="text-sm text-content-secondary mb-4">
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
                    ? 'border-primary bg-primary-muted'
                    : 'border-edge'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      provider.is_available
                        ? 'bg-positive-muted'
                        : 'bg-surface-alt'
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 ${
                        provider.is_available
                          ? 'text-positive-text'
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
                      <span className="font-medium text-content">
                        {provider.name}
                      </span>
                      {provider.is_default && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-primary-muted text-primary-text rounded">
                          Default
                        </span>
                      )}
                      {!provider.is_available && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-caution-muted text-caution-text rounded">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-content-secondary">
                      {providerTypeLabels[provider.provider_type]}
                      {provider.model && ` · ${provider.model}`}
                      {provider.cli_path && (
                        <span className="ml-1 text-xs text-content-secondary">
                          ({provider.cli_path})
                        </span>
                      )}
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
                    className="text-negative-text"
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
        onClose={() => {
          setShowAddModal(false);
          resetAddForm();
        }}
        title="Add AI Provider"
        size="md"
      >
        <form onSubmit={handleAddProvider} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-muted mb-1">
              Provider Type
            </label>
            <select
              value={newProvider.provider_type}
              onChange={(e) =>
                handleProviderTypeChange(e.target.value as AIProviderType)
              }
              className="w-full px-3 py-2 border border-edge-strong rounded-md bg-surface text-content"
            >
              <optgroup label="CLI Binaries">
                {CLI_PROVIDER_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="API Providers">
                {API_PROVIDER_TYPES.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <Input
            label="Name"
            placeholder={defaultNameForType(newProvider.provider_type)}
            value={newProvider.name}
            onChange={(e) =>
              setNewProvider((prev) => ({ ...prev, name: e.target.value }))
            }
            helperText="Leave blank to use the default name"
          />

          {/* CLI-specific fields */}
          {selectedIsCliType && (
            <>
              {/* CLI Binary status badge */}
              {newProvider.provider_type !== 'custom_cli' && (
                <CliBinaryStatusBadge providerType={newProvider.provider_type} />
              )}

              {/* Custom path field */}
              {(newProvider.provider_type === 'custom_cli' ||
                newProvider.cli_path) && (
                <div>
                  <label className="block text-sm font-medium text-content-muted mb-1">
                    {newProvider.provider_type === 'custom_cli'
                      ? 'Executable Path (required)'
                      : 'Custom Path (optional)'}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={newProvider.cli_path || ''}
                      onChange={(e) =>
                        setNewProvider((prev) => ({
                          ...prev,
                          cli_path: e.target.value,
                        }))
                      }
                      placeholder="/usr/local/bin/my-ai-cli"
                      required={newProvider.provider_type === 'custom_cli'}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleValidatePath}
                      loading={validatePathMutation.isPending}
                      disabled={!newProvider.cli_path}
                    >
                      Validate
                    </Button>
                  </div>
                  {validatePathMutation.data && (
                    <p
                      className={`text-xs mt-1 ${
                        validatePathMutation.data.valid
                          ? 'text-positive-text'
                          : 'text-negative-text'
                      }`}
                    >
                      {validatePathMutation.data.valid
                        ? `Valid${validatePathMutation.data.version ? ` (${validatePathMutation.data.version})` : ''}`
                        : validatePathMutation.data.error || 'Invalid path'}
                    </p>
                  )}
                </div>
              )}

              {/* Show "Set custom path" link for non-custom CLI types */}
              {newProvider.provider_type !== 'custom_cli' &&
                !newProvider.cli_path && (
                  <button
                    type="button"
                    className="text-xs text-primary-text hover:underline"
                    onClick={() =>
                      setNewProvider((prev) => ({ ...prev, cli_path: '' }))
                    }
                  >
                    Set custom executable path...
                  </button>
                )}

              {/* Model selector */}
              <ModelSelector
                providerType={newProvider.provider_type}
                cliPath={newProvider.cli_path || undefined}
                value={newProvider.model || ''}
                onChange={(v) =>
                  setNewProvider((prev) => ({ ...prev, model: v }))
                }
              />
            </>
          )}

          {/* API-specific fields */}
          {!selectedIsCliType && (
            <>
              <Input
                label="API Key"
                type="password"
                placeholder={
                  newProvider.provider_type === 'anthropic_api'
                    ? 'sk-ant-...'
                    : 'sk-...'
                }
                value={newProvider.api_key || ''}
                onChange={(e) =>
                  setNewProvider((prev) => ({
                    ...prev,
                    api_key: e.target.value,
                  }))
                }
                required
              />
              <ModelSelector
                providerType={newProvider.provider_type}
                apiKey={newProvider.api_key || undefined}
                value={newProvider.model || ''}
                onChange={(v) =>
                  setNewProvider((prev) => ({ ...prev, model: v }))
                }
              />
            </>
          )}

          {addMutation.isError && (
            <p className="text-sm text-negative-text">
              {addMutation.error?.message || 'Failed to add provider'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowAddModal(false);
                resetAddForm();
              }}
            >
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
          <p className="text-sm text-content-secondary mb-4">
            Are you sure you want to remove this AI provider? The API key will
            be deleted from your system.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRemoveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                showRemoveModal && handleRemoveProvider(showRemoveModal)
              }
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

/** Inline status badge for a CLI binary in the add-provider modal */
function CliBinaryStatusBadge({
  providerType,
}: {
  providerType: AIProviderType;
}) {
  const { data, isLoading } = useCliBinaryStatus(providerType);

  if (isLoading) {
    return <Skeleton variant="text" width={120} />;
  }

  if (!data) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
        data.available
          ? 'bg-positive-muted text-positive-text'
          : 'bg-caution-muted text-caution-text'
      }`}
    >
      <div
        className={`w-2 h-2 rounded-full ${
          data.available ? 'bg-green-500' : 'bg-yellow-500'
        }`}
      />
      {data.available ? (
        <span>
          Detected
          {data.version && `: ${data.version.slice(0, 40)}`}
        </span>
      ) : (
        <span>Not found in PATH</span>
      )}
    </div>
  );
}
