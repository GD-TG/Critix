export function hasOffset(value: string): boolean {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

export function toDateInput(value: string, zone: string): string {
  if (!value || !hasOffset(value)) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function fromDateInput(value: string, zone: string): string {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new RangeError("Некорректная дата");
  const wall = Date.parse(value + ":00Z");
  if (!Number.isFinite(wall)) throw new RangeError("Некорректная дата");
  // Resolve wall time against the zone's offsets on either side of a DST change.
  // Reject gaps and repeated times instead of guessing the intended instant.
  const candidates = new Set<string>();
  for (const hours of [-48, -24, 0, 24, 48]) {
    const sample = wall + hours * 3600000;
    const localSample = toDateInput(new Date(sample).toISOString(), zone);
    const offset = Date.parse(localSample + ":00Z") - sample;
    const candidate = new Date(wall - offset).toISOString();
    if (toDateInput(candidate, zone) === value) candidates.add(candidate);
  }
  if (candidates.size !== 1)
    throw new RangeError(
      "Это время отсутствует или повторяется при переводе часов",
    );
  return [...candidates][0];
}
