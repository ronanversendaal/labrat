import { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';
import { useMRStore } from '../stores/mrStore';
import type { ActiveView } from '../stores/uiStore';
import type { MergeRequest } from '../types/gitlab';

interface NavEntry {
  activeView: ActiveView;
  selectedMrId: number | null;
  selectedMr: MergeRequest | null;
  isDetailOpen: boolean;
}

const MAX_HISTORY = 50;

function getCurrentNavState(): NavEntry {
  const { activeView } = useUIStore.getState();
  const { selectedMrId, selectedMr, isDetailOpen } = useMRStore.getState();
  return { activeView, selectedMrId, selectedMr, isDetailOpen };
}

/**
 * Manages an internal back/forward stack for in-app navigation.
 *
 * Only meaningful navigation events create history entries:
 *  - Switching views (My Reviews / My MRs / Pipelines)
 *  - Opening an MR detail
 *  - Closing an MR detail
 *  - Switching to a different MR while detail is open
 *
 * Selecting / highlighting an MR in the list is NOT tracked.
 *
 * Mouse back/forward buttons (button 3 / 4) are intercepted in the
 * capture phase so the Tauri webview never sees them.
 */
export function useNavigationHistory() {
  const backStackRef = useRef<NavEntry[]>([]);
  const forwardStackRef = useRef<NavEntry[]>([]);
  const currentRef = useRef<NavEntry>(getCurrentNavState());
  const isNavigatingRef = useRef(false);

  // -----------------------------------------------------------
  // Subscribe to store changes; debounce so rapid mutations
  // (e.g. sidebar click doing setActiveView + closeDetail +
  // setSelectedMr(null)) coalesce into one history entry.
  // -----------------------------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const scheduleCheck = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (isNavigatingRef.current) return;

        const next = getCurrentNavState();
        const prev = currentRef.current;

        const viewChanged = prev.activeView !== next.activeView;
        const detailToggled = prev.isDetailOpen !== next.isDetailOpen;
        const mrSwitched =
          prev.isDetailOpen &&
          next.isDetailOpen &&
          prev.selectedMrId !== next.selectedMrId;

        // Only meaningful navigations create entries
        if (!viewChanged && !detailToggled && !mrSwitched) return;

        backStackRef.current.push(prev);
        if (backStackRef.current.length > MAX_HISTORY) {
          backStackRef.current.shift();
        }
        forwardStackRef.current = [];
        currentRef.current = next;
      }, 50);
    };

    const unsubUI = useUIStore.subscribe(scheduleCheck);
    const unsubMR = useMRStore.subscribe(scheduleCheck);

    return () => {
      unsubUI();
      unsubMR();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // -----------------------------------------------------------
  // Intercept mouse back / forward buttons in the capture phase
  // so the webview never processes them as native navigation.
  // -----------------------------------------------------------
  useEffect(() => {
    const restore = (entry: NavEntry) => {
      isNavigatingRef.current = true;

      useUIStore.getState().setActiveView(entry.activeView);

      if (entry.isDetailOpen && entry.selectedMr) {
        useMRStore.getState().setSelectedMr(entry.selectedMr);
        useMRStore.getState().openDetail();
      } else {
        useMRStore.getState().closeDetail();
      }

      currentRef.current = entry;

      // Let stores settle before re-enabling tracking
      requestAnimationFrame(() => {
        isNavigatingRef.current = false;
      });
    };

    const goBack = () => {
      const stack = backStackRef.current;
      if (stack.length === 0) return;
      forwardStackRef.current.push(currentRef.current);
      restore(stack.pop()!);
    };

    const goForward = () => {
      const stack = forwardStackRef.current;
      if (stack.length === 0) return;
      backStackRef.current.push(currentRef.current);
      restore(stack.pop()!);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        e.stopPropagation();
        goBack();
      } else if (e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
        goForward();
      }
    };

    // Also block auxclick so the webview doesn't act on it
    const onAuxClick = (e: MouseEvent) => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('auxclick', onAuxClick, true);
    return () => {
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('auxclick', onAuxClick, true);
    };
  }, []);

  // -----------------------------------------------------------
  // Guard: if the webview somehow triggers a history navigation
  // (e.g. keyboard Alt+Left), push the current URL back so the
  // SPA never leaves its page.
  // -----------------------------------------------------------
  useEffect(() => {
    const onPopState = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}
