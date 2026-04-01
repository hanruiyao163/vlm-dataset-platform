import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseModelOptions(value: string | undefined) {
  return Array.from(
    new Set(
      (value ?? "")
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

const zhCnDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const zhCnDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const chinaFilenameDateTimeFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function parseChinaTime(value: string | Date) {
  if (value instanceof Date) return value;
  const trimmed = value.trim();
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed);
  }
  const normalized = trimmed.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

export function formatChinaDateTime(value: string | Date) {
  return zhCnDateTimeFormatter.format(parseChinaTime(value));
}

export function formatChinaDate(value: string | Date) {
  return zhCnDateFormatter.format(parseChinaTime(value));
}

export function formatChinaFilenameTimestamp(value: Date = new Date()) {
  return chinaFilenameDateTimeFormatter
    .format(value)
    .replace(" ", "-")
    .replace(/:/g, "-");
}
