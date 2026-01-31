/**
 * GitLabSettings - GitLab account management settings panel
 */

import { useState } from 'react';
import { useAccounts, useAddAccount, useRemoveAccount, useSetActiveAccount } from '../../hooks/useGitLab';
import { Button, Input, Modal, Skeleton } from '../common';
import type { AddAccountRequest } from '../../types';

export function GitLabSettings() {
  const { data: accounts, isLoading } = useAccounts();
  const addMutation = useAddAccount();
  const removeMutation = useRemoveAccount();
  const setActiveMutation = useSetActiveAccount();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState<AddAccountRequest>({
    name: '',
    instance_url: 'https://gitlab.com',
    access_token: '',
  });

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(newAccount, {
      onSuccess: () => {
        setShowAddModal(false);
        setNewAccount({ name: '', instance_url: 'https://gitlab.com', access_token: '' });
      },
    });
  };

  const handleRemoveAccount = (accountId: string) => {
    removeMutation.mutate(accountId, {
      onSuccess: () => setShowRemoveModal(null),
    });
  };

  const handleSetActive = (accountId: string) => {
    setActiveMutation.mutate(accountId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">GitLab Accounts</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your GitLab account connections
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>Add Account</Button>
      </div>

      {/* Account list */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton variant="rectangular" height={80} />
            <Skeleton variant="rectangular" height={80} />
          </>
        ) : accounts?.length === 0 ? (
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              No GitLab accounts configured
            </p>
            <Button size="sm" onClick={() => setShowAddModal(true)}>
              Add Your First Account
            </Button>
          </div>
        ) : (
          accounts?.map((account) => (
            <div
              key={account.id}
              className={`
                flex items-center justify-between p-4 border rounded-lg
                ${account.is_active
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {account.avatar_url ? (
                  <img
                    src={account.avatar_url}
                    alt={account.name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                    <span className="text-lg font-medium text-gray-600 dark:text-gray-300">
                      {account.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {account.name}
                    </span>
                    {account.is_active && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {account.instance_url}
                  </span>
                  {account.username && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                      (@{account.username})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!account.is_active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetActive(account.id)}
                    loading={setActiveMutation.isPending}
                  >
                    Set Active
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRemoveModal(account.id)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add account modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add GitLab Account"
        size="md"
      >
        <form onSubmit={handleAddAccount} className="p-4 space-y-4">
          <Input
            label="Account Name"
            placeholder="e.g., Work, Personal"
            value={newAccount.name}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, name: e.target.value }))}
            required
          />
          <Input
            label="GitLab Instance URL"
            placeholder="https://gitlab.com"
            value={newAccount.instance_url}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, instance_url: e.target.value }))}
            required
          />
          <Input
            label="Personal Access Token"
            type="password"
            placeholder="glpat-..."
            value={newAccount.access_token}
            onChange={(e) => setNewAccount((prev) => ({ ...prev, access_token: e.target.value }))}
            helperText="Token requires api scope for full functionality"
            required
          />
          {addMutation.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {addMutation.error?.message || 'Failed to add account'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={addMutation.isPending}>
              Add Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Remove confirmation modal */}
      <Modal
        isOpen={!!showRemoveModal}
        onClose={() => setShowRemoveModal(null)}
        title="Remove Account"
        size="sm"
      >
        <div className="p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Are you sure you want to remove this account? This will delete all cached data for this account.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRemoveModal(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => showRemoveModal && handleRemoveAccount(showRemoveModal)}
              loading={removeMutation.isPending}
            >
              Remove Account
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
