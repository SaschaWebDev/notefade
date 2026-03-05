import { useState, useEffect, useRef, type ReactNode } from 'react';
import styles from './ContentFade.module.css';

const FADE_TRANSITION_MS = 180

interface ContentFadeProps {
  contentKey: string;
  children: ReactNode;
}

export function ContentFade({ contentKey, children }: ContentFadeProps) {
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [visible, setVisible] = useState(true);
  const isFirstMount = useRef(true);
  const prevKey = useRef(contentKey);
  const latestChildren = useRef(children);
  latestChildren.current = children;

  // Keep displayed children in sync when key hasn't changed
  // (e.g. typing in textarea, state updates within same view)
  if (contentKey === prevKey.current && visible) {
    if (displayedChildren !== children) {
      setDisplayedChildren(children);
    }
  }

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }

    if (contentKey === prevKey.current) {
      return;
    }

    prevKey.current = contentKey;

    // Fade out
    setVisible(false);

    const timeout = setTimeout(() => {
      // Swap to latest children
      setDisplayedChildren(latestChildren.current);

      // Use rAF so browser registers opacity:0 before transitioning to 1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setVisible(true);
        });
      });
    }, FADE_TRANSITION_MS);

    return () => clearTimeout(timeout);
  }, [contentKey]);

  const className = `${styles.wrapper} ${visible ? styles.visible : styles.hidden}`;

  return <div className={className}>{displayedChildren}</div>;
}
