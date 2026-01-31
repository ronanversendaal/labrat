/**
 * Hook for keyboard shortcuts
 * Provides easy registration and management of keyboard shortcuts in components
 */

import { useEffect, useCallback, useState, useMemo } from 'react';
import {
  keyboardRegistry,
  type KeyboardShortcut,
  type ShortcutCategory,
} from '../services/keyboard';

export interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Scope identifier for automatic cleanup */
  scope?: string;
}

/**
 * Hook for registering keyboard shortcuts in a component
 * Automatically cleans up shortcuts when component unmounts
 */
export function useKeyboardShortcuts(
  shortcuts: Array<{
    id: string;
    keys: string[];
    handler: (e: KeyboardEvent) => void;
    label: string;
    description: string;
    category: ShortcutCategory;
    preventDefault?: boolean;
  }>,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, scope = '' } = options;

  useEffect(() => {
    if (!enabled) return;

    const registeredIds: string[] = [];

    shortcuts.forEach((shortcut) => {
      const id = scope ? `${scope}:${shortcut.id}` : shortcut.id;
      keyboardRegistry.register(id, {
        keys: shortcut.keys,
        handler: shortcut.handler,
        label: shortcut.label,
        description: shortcut.description,
        category: shortcut.category,
        preventDefault: shortcut.preventDefault,
        enabled: true,
      });
      registeredIds.push(id);
    });

    return () => {
      registeredIds.forEach((id) => keyboardRegistry.unregister(id));
    };
  }, [shortcuts, enabled, scope]);
}

/**
 * Hook for registering a single keyboard shortcut
 */
export function useKeyboardShortcut(
  keys: string[],
  handler: (e: KeyboardEvent) => void,
  options: {
    enabled?: boolean;
    label?: string;
    description?: string;
    category?: ShortcutCategory;
    preventDefault?: boolean;
  } = {}
) {
  const {
    enabled = true,
    label = 'Shortcut',
    description = '',
    category = 'global',
    preventDefault = true,
  } = options;

  useEffect(() => {
    if (!enabled) return;

    const id = `shortcut-${keys.join('-')}-${Math.random().toString(36).slice(2, 9)}`;

    keyboardRegistry.register(id, {
      keys,
      handler,
      label,
      description,
      category,
      preventDefault,
      enabled: true,
    });

    return () => {
      keyboardRegistry.unregister(id);
    };
  }, [keys, handler, enabled, label, description, category, preventDefault]);
}

/**
 * Hook to subscribe to all registered shortcuts
 */
export function useRegisteredShortcuts(): KeyboardShortcut[] {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>(() =>
    keyboardRegistry.getAll()
  );

  useEffect(() => {
    return keyboardRegistry.subscribe(setShortcuts);
  }, []);

  return shortcuts;
}

/**
 * Hook to get shortcuts grouped by category
 */
export function useGroupedShortcuts(): Map<ShortcutCategory, KeyboardShortcut[]> {
  const shortcuts = useRegisteredShortcuts();

  return useMemo(() => {
    const grouped = new Map<ShortcutCategory, KeyboardShortcut[]>();

    shortcuts.forEach((shortcut) => {
      const existing = grouped.get(shortcut.category) || [];
      grouped.set(shortcut.category, [...existing, shortcut]);
    });

    return grouped;
  }, [shortcuts]);
}

/**
 * Hook for escape key handling
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  useKeyboardShortcut(['escape'], handler, {
    enabled,
    label: 'Close',
    description: 'Close dialog',
    category: 'global',
  });
}

/**
 * Hook for search focus (/, s)
 */
export function useSearchShortcut(
  onFocus: () => void,
  enabled = true
) {
  useKeyboardShortcut(['/', 's'], onFocus, {
    enabled,
    label: 'Search',
    description: 'Focus search',
    category: 'global',
  });
}

/**
 * Hook for arrow key navigation
 */
export function useArrowNavigation(
  onUp: () => void,
  onDown: () => void,
  enabled = true
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'k') {
        onUp();
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        onDown();
      }
    },
    [onUp, onDown]
  );

  useEffect(() => {
    if (!enabled) return;

    const id = `arrow-nav-${Math.random().toString(36).slice(2, 9)}`;

    keyboardRegistry.register(id, {
      keys: ['arrowup', 'arrowdown', 'j', 'k'],
      handler: handleKeyDown,
      label: 'Navigate',
      description: 'Move selection up/down',
      category: 'navigation',
      enabled: true,
    });

    return () => {
      keyboardRegistry.unregister(id);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Hook for file navigation in diff view
 */
export function useFileNavigation(
  onPrev: () => void,
  onNext: () => void,
  enabled = true
) {
  useKeyboardShortcut(['['], onPrev, {
    enabled,
    label: 'Previous File',
    description: 'Go to previous file',
    category: 'diff',
  });

  useKeyboardShortcut([']'], onNext, {
    enabled,
    label: 'Next File',
    description: 'Go to next file',
    category: 'diff',
  });
}
