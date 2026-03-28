export const normalizeValue = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const normalizeQueryText = (value: string) =>
  String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const capitalize = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
