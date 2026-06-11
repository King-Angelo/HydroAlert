export function meterValue(value: unknown): number {
  return Number(value) || 0;
}

export function formatMeters(value: unknown, decimals = 2): string {
  return meterValue(value).toFixed(decimals);
}
