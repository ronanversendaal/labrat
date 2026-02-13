/**
 * Hook for keyboard shortcuts
 * Provides easy registration and management of keyboard shortcuts in components
 */

import { useEffect, useState, useMemo, useRef } from 'react';
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
 *
 * Uses a ref for handlers so the registered callback always invokes the
 * latest handler without needing the effect to re-run on every render.
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

  // Keep handlers in a ref so the registered callback always calls the latest version
  const handlersRef = useRef(shortcuts);
  handlersRef.current = shortcuts;

  // Stable serialization of shortcut metadata (ids + keys) to detect structural changes
  const shortcutKeys = shortcuts.map((s) => `${s.id}:${s.keys.join(',')}`).join('|');

  useEffect(() => {
    if (!enabled) return;

    const registeredIds: string[] = [];

    handlersRef.current.forEach((shortcut) => {
      const id = scope ? `${scope}:${shortcut.id}` : shortcut.id;
      keyboardRegistry.register(id, {
        keys: shortcut.keys,
        // Indirect through ref so the handler is never stale
        handler: (e: KeyboardEvent) => {
          const current = handlersRef.current.find((s) => s.id === shortcut.id);
          current?.handler(e);
        },
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
  }, [shortcutKeys, enabled, scope]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const keysKey = keys.join(',');

  useEffect(() => {
    if (!enabled) return;

    const id = `shortcut-${keysKey}-${Math.random().toString(36).slice(2, 9)}`;

    keyboardRegistry.register(id, {
      keys,
      handler: (e: KeyboardEvent) => handlerRef.current(e),
      label,
      description,
      category,
      preventDefault,
      enabled: true,
    });

    return () => {
      keyboardRegistry.unregister(id);
    };
  }, [keysKey, enabled, label, description, category, preventDefault]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const onUpRef = useRef(onUp);
  onUpRef.current = onUp;
  const onDownRef = useRef(onDown);
  onDownRef.current = onDown;

  useEffect(() => {
    if (!enabled) return;

    const id = `arrow-nav-${Math.random().toString(36).slice(2, 9)}`;

    keyboardRegistry.register(id, {
      keys: ['arrowup', 'arrowdown', 'j', 'k'],
      handler: (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'k') {
          onUpRef.current();
        } else if (e.key === 'ArrowDown' || e.key === 'j') {
          onDownRef.current();
        }
      },
      label: 'Navigate',
      description: 'Move selection up/down',
      category: 'navigation',
      enabled: true,
    });

    return () => {
      keyboardRegistry.unregister(id);
    };
  }, [enabled]);
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
