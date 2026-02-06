/**
 * AddAccountModal - Modal for adding a new GitLab account
 */

import { useState } from 'react';
import { Modal, Button, Input } from '../common';
import { useAddAccount, useValidateToken } from '../../hooks/useGitLab';
import { useUIStore } from '../../stores';

export function AddAccountModal() {
  const { activeModal, closeModal } = useUIStore();
  const isOpen = activeModal === 'addAccount';

  const [name, setName] = useState('');
  const [instanceUrl, setInstanceUrl] = useState('https://gitlab.com');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const validateToken = useValidateToken();
  const addAccount = useAddAccount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a name for this account');
      return;
    }

    if (!instanceUrl.trim()) {
      setError('Please enter the GitLab instance URL');
      return;
    }

    if (!token.trim()) {
      setError('Please enter your personal access token');
      return;
    }

    try {
      // Validate token first
      const validation = await validateToken.mutateAsync({
        instance_url: instanceUrl,
        access_token: token,
      });

      if (!validation.valid) {
        setError(validation.error || 'Invalid token');
        return;
      }

      // Add the account
      await addAccount.mutateAsync({
        name,
        instance_url: instanceUrl,
        access_token: token,
      });

      // Reset form and close modal
      setName('');
      setInstanceUrl('https://gitlab.com');
      setToken('');
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account');
    }
  };

  const handleClose = () => {
    setName('');
    setInstanceUrl('https://gitlab.com');
    setToken('');
    setError(null);
    closeModal();
  };

  const isLoading = validateToken.isPending || addAccount.isPending;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add GitLab Account" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Account Name"
          placeholder="e.g., Work GitLab"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
        />

        <Input
          label="GitLab Instance URL"
          placeholder="https://gitlab.com"
          value={instanceUrl}
          onChange={(e) => setInstanceUrl(e.target.value)}
          disabled={isLoading}
        />

        <Input
          label="Personal Access Token"
          type="password"
          placeholder="glpat-..."
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={isLoading}
          helperText={
            <span>
              Generate a token at GitLab → Settings → Access Tokens with{' '}
              <code className="text-xs bg-surface-alt px-1 rounded">read_api</code> and{' '}
              <code className="text-xs bg-surface-alt px-1 rounded">api</code> scopes.
            </span>
          }
        />

        {error && (
          <div className="p-3 text-sm text-negative-text bg-negative-muted rounded-md">
            {error}
          </div>
        )}

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            {isLoading ? 'Adding...' : 'Add Account'}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
