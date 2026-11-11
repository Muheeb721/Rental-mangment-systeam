import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';

let lenisInstance = null;

/** Lenis smooth scrolling (skipped when the user prefers reduced motion) + scroll-to-top on navigation. */
export default function SmoothScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, prevent: (node) => Boolean(node.closest?.('[data-lenis-prevent], .leaflet-container, .ant-select-dropdown, .ant-modal-wrap, .ant-drawer')) });
    lenisInstance = lenis;
    let raf = 0;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); lenisInstance = null; };
  }, []);

  useEffect(() => {
    if (lenisInstance) lenisInstance.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
