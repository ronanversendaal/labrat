/**
 * KeyboardHelpModal - Displays all keyboard shortcuts organized by category
 */

import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import {
  DEFAULT_SHORTCUTS,
  formatKeyCombo,
  getCategoryDisplayName,
  type ShortcutCategory,
} from '../../services/keyboard';

interface KeyboardHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_ORDER: ShortcutCategory[] = [
  'global',
  'mr-list',
  'navigation',
  'diff',
  'review',
];

export function KeyboardHelpModal({ isOpen, onClose }: KeyboardHelpModalProps) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Group shortcuts by category
  const groupedShortcuts = CATEGORY_ORDER.reduce(
    (acc, category) => {
      acc[category] = DEFAULT_SHORTCUTS.filter((s) => s.shortcut.category === category);
      return acc;
    },
    {} as Record<ShortcutCategory, typeof DEFAULT_SHORTCUTS>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="3xl">
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {CATEGORY_ORDER.map((category) => {
            const shortcuts = groupedShortcuts[category];
            if (!shortcuts.length) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-content mb-3 border-b border-edge pb-1">
                  {getCategoryDisplayName(category)}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map(({ id, shortcut }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-content-secondary">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1 ml-4">
                        {shortcut.keys.slice(0, 2).map((key, i) => (
                          <span key={key}>
                            {i > 0 && (
                              <span className="text-content-tertiary mx-1">or</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-mono bg-surface-alt border border-edge-strong rounded text-content">
                              {formatKeyCombo(key)}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-edge p-4 mt-4">
          <p className="text-xs text-content-secondary text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-surface-alt border border-edge-strong rounded">?</kbd> anytime to show this help
          </p>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Hook to manage keyboard help modal visibility
 */
export function useKeyboardHelpModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // ? or Shift+/ opens help
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
