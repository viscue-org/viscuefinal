import React, { useRef, useEffect } from 'react';
import '../../viscue-web-components.js';

export const CenterFloatingBar = ({ active, undo, redo, canUndo, canRedo, onToolbarAction, onToolbarOption, onToolbarPanelClose, ...props }) => {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    
    const handleAction = (e) => onToolbarAction?.(e.detail);
    const handleOption = (e) => onToolbarOption?.(e.detail);
    const handlePanelClose = (e) => onToolbarPanelClose?.();

    el.addEventListener('toolbar-action', handleAction);
    el.addEventListener('toolbar-option', handleOption);
    el.addEventListener('toolbar-panel-close', handlePanelClose);
    
    return () => {
      el.removeEventListener('toolbar-action', handleAction);
      el.removeEventListener('toolbar-option', handleOption);
      el.removeEventListener('toolbar-panel-close', handlePanelClose);
    };
  }, [onToolbarAction, onToolbarOption, onToolbarPanelClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.active = active || '';
  }, [active]);

  useEffect(() => {
    const root = ref.current?.shadowRoot;
    if (!root) return;
    const undoButton = root.querySelector('[data-action="undo"]');
    const redoButton = root.querySelector('[data-action="redo"]');
    if (undoButton) {
      undoButton.disabled = !canUndo;
      undoButton.setAttribute('aria-disabled', String(!canUndo));
    }
    if (redoButton) {
      redoButton.disabled = !canRedo;
      redoButton.setAttribute('aria-disabled', String(!canRedo));
    }
  }, [canUndo, canRedo]);

  return <center-floating-bar ref={ref} {...props}></center-floating-bar>;
};

export const ReferenceEmpty = ({ onReferenceRequest, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const handler = (e) => onReferenceRequest?.(e.detail);
    el.addEventListener('reference-request', handler);
    return () => el.removeEventListener('reference-request', handler);
  }, [onReferenceRequest]);
  return <viscue-reference-empty ref={ref} {...props}></viscue-reference-empty>;
};

export const UtilityMenu = ({ theme = 'light', onAppearanceToggle, onMoreRequest, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const handleAppearance = (e) => onAppearanceToggle?.(e.detail.active, e.detail.theme);
    const handleMore = (e) => onMoreRequest?.();
    el.addEventListener('appearance-toggle', handleAppearance);
    el.addEventListener('more-request', handleMore);
    return () => {
      el.removeEventListener('appearance-toggle', handleAppearance);
      el.removeEventListener('more-request', handleMore);
    };
  }, [onAppearanceToggle, onMoreRequest]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.setAttribute('theme', theme);
  }, [theme]);

  return <viscue-utility-menu ref={ref} {...props}></viscue-utility-menu>;
};

export const ViewSwitcher = ({ value, count = 0, gridActive = true, componentsActive = false, onViewChange, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const handler = (e) => onViewChange?.(e.detail.value);
    el.addEventListener('view-change', handler);
    return () => el.removeEventListener('view-change', handler);
  }, [onViewChange]);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value) el.setAttribute('value', value);
    el.setAttribute('count', String(count));
    el.toggleAttribute('grid-active', gridActive);
    el.toggleAttribute('components-active', componentsActive);
  }, [componentsActive, count, gridActive, value]);

  return <viscue-view-switcher ref={ref} {...props}></viscue-view-switcher>;
};

export const CloseButton = ({ onClose, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const handler = (e) => onClose?.();
    el.addEventListener('close', handler);
    return () => el.removeEventListener('close', handler);
  }, [onClose]);
  return <viscue-close-button ref={ref} {...props}></viscue-close-button>;
};

export const HistoryPanel = ({ onHistoryEnhance, onHistoryClose, onHistoryCurrentState, onHistoryRestore, historyItems, ...props }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && historyItems) {
      ref.current.historyItems = historyItems;
    }
  }, [historyItems]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const hEnhance = () => onHistoryEnhance?.();
    const hClose = () => onHistoryClose?.();
    const hCurrent = () => onHistoryCurrentState?.();
    const hRestore = (e) => onHistoryRestore?.(e.detail);
    
    el.addEventListener('history-enhance', hEnhance);
    el.addEventListener('history-close', hClose);
    el.addEventListener('history-current-state', hCurrent);
    el.addEventListener('history-restore', hRestore);
    
    return () => {
      el.removeEventListener('history-enhance', hEnhance);
      el.removeEventListener('history-close', hClose);
      el.removeEventListener('history-current-state', hCurrent);
      el.removeEventListener('history-restore', hRestore);
    };
  }, [onHistoryEnhance, onHistoryClose, onHistoryCurrentState, onHistoryRestore]);

  return <viscue-history-panel ref={ref} {...props}></viscue-history-panel>;
};
