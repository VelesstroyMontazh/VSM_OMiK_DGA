"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  dateInputValueToDDMMYYYY,
  toDateInputValue,
} from "@/lib/formatDate";
import type { DatePreset } from "@/lib/hr-filters";

export interface HrFilterState {
  worksite: string | null;
  citizenship: string | null;
  preset: DatePreset;
  from: string | null;
  to: string | null;
  excludeItrAup: boolean;
}

export const DEFAULT_HR_FILTERS: HrFilterState = {
  worksite: null,
  citizenship: null,
  preset: "month",
  from: null,
  to: null,
  excludeItrAup: false,
};

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "month", label: "Текущий месяц" },
  { id: "3m", label: "3 месяца" },
  { id: "6m", label: "6 месяцев" },
  { id: "12m", label: "12 месяцев" },
  { id: "custom", label: "Свой период" },
];

export function hrFiltersToQuery(filters: HrFilterState): string {
  const params = new URLSearchParams();
  params.set("preset", filters.preset);
  if (filters.worksite) params.set("worksite", filters.worksite);
  if (filters.citizenship) params.set("citizenship", filters.citizenship);
  if (filters.excludeItrAup) params.set("excludeItrAup", "1");
  if (filters.preset === "custom") {
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
  }
  return params.toString();
}

interface HrEventFiltersProps {
  value: HrFilterState;
  onChange: (next: HrFilterState) => void;
  worksites: string[];
  citizenships: string[];
  /** Called only when user clicks Применить */
  onApply: () => void;
  onReset?: () => void;
  loading?: boolean;
}

export default function HrEventFilters({
  value,
  onChange,
  worksites,
  citizenships,
  onApply,
  onReset,
  loading,
}: HrEventFiltersProps) {
  const patch = (partial: Partial<HrFilterState>) =>
    onChange({ ...value, ...partial });

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={value.preset === p.id ? "default" : "outline"}
            onClick={() => patch({ preset: p.id })}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="hr-from">С</Label>
            <Input
              id="hr-from"
              type="date"
              className="w-[170px]"
              value={toDateInputValue(value.from)}
              onChange={(e) =>
                patch({
                  from: e.target.value
                    ? dateInputValueToDDMMYYYY(e.target.value)
                    : null,
                })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hr-to">По</Label>
            <Input
              id="hr-to"
              type="date"
              className="w-[170px]"
              value={toDateInputValue(value.to)}
              onChange={(e) =>
                patch({
                  to: e.target.value
                    ? dateInputValueToDDMMYYYY(e.target.value)
                    : null,
                })
              }
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label>Площадка</Label>
          <Select
            value={value.worksite ?? "__all__"}
            onValueChange={(v) =>
              patch({ worksite: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Все площадки" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все площадки</SelectItem>
              {worksites.map((ws) => (
                <SelectItem key={ws} value={ws}>
                  {ws}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Гражданство</Label>
          <Select
            value={value.citizenship ?? "__all__"}
            onValueChange={(v) =>
              patch({ citizenship: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Все" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Все</SelectItem>
              {citizenships.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <label className="mb-1 flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={value.excludeItrAup}
            onCheckedChange={(checked) =>
              patch({ excludeItrAup: checked === true })
            }
          />
          Исключить ИТР и АУП
        </label>

        <Button type="button" size="sm" disabled={loading} onClick={onApply}>
          {loading ? "Загрузка…" : "Применить"}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => {
            if (onReset) onReset();
            else {
              onChange({ ...DEFAULT_HR_FILTERS });
              onApply();
            }
          }}
        >
          Сбросить
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Фильтры применяются по кнопке «Применить» (чтобы не подвешивать сервер).
      </p>
    </div>
  );
}
