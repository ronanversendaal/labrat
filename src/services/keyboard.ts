/**
 * Keyboard shortcut registry and utilities
 * Provides platform-aware keyboard handling for the application
 */

export interface KeyboardShortcut {
  /** Display name for the shortcut */
  label: string;
  /** Human-readable description */
  description: string;
  /** Key combination (uses meta for ⌘/Ctrl) */
  keys: string[];
  /** Category for help display */
  category: ShortcutCategory;
  /** Handler function */
  handler: (e: KeyboardEvent) => void;
  /** Whether this shortcut is enabled */
  enabled?: boolean;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
}

export type ShortcutCategory =
  | 'global'
  | 'navigation'
  | 'mr-list'
  | 'diff'
  | 'editing'
  | 'review';

export interface ParsedKey {
  key: string;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

/**
 * Detect if we're on macOS
 */
export function isMac(): boolean {
  if (typeof window === 'undefined') return false;
  // Use userAgentData if available (modern browsers), fallback to userAgent
  const userAgentData = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  if (userAgentData?.platform) {
    return userAgentData.platform.toLowerCase().includes('mac');
  }
  return navigator.userAgent.toUpperCase().includes('MAC');
}

/**
 * Get the modifier key display string
 */
export function getModifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl';
}

/**
 * Parse a key combination string into components
 * Examples: "meta+k", "shift+meta+p", "escape", "j"
 */
