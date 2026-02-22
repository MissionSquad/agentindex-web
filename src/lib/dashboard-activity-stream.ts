import type { DashboardActivityItem, DashboardActivityStreamMessage } from "../types/api";

export interface DashboardActivityStreamHandlers {
  onConnected?: (timestamp: number) => void;
  onActivity?: (item: DashboardActivityItem) => void;
  onError?: (error: unknown) => void;
}

export interface DashboardActivityStreamClient {
  start: () => void;
  stop: () => void;
}

interface DashboardActivityStreamOptions {
  baseUrl?: string;
  webSocketFactory?: (url: string) => WebSocket;
  random?: () => number;
}

const DASHBOARD_ACTIVITY_STREAM_PATH = "/v1/ws/dashboard-activity";
const RECONNECT_INITIAL_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_JITTER_MAX_MS = 250;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function parseDashboardActivityItem(value: unknown): DashboardActivityItem | null {
  if (!isRecord(value)) {
    return null;
  }

  const chainId = parseFiniteNumber(value.chainId);
  const logIndex = parseFiniteNumber(value.logIndex);
  const timestamp = parseFiniteNumber(value.timestamp);
  const eventName = typeof value.eventName === "string" ? value.eventName : null;
  const txHash = typeof value.txHash === "string" ? value.txHash.toLowerCase() : null;
  const summary = typeof value.summary === "string" ? value.summary : null;
  const agentIdRaw = value.agentId;
  const agentNameRaw = value.agentName;
  const agentImageUrlRaw = value.agentImageUrl;

  if (
    chainId === null ||
    !Number.isInteger(chainId) ||
    chainId <= 0 ||
    logIndex === null ||
    !Number.isInteger(logIndex) ||
    timestamp === null ||
    eventName === null ||
    txHash === null ||
    !/^0x[0-9a-f]{64}$/.test(txHash) ||
    summary === null
  ) {
    return null;
  }

  const agentId =
    typeof agentIdRaw === "string" || typeof agentIdRaw === "number"
      ? String(agentIdRaw)
      : null;

  return {
    chainId,
    eventName,
    agentId,
    agentName: typeof agentNameRaw === "string" ? agentNameRaw : null,
    agentImageUrl: typeof agentImageUrlRaw === "string" ? agentImageUrlRaw : null,
    txHash,
    logIndex,
    timestamp,
    summary,
  };
}

export function parseDashboardActivityStreamMessage(value: unknown): DashboardActivityStreamMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === "connected") {
    const timestamp = parseFiniteNumber(value.timestamp);
    if (timestamp === null) {
      return null;
    }
    return {
      type: "connected",
      timestamp,
    };
  }

  if (value.type === "activity") {
    const item = parseDashboardActivityItem(value.item);
    if (!item) {
      return null;
    }

    return {
      type: "activity",
      item,
    };
  }

  return null;
}

export function resolveDashboardActivityWsBaseUrl(env: ImportMetaEnv = import.meta.env): string {
  const wsOverride = env.PUBLIC_SCANNER_WS_BASE_URL?.trim();
  if (wsOverride) {
    return trimTrailingSlash(wsOverride);
  }

  const apiBase = (env.PUBLIC_SCANNER_API_BASE_URL ?? "http://localhost:3000").trim();
  const normalizedApiBase = trimTrailingSlash(apiBase);

  if (normalizedApiBase.startsWith("https://")) {
    return `wss://${normalizedApiBase.slice("https://".length)}`;
  }

  if (normalizedApiBase.startsWith("http://")) {
    return `ws://${normalizedApiBase.slice("http://".length)}`;
  }

  if (normalizedApiBase.startsWith("ws://") || normalizedApiBase.startsWith("wss://")) {
    return normalizedApiBase;
  }

  throw new Error("PUBLIC_SCANNER_API_BASE_URL must start with http:// or https://");
}

export function buildDashboardActivityWsUrl(env: ImportMetaEnv = import.meta.env): string {
  return `${resolveDashboardActivityWsBaseUrl(env)}${DASHBOARD_ACTIVITY_STREAM_PATH}`;
}

export function computeDashboardActivityReconnectDelayMs(attempt: number, randomValue: number): number {
  const exponentialDelay = Math.min(RECONNECT_MAX_DELAY_MS, RECONNECT_INITIAL_DELAY_MS * Math.pow(2, attempt));
  const clampedRandom = Math.max(0, Math.min(1, randomValue));
  const jitter = Math.min(
    RECONNECT_JITTER_MAX_MS,
    Math.floor(clampedRandom * (RECONNECT_JITTER_MAX_MS + 1)),
  );
  return exponentialDelay + jitter;
}

export function createDashboardActivityStreamClient(
  handlers: DashboardActivityStreamHandlers,
  options: DashboardActivityStreamOptions = {},
): DashboardActivityStreamClient {
  const wsFactory = options.webSocketFactory ?? ((url: string) => new WebSocket(url));
  const random = options.random ?? Math.random;
  const streamUrl = `${trimTrailingSlash(options.baseUrl ?? resolveDashboardActivityWsBaseUrl())}${DASHBOARD_ACTIVITY_STREAM_PATH}`;

  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempt = 0;
  let running = false;

  const clearReconnectTimer = (): void => {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const handleSocketMessage = (raw: unknown): void => {
    if (typeof raw !== "string") {
      handlers.onError?.(new Error("Dashboard activity stream payload must be a JSON string"));
      return;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(raw) as unknown;
    } catch (error) {
      handlers.onError?.(error);
      return;
    }

    const message = parseDashboardActivityStreamMessage(parsedPayload);
    if (!message) {
      handlers.onError?.(new Error("Invalid dashboard activity stream message"));
      return;
    }

    if (message.type === "connected") {
      handlers.onConnected?.(message.timestamp);
      return;
    }

    handlers.onActivity?.(message.item);
  };

  const scheduleReconnect = (): void => {
    if (!running) return;

    clearReconnectTimer();
    const delay = computeDashboardActivityReconnectDelayMs(reconnectAttempt, random());
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = (): void => {
    if (!running) return;

    try {
      socket = wsFactory(streamUrl);
    } catch (error) {
      handlers.onError?.(error);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      reconnectAttempt = 0;
    };

    socket.onmessage = (event: MessageEvent) => {
      handleSocketMessage(event.data);
    };

    socket.onerror = (event: Event) => {
      handlers.onError?.(event);
    };

    socket.onclose = () => {
      socket = null;
      scheduleReconnect();
    };
  };

  return {
    start: (): void => {
      if (running) return;
      running = true;
      connect();
    },
    stop: (): void => {
      if (!running) return;
      running = false;
      reconnectAttempt = 0;
      clearReconnectTimer();

      if (!socket) return;

      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }

      socket = null;
    },
  };
}
