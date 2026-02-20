const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  return `${(value * 100).toFixed(2)}%`;
}

export function normalizeEpochToMs(epoch: number): number {
  if (!Number.isFinite(epoch)) {
    return Number.NaN;
  }

  const magnitude = Math.abs(epoch);
  if (magnitude < 100_000_000_000) {
    return epoch * 1000;
  }

  if (magnitude < 100_000_000_000_000) {
    return epoch;
  }

  return Math.trunc(epoch / 1000);
}

export function formatTimestamp(epoch: number | null | undefined): string {
  if (epoch === null || epoch === undefined || Number.isNaN(epoch)) {
    return "N/A";
  }

  const epochMs = normalizeEpochToMs(epoch);
  if (!Number.isFinite(epochMs) || epochMs <= 0) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

export function formatDurationHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) {
    return "N/A";
  }

  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }

  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export function formatAddress(address: string | null | undefined): string {
  if (!address) {
    return "N/A";
  }

  const normalized = address.trim();
  if (!ADDRESS_RE.test(normalized)) {
    return normalized;
  }

  return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function formatTxHash(hash: string | null | undefined): string {
  if (!hash) {
    return "N/A";
  }

  const normalized = hash.trim();
  if (!TX_HASH_RE.test(normalized)) {
    return normalized;
  }

  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

export function capitalizeWords(value: string): string {
  return value
    .split(" ")
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`)
    .join(" ");
}

export function formatComputedNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not computed";
  }

  return formatNumber(value);
}

export function formatComputedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "Not computed";
  }

  return formatPercent(value);
}

/**
 * Middle-truncate a string to a maximum length, preserving the start and end.
 * Returns the original string unchanged when it fits within `maxLen`.
 */
export function formatMiddleTruncate(value: string | null | undefined, maxLen = 24): string {
  if (!value) {
    return "N/A";
  }

  if (value.length <= maxLen) {
    return value;
  }

  // Keep slightly more at the start than the end for readability.
  const keep = maxLen - 3; // 3 chars for "..."
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function formatKeyValueMap(values: Record<string, unknown>): Array<{ key: string; value: string }> {
  return Object.entries(values).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}
