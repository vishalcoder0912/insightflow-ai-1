import { collection, doc, writeBatch } from "firebase/firestore";
import { db, isFirebaseTrackingEnabled } from "@/shared/services/firebase";

type EventType = "click" | "session" | "feature";

interface AnalyticsEvent {
  eventType: EventType;
  timestamp: string;
  metadata: {
    label: string;
    page: string;
    duration?: number;
    extra?: Record<string, unknown>;
  };
}

const STORAGE_KEY = "insightflow.analytics.queue";
const FLUSH_DELAY_MS = 1500;
const MAX_BATCH_SIZE = 20;
const CLICK_THROTTLE_MS = 750;
const FEATURE_THROTTLE_MS = 5000;

const getWindow = () => (typeof window !== "undefined" ? window : null);

class AnalyticsTracker {
  private queue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushInFlight = false;
  private sessionStartedAt = Date.now();
  private sessionTracked = false;
  private lastClickAt = new Map<string, number>();
  private lastFeatureAt = new Map<string, number>();
  private currentPage = "/";

  constructor() {
    this.queue = this.readPersistedQueue();
  }

  setPage(page: string) {
    this.currentPage = page || "/";
  }

  trackClick(label: string, extra: Record<string, unknown> = {}) {
    if (!label) return;
    const key = `${this.currentPage}:${label}`;
    const now = Date.now();
    if (now - (this.lastClickAt.get(key) || 0) < CLICK_THROTTLE_MS) return;
    this.lastClickAt.set(key, now);

    this.enqueue({
      eventType: "click",
      timestamp: new Date().toISOString(),
      metadata: {
        label,
        page: this.currentPage,
        extra,
      },
    });
  }

  trackFeature(label: string, extra: Record<string, unknown> = {}) {
    if (!label) return;
    const key = `${this.currentPage}:${label}`;
    const now = Date.now();
    if (now - (this.lastFeatureAt.get(key) || 0) < FEATURE_THROTTLE_MS) return;
    this.lastFeatureAt.set(key, now);

    this.enqueue({
      eventType: "feature",
      timestamp: new Date().toISOString(),
      metadata: {
        label,
        page: this.currentPage,
        extra,
      },
    });
  }

  trackSessionEnd() {
    if (this.sessionTracked) return;
    this.sessionTracked = true;

    const duration = Math.max(1, Math.round((Date.now() - this.sessionStartedAt) / 1000));
    this.enqueue({
      eventType: "session",
      timestamp: new Date().toISOString(),
      metadata: {
        label: "app_session",
        page: this.currentPage,
        duration,
        extra: {},
      },
    });

    this.flushSoon(0);
  }

  flushSoon(delay = FLUSH_DELAY_MS) {
    if (!isFirebaseTrackingEnabled || !db) return;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      void this.flush();
    }, delay);
  }

  private enqueue(event: AnalyticsEvent) {
    if (!isFirebaseTrackingEnabled || !db) return;
    this.queue.push(event);
    this.persistQueue();

    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flushSoon(0);
      return;
    }

    this.flushSoon();
  }

  private async flush() {
    if (!isFirebaseTrackingEnabled || !db || this.flushInFlight || this.queue.length === 0) return;

    this.flushInFlight = true;
    const batchItems = this.queue.slice(0, MAX_BATCH_SIZE);

    try {
      const batch = writeBatch(db);
      const eventsCollection = collection(db, "user_events");

      batchItems.forEach((event) => {
        batch.set(doc(eventsCollection), event);
      });

      await batch.commit();
      this.queue = this.queue.slice(batchItems.length);
      this.persistQueue();

      if (this.queue.length > 0) {
        this.flushSoon(0);
      }
    } catch {
      this.persistQueue();
    } finally {
      this.flushInFlight = false;
    }
  }

  private readPersistedQueue() {
    const win = getWindow();
    if (!win) return [];

    try {
      const raw = win.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persistQueue() {
    const win = getWindow();
    if (!win) return;

    try {
      win.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Fail silently.
    }
  }
}

export const analyticsTracker = new AnalyticsTracker();
