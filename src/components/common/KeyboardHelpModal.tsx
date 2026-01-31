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
  'diff',
  'editing',
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
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts" size="lg">
      <div className="max-h-[70vh] overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
          {CATEGORY_ORDER.map((category) => {
            const shortcuts = groupedShortcuts[category];
            if (!shortcuts.length) return null;

            return (
              <div key={category}>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-1">
                  {getCategoryDisplayName(category)}
                </h3>
                <div className="space-y-2">
                  {shortcuts.map(({ id, shortcut }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-400">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1 ml-4">
                        {shortcut.keys.slice(0, 2).map((key, i) => (
                          <span key={key}>
                            {i > 0 && (
                              <span className="text-gray-400 dark:text-gray-500 mx-1">or</span>
                            )}
                            <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-800 dark:text-gray-200">
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

        <div className="border-t border-gray-200 dark:border-gray-700 p-4 mt-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">?</kbd> anytime to show this help
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
