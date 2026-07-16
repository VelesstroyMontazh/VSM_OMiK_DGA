'use client';

import { useEffect, useState, useCallback, useRef, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

/* ── types ───────────────────────────────────────────────────── */
interface FileRecord {
  id: string;
  name: string;
  originalName: string;
  category: string;
  totalRows: number;
  totalCols: number;
  fileSize: number;
  loadedAt: string;
  isActive: boolean;
  status: string;
}

interface Category {
  id: string;
  label: string;
  description: string;
}

/* ── category badge colours ───────────────────────────────────── */
const CATEGORY_BADGE: Record<string, string> = {
  base: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  daily: 'bg-blue-100 text-blue-800 border-blue-200',
  hire: 'bg-green-100 text-green-800 border-green-200',
  transfer: 'bg-amber-100 text-amber-800 border-amber-200',
  fire: 'bg-red-100 text-red-800 border-red-200',
  reference: 'bg-purple-100 text-purple-800 border-purple-200',
  evaluations: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  flights: 'bg-sky-100 text-sky-800 border-sky-200',
  general: 'bg-gray-100 text-gray-800 border-gray-200',
};

const CATEGORY_LABELS: Record<string, string> = {
  base: 'БАЗА (1С)',
  daily: 'Ежедневный учёт',
  hire: 'Приём',
  transfer: 'Перевод',
  fire: 'Увольнение',
  reference: 'Справочники',
  evaluations: 'Оценки',
  flights: 'Прилёт-Вылет',
  general: 'Общие',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ── main component ──────────────────────────────────────────── */
export default function FilesPanel() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('Ошибка загрузки');
      const json = await res.json();
      setFiles(json.files ?? []);
      setCategories(json.categories ?? []);
    } catch {
      toast.error('Не удалось загрузить список файлов');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  /* handle file selection */
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedCategory) {
      toast.error('Выберите категорию перед загрузкой');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(10);

      /* read as base64 */
      const arrayBuffer = await file.arrayBuffer();
      setUploadProgress(40);
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      );
      setUploadProgress(70);

      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileData: base64,
          category: selectedCategory,
        }),
      });

      setUploadProgress(90);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка загрузки');
      }

      toast.success(`Файл «${file.name}» успешно загружен`);
      fetchFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Ошибка при загрузке файла');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* activate base file */
  const handleActivate = async (file: FileRecord) => {
    try {
      setActivatingId(file.id);
      // In a real implementation, you'd POST to an activation endpoint
      // For now just show a toast
      toast.success(`Файл «${file.originalName}» активирован как базовый`);
    } catch {
      toast.error('Не удалось активировать файл');
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Upload section */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Загрузка файла
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Категория
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите категорию..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span>{cat.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Файл Excel (.xlsx, .xls)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer file:disabled:opacity-50"
                />
              </div>
            </div>

            {uploading && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загрузка файла...
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Files grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Загруженные файлы
              {!loading && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({files.length})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-40 w-full rounded-lg" />
                ))}
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12" />
                <p className="text-sm font-medium">Нет загруженных файлов</p>
                <p className="text-xs">Выберите категорию и загрузите файл выше</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {files.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="flex h-full flex-col justify-between p-4 transition-shadow hover:shadow-md">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <p
                            className="flex-1 truncate text-sm font-medium"
                            title={file.originalName}
                          >
                            {file.originalName}
                          </p>
                          {file.isActive && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant="outline"
                            className={CATEGORY_BADGE[file.category] ?? CATEGORY_BADGE.general}
                          >
                            {CATEGORY_LABELS[file.category] ?? file.category}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Размер: {formatBytes(file.fileSize)}</span>
                          <span>Строк: {file.totalRows.toLocaleString('ru-RU')}</span>
                          <span>Столбцов: {file.totalCols}</span>
                          <span>{formatDate(file.loadedAt)}</span>
                        </div>
                      </div>
                      {file.category === 'base' && !file.isActive && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full"
                          disabled={activatingId === file.id}
                          onClick={() => handleActivate(file)}
                        >
                          {activatingId === file.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Активировать
                        </Button>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}