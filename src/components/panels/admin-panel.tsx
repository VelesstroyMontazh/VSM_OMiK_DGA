"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Database,
  Loader2,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface AdminStatus {
  isAdmin: boolean;
  warehouse: { path: string; exists: boolean; tables: Record<string, number> };
  etl: {
    logDir: string;
    lastLogSnippet: string | null;
    batchScript: string;
    scheduledTask: string;
  };
  users?: { total: number };
  error?: string;
}

export default function AdminPanel() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    displayName: "",
    role: "user",
  });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch("/api/admin/status", { cache: "no-store" });
      const statusJson = (await statusRes.json()) as AdminStatus;
      if (!statusRes.ok) throw new Error(statusJson.error ?? `HTTP ${statusRes.status}`);
      setStatus(statusJson);

      if (statusJson.isAdmin) {
        const usersRes = await fetch("/api/admin/users", { cache: "no-store" });
        const usersJson = (await usersRes.json()) as { users?: AdminUser[]; error?: string };
        if (usersRes.status === 403) {
          setForbidden(true);
          return;
        }
        if (!usersRes.ok) throw new Error(usersJson.error);
        setUsers(usersJson.users ?? []);
      } else {
        setForbidden(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createUser = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error);
      setNewUser({ username: "", password: "", displayName: "", role: "user" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (user: AdminUser) => {
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Загрузка админки…
      </div>
    );
  }

  if (forbidden) {
    return (
      <Card className="m-4 md:m-6 border-amber-500/40">
        <CardContent className="flex items-start gap-3 p-6">
          <Shield className="mt-0.5 h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium">Требуется вход администратора</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Войдите под учётной записью с ролью <code>admin</code> на странице /login
            </p>
            {status && (
              <div className="mt-4 text-xs text-muted-foreground">
                <p>Warehouse: {status.warehouse.exists ? "OK" : "нет файла"}</p>
                <p className="truncate">{status.warehouse.path}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-900/30">
          <Shield className="h-6 w-6 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Админка</h2>
          <p className="text-sm text-muted-foreground">Warehouse, ETL и пользователи</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4" />
              Data Warehouse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="break-all text-xs text-muted-foreground">{status?.warehouse.path}</p>
            <div className="max-h-48 overflow-y-auto rounded border">
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(status?.warehouse.tables ?? {}).map(([t, c]) => (
                    <tr key={t} className="border-b border-border/50">
                      <td className="px-2 py-1.5 font-mono">{t}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {c.toLocaleString("ru-RU")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ETL / Планировщик</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Задача: </span>
              {status?.etl.scheduledTask}
            </p>
            <p className="break-all text-xs text-muted-foreground">{status?.etl.batchScript}</p>
            <p className="text-xs text-muted-foreground">Логи: {status?.etl.logDir}</p>
            {status?.etl.lastLogSnippet && (
              <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed">
                {status.etl.lastLogSnippet}
              </pre>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Пользователи ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="px-3 py-2">Логин</th>
                  <th className="px-3 py-2">Имя</th>
                  <th className="px-3 py-2">Роль</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border/50">
                    <td className="px-3 py-2 font-mono text-xs">{u.username}</td>
                    <td className="px-3 py-2">{u.displayName}</td>
                    <td className="px-3 py-2">
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? "Активен" : "Отключён"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(u)}
                      >
                        {u.isActive ? "Отключить" : "Включить"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-muted/20 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium">
              <UserPlus className="h-4 w-4" />
              Новый пользователь
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label>Логин</Label>
                <Input
                  value={newUser.username}
                  onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Пароль</Label>
                <Input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Отображаемое имя</Label>
                <Input
                  value={newUser.displayName}
                  onChange={(e) => setNewUser((s) => ({ ...s, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Роль</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(v) => setNewUser((s) => ({ ...s, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">user</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              className="mt-3"
              disabled={creating || !newUser.username || !newUser.password}
              onClick={() => void createUser()}
            >
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Создать
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
