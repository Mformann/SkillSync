import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Wait for lazy routes and their data, then announce the new page by its heading. */
export function RouteFocus() {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.getElementById("main-content");
    if (!root) return;
    const focusHeading = () => {
      const heading = root.querySelector<HTMLElement>("main h1, [role=main] h1");
      if (!heading) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      if (!window.location.hash) window.scrollTo(0, 0);
      return true;
    };
    const observer = new MutationObserver(() => { if (focusHeading()) observer.disconnect(); });
    // Run after React has committed this route instead of focusing the previous page.
    const frame = requestAnimationFrame(() => {
      if (!focusHeading()) observer.observe(root, { childList: true, subtree: true });
    });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [pathname]);
  return null;
}
