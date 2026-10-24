"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

interface LoadingContextType {
  isLoading: boolean;
  progress: number;
  loadingMessage: string;
  startLoading: (message?: string) => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

function NavigationListener({ onRouteComplete }: { onRouteComplete: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Route transition finished
    onRouteComplete();
  }, [pathname, searchParams, onRouteComplete]);

  return null;
}

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing request...");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback((message?: string) => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setLoadingMessage(message || "Processing request...");
    setIsLoading(true);
    setProgress(20);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        // Exponential slowdown as it approaches 90%
        const increment = Math.max(1, (90 - prev) * 0.15);
        return Math.min(90, prev + increment);
      });
    }, 180);
  }, []);

  const stopLoading = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    completeTimerRef.current = setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 300);
  }, []);

  // Global click interception for client-side Link navigations
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Don't intercept if modified click (Ctrl, Cmd, Shift, Alt) or right click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = (e.target as HTMLElement).closest("a");
      if (!target || !target.href) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Ignore hash links, external links, mailto/tel, or target="_blank"
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        target.hasAttribute("download")
      ) {
        return;
      }

      const url = new URL(target.href, window.location.href);
      const isInternal = url.origin === window.location.origin;

      if (!isInternal) return;

      // Ignore if clicking link to current exact URL
      const currentUrl = window.location.pathname + window.location.search;
      const targetUrl = url.pathname + url.search;
      if (currentUrl === targetUrl && !url.hash) return;

      // Extract a meaningful label for the loading message
      const linkText = target.innerText?.trim();
      const message = linkText && linkText.length < 35
        ? `Loading ${linkText}...`
        : "Processing request...";

      startLoading(message);
    };

    const handlePopState = () => {
      startLoading("Navigating...");
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearInterval(timerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        progress,
        loadingMessage,
        startLoading,
        stopLoading,
      }}
    >
      <Suspense fallback={null}>
        <NavigationListener onRouteComplete={stopLoading} />
      </Suspense>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used within a LoadingProvider");
  }
  return context;
}
