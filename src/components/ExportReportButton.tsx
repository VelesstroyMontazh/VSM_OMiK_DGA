"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ExportReportType = "overview" | "hr" | "kpi";

export interface ExportReportButtonProps {
  type: ExportReportType;
  params?: Record<string, string | null | undefined>;
  label?: string;
  className?: string;
}

function buildExportUrl(type: ExportReportType, params: ExportReportButtonProps["params"]): string {
  const qs = new URLSearchParams({ type });
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) qs.set(key, value);
    }
  }
  return `/api/dashboard/export?${qs.toString()}`;
}

function defaultFilename(type: ExportReportType): string {
  const stamp = new Date().toISOString().slice(0, 10);
  switch (type) {
    case "overview":
      return `overview_${stamp}.xlsx`;
    case "hr":
      return `hr_movement_${stamp}.xlsx`;
    case "kpi":
      return `kpi_${stamp}.xlsx`;
    default:
      return `report_${stamp}.xlsx`;
  }
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(header);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Скачивание Excel-отчёта через /api/dashboard/export */
export default function ExportReportButton({
  type,
  params,
  label = "Скачать отчёт",
  className,
}: ExportReportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(buildExportUrl(type, params), { cache: "no-store" });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(
        res.headers.get("Content-Disposition"),
        defaultFilename(type),
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка экспорта");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={loading}
      onClick={() => void handleExport()}
    >
      {loading ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-1.5 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