export function parseKeyCombo(combo: string): ParsedKey {
  const parts = combo.toLowerCase().split('+');
  return {
    key: parts[parts.length - 1],
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('⌘'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    ctrl: parts.includes('ctrl'),
  };
}

/**
 * Check if a keyboard event matches a key combination
 */
export function matchesKeyCombo(event: KeyboardEvent, combo: string): boolean {
  const parsed = parseKeyCombo(combo);

  // Handle meta key (⌘ on Mac, Ctrl on Windows/Linux)
  const metaPressed = isMac() ? event.metaKey : event.ctrlKey;

  if (parsed.meta && !metaPressed) return false;
  if (!parsed.meta && metaPressed) return false;

  if (parsed.shift && !event.shiftKey) return false;
  if (!parsed.shift && event.shiftKey && parsed.key.length === 1) return false;

  if (parsed.alt && !event.altKey) return false;
  if (!parsed.alt && event.altKey) return false;

  // On Mac, check for ctrl separately when not using meta as ctrl
  if (!isMac()) {
    if (parsed.ctrl && !event.ctrlKey) return false;
  }

  // Check the key itself
  const eventKey = event.key.toLowerCase();
  const targetKey = parsed.key.toLowerCase();

  // Special key mappings
  const keyMap: Record<string, string[]> = {
    'escape': ['escape', 'esc'],
    'enter': ['enter', 'return'],
    'arrowup': ['arrowup', 'up'],
    'arrowdown': ['arrowdown', 'down'],
    'arrowleft': ['arrowleft', 'left'],
    'arrowright': ['arrowright', 'right'],
    '/': ['/', '?'],
    '?': ['?', '/'],
  };

  const validKeys = keyMap[targetKey] || [targetKey];
  return validKeys.includes(eventKey);
}

/**
 * Format a key combination for display
 */
export function formatKeyCombo(combo: string): string {
  const parsed = parseKeyCombo(combo);
  const parts: string[] = [];

  if (parsed.meta) {
    parts.push(isMac() ? '⌘' : 'Ctrl');
  }
  if (parsed.shift) {
    parts.push('Shift');
  }
  if (parsed.alt) {
    parts.push(isMac() ? '⌥' : 'Alt');
  }
  if (parsed.ctrl && isMac()) {
    parts.push('⌃');
  }

  // Format special keys
  const keyDisplay: Record<string, string> = {
    'escape': 'Esc',
    'enter': '↵',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    'backspace': '⌫',
    'delete': 'Del',
    'tab': 'Tab',
    ' ': 'Space',
  };

  const key = parsed.key.toLowerCase();
  parts.push(keyDisplay[key] || parsed.key.toUpperCase());

  return parts.join(isMac() ? '' : '+');
}

/**
 * Keyboard shortcut registry
 */
class KeyboardRegistry {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private listeners: Set<(shortcuts: KeyboardShortcut[]) => void> = new Set();
  private isListening = false;

  /**
   * Register a keyboard shortcut
   */
  register(id: string, shortcut: KeyboardShortcut): void {
    this.shortcuts.set(id, { ...shortcut, enabled: shortcut.enabled ?? true });
    this.notifyListeners();
    this.startListening();
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    this.shortcuts.delete(id);
    this.notifyListeners();
  }

  /**
   * Enable or disable a shortcut
   */
  setEnabled(id: string, enabled: boolean): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      shortcut.enabled = enabled;
      this.notifyListeners();
    }
  }

  /**
   * Get all registered shortcuts
   */
  getAll(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getByCategory(category: ShortcutCategory): KeyboardShortcut[] {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Subscribe to shortcut changes
   */
  subscribe(listener: (shortcuts: KeyboardShortcut[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const shortcuts = this.getAll();
    this.listeners.forEach(listener => listener(shortcuts));
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Skip if focus is in an input, textarea, or contenteditable
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow escape to blur
      if (event.key === 'Escape') {
        target.blur();
        return;
      }
      // Allow shortcuts with meta key even in inputs
      const metaPressed = isMac() ? event.metaKey : event.ctrlKey;
      if (!metaPressed) return;
    }

    for (const shortcut of this.shortcuts.values()) {
      if (!shortcut.enabled) continue;

      for (const combo of shortcut.keys) {
        if (matchesKeyCombo(event, combo)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler(event);
          return;
        }
      }
    }
  };

  private startListening(): void {
    if (this.isListening) return;
    window.addEventListener('keydown', this.handleKeyDown);
    this.isListening = true;
  }

  /**
   * Stop listening for keyboard events
   */
  stopListening(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.isListening = false;
  }

  /**
   * Clear all registered shortcuts
   */
  clear(): void {
    this.shortcuts.clear();
    this.notifyListeners();
  }
}

// Singleton instance
export const keyboardRegistry = new KeyboardRegistry();

// Default shortcut definitions for help display
export const DEFAULT_SHORTCUTS: Array<{
  id: string;
  shortcut: Omit<KeyboardShortcut, 'handler'>;
}> = [
  // Global
  {
    id: 'help',
    shortcut: {
      label: '?',
      description: 'Show keyboard shortcuts',
      keys: ['?', 'shift+/'],
      category: 'global',
    },
  },
  {
    id: 'search',
    shortcut: {
      label: 'Search',
      description: 'Focus search input',
      keys: ['/', 's'],
      category: 'global',
    },
  },
  {
    id: 'filter',
    shortcut: {
      label: 'Filter',
      description: 'Toggle filter panel',
      keys: ['f'],
      category: 'global',
    },
  },
  {
    id: 'close',
    shortcut: {
      label: 'Close',
      description: 'Close dialog or panel',
      keys: ['escape'],
      category: 'global',
    },
  },
  {
    id: 'toggle-sidebar',
    shortcut: {
      label: 'Toggle Sidebar',
      description: 'Show/hide sidebar',
      keys: ['meta+\\'],
      category: 'global',
    },
  },

  // MR List
  {
    id: 'my-mrs',
    shortcut: {
      label: 'My MRs',
      description: 'Show my merge requests',
      keys: ['shift+m'],
      category: 'mr-list',
    },
  },
  {
    id: 'review-requests',
    shortcut: {
      label: 'Review Requests',
      description: 'Show review requests',
      keys: ['shift+r'],
      category: 'mr-list',
    },
  },
  {
    id: 'next-mr',
    shortcut: {
      label: 'Next MR',
      description: 'Select next merge request',
      keys: ['j', 'arrowdown'],
      category: 'mr-list',
    },
  },
  {
    id: 'prev-mr',
    shortcut: {
      label: 'Previous MR',
      description: 'Select previous merge request',
      keys: ['k', 'arrowup'],
      category: 'mr-list',
    },
  },
  {
    id: 'open-mr',
    shortcut: {
      label: 'Open MR',
      description: 'Open selected merge request',
      keys: ['enter', 'o'],
      category: 'mr-list',
    },
  },

  // Diff Navigation
  {
    id: 'next-file',
    shortcut: {
      label: 'Next File',
      description: 'Go to next file',
      keys: [']', 'j'],
      category: 'diff',
    },
  },
  {
    id: 'prev-file',
    shortcut: {
      label: 'Previous File',
      description: 'Go to previous file',
      keys: ['[', 'k'],
      category: 'diff',
    },
  },
  {
    id: 'next-thread',
    shortcut: {
      label: 'Next Thread',
      description: 'Jump to next discussion thread',
      keys: ['n'],
      category: 'diff',
    },
  },
  {
    id: 'prev-thread',
    shortcut: {
      label: 'Previous Thread',
      description: 'Jump to previous discussion thread',
      keys: ['p'],
      category: 'diff',
    },
  },
  {
    id: 'quick-file',
    shortcut: {
      label: 'Quick File',
      description: 'Open quick file picker',
      keys: ['meta+p', 't'],
      category: 'diff',
    },
  },
  {
    id: 'toggle-file-tree',
    shortcut: {
      label: 'Toggle File Tree',
      description: 'Show/hide file tree',
      keys: ['shift+f'],
      category: 'diff',
    },
  },
  {
    id: 'mark-viewed',
    shortcut: {
      label: 'Mark Viewed',
      description: 'Mark file as viewed',
      keys: ['v'],
      category: 'diff',
    },
  },
  {
    id: 'copy-branch',
    shortcut: {
      label: 'Copy Branch',
      description: 'Copy branch name to clipboard',
      keys: ['b'],
      category: 'diff',
    },
  },
  {
    id: 'permalink',
    shortcut: {
      label: 'Permalink',
      description: 'Copy permalink to current line',
      keys: ['y'],
      category: 'diff',
    },
  },

  // Commit Navigation
  {
    id: 'next-commit',
    shortcut: {
      label: 'Next Commit',
      description: 'Go to next commit',
      keys: ['c'],
      category: 'diff',
    },
  },
  {
    id: 'prev-commit',
    shortcut: {
      label: 'Previous Commit',
      description: 'Go to previous commit',
      keys: ['x'],
      category: 'diff',
    },
  },

  // Editing
  {
    id: 'bold',
    shortcut: {
      label: 'Bold',
      description: 'Make text bold',
      keys: ['meta+b'],
      category: 'editing',
    },
  },
  {
    id: 'italic',
    shortcut: {
      label: 'Italic',
      description: 'Make text italic',
      keys: ['meta+i'],
      category: 'editing',
    },
  },
  {
    id: 'link',
    shortcut: {
      label: 'Link',
      description: 'Insert link',
      keys: ['meta+k'],
      category: 'editing',
    },
  },
  {
    id: 'strikethrough',
    shortcut: {
      label: 'Strikethrough',
      description: 'Strikethrough text',
      keys: ['meta+shift+x'],
      category: 'editing',
    },
  },
  {
    id: 'preview',
    shortcut: {
      label: 'Preview',
      description: 'Toggle preview mode',
      keys: ['meta+shift+p'],
      category: 'editing',
    },
  },

  // Review Actions
  {
    id: 'reply-quote',
    shortcut: {
      label: 'Reply with Quote',
      description: 'Reply with quoted text',
      keys: ['r'],
      category: 'review',
    },
  },
  {
    id: 'add-to-review',
    shortcut: {
      label: 'Add to Review',
      description: 'Add comment to pending review',
      keys: ['meta+enter'],
      category: 'review',
    },
  },
  {
    id: 'publish-review',
    shortcut: {
      label: 'Publish Review',
      description: 'Publish pending review',
      keys: ['meta+shift+enter'],
      category: 'review',
    },
  },
];

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: ShortcutCategory): string {
  const names: Record<ShortcutCategory, string> = {
    global: 'Global',
    navigation: 'Navigation',
    'mr-list': 'MR List',
    diff: 'Diff View',
    editing: 'Editing',
    review: 'Review',
  };
  return names[category];
}
