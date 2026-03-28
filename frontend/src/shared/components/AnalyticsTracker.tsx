import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { analyticsTracker } from "@/analytics/tracker";

const getButtonLabel = (element: HTMLElement) => {
  const explicitLabel = element.getAttribute("data-track-label") || element.getAttribute("aria-label");
  if (explicitLabel) return explicitLabel.trim();

  const text = element.textContent?.replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 80);

  return "button_click";
};

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    analyticsTracker.setPage(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const button = target.closest("button");
      if (!(button instanceof HTMLElement)) return;

      analyticsTracker.trackClick(getButtonLabel(button));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        analyticsTracker.trackSessionEnd();
      }
    };

    const handlePageExit = () => {
      analyticsTracker.trackSessionEnd();
    };

    document.addEventListener("click", handleClick, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageExit);
    window.addEventListener("beforeunload", handlePageExit);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageExit);
      window.removeEventListener("beforeunload", handlePageExit);
    };
  }, []);

  return null;
}
