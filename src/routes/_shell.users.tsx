import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Edit3, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, officeName, type UserInput } from "@/services/api";
import { useApp } from "@/store/app-store";
import { formatDateTime } from "@/lib/format";
import { PermissionGate } from "@/components/common/PermissionGate";
import { ALL_ROLES, ROLE_LABELS, ROLE_PRIVILEGES } from "@/lib/permissions";
import type { User, UserRole } from "@/types";
import { ListPagination, ListSearch, useListPagination } from "@/components/common/ListControls";

export const Route = createFileRoute("/_shell/users")({
  head: () => ({
    meta: [
      { title: "Users & roles - LGU DocTrack" },
      {
        name: "description",
        content: "Manage accounts, office assignment and role-based permissions.",
      },
      { property: "og:title", content: "Users & roles - LGU DocTrack" },
      {
        property: "og:description",
        content: "Manage accounts, office assignment and role-based permissions.",
      },
    ],
  }),
  component: UsersPage,
});

type UserForm = UserInput & { id?: string };

function emptyForm(defaultOfficeId: string): UserForm {
  return {
    name: "",
    username: "",
    password: "",
    role: "staff",
    officeId: defaultOfficeId,
    position: "",
    active: true,
  };
}

function editForm(user: User): UserForm {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    password: "",
    role: user.role,
    officeId: user.officeId,
    position: user.position,
    active: user.active,
  };
}

function sortedUsers(users: User[]) {
  return users.slice().sort((a, b) => a.name.localeCompare(b.name));
}

function generatedUsername(name: string, users: User[]) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || `user_${Date.now()}`;
  let username = base;
  let suffix = 2;

  while (users.some((user) => user.username.toLowerCase() === username)) {
    username = `${base}_${suffix}`;
    suffix += 1;
  }

  return username;
}

function UsersPage() {
  const { users, offices, session, refresh } = useApp();
  const [list, setList] = useState(users);
  const [form, setForm] = useState<UserForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const defaultOfficeId = offices[0]?.id ?? "";
  const isEditing = Boolean(form?.id);

  useEffect(() => setList(users), [users]);

  const activeAdminCount = useMemo(
    () => list.filter((u) => u.role === "admin" && u.active).length,
    [list],
  );
  const filteredUsers = useMemo(() => {
    const query = deferredQ.trim().toLowerCase();
    return query
      ? list.filter((user) =>
          `${user.name} ${user.username} ${user.position} ${officeName(user.officeId)} ${ROLE_LABELS[user.role]}`
            .toLowerCase()
            .includes(query),
        )
      : list;
  }, [deferredQ, list]);
  const pagination = useListPagination(filteredUsers, q);

  async function submitUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.officeId) {
      toast.error("Select an office for this user.");
      return;
    }
    if (!isEditing && !form.password?.trim()) {
      toast.error("Enter a password for the new user.");
      return;
    }
    setSaving(true);
    try {
      const payload: UserInput = {
        name: form.name.trim(),
        username: form.username.trim() || generatedUsername(form.name, list),
        password: form.password?.trim() || undefined,
        role: form.role,
        officeId: form.officeId,
        position: form.position.trim() || ROLE_LABELS[form.role],
        active: form.active,
      };
      const saved = form.id
        ? await api.updateUser(form.id, payload)
        : await api.createUser({ ...payload, password: payload.password ?? "" });
      setList((prev) =>
        sortedUsers(form.id ? prev.map((u) => (u.id === saved.id ? saved : u)) : [saved, ...prev]),
      );
      await refresh();
      setForm(null);
      toast.success(`${saved.name} ${form.id ? "updated" : "created"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User, active: boolean) {
    try {
      const updated = await api.updateUser(user.id, { active });
      setList((prev) => prev.map((x) => (x.id === user.id ? updated : x)));
      await refresh();
      toast.success(`${user.name} ${active ? "activated" : "deactivated"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update user.");
    }
  }

  async function deleteUser(user: User) {
    if (
      !window.confirm(
        `Delete ${user.name}? Accounts with document history should be deactivated instead.`,
      )
    ) {
      return;
    }
    try {
      await api.deleteUser(user.id);
      setList((prev) => prev.filter((u) => u.id !== user.id));
      await refresh();
      toast.success(`${user.name} deleted.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete user.");
    }
  }

  return (
    <PermissionGate roles={["admin"]}>
      <>
        <PageHeader
          title="Users & roles"
          description="Create and maintain real user accounts, office assignments and role privileges."
          actions={
            <Button onClick={() => setForm(emptyForm(defaultOfficeId))}>
              <Plus className="size-4" /> Add user
            </Button>
          }
        />

        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">User accounts</CardTitle>
              <CardDescription>Search by name, username, office or role.</CardDescription>
            </div>
            <ListSearch value={q} onChange={setQ} placeholder="Search users" ariaLabel="Search users" />
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Office</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last sign-in</TableHead>
                    <TableHead className="text-right">Active</TableHead>
                    <TableHead className="w-[112px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagination.pageItems.map((u) => {
                    const isLastActiveAdmin =
                      u.role === "admin" && u.active && activeAdminCount <= 1;
                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {u.avatarInitials}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{u.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                @{u.username}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{officeName(u.officeId)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ROLE_LABELS[u.role]}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateTime(u.lastLogin)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Switch
                            checked={u.active}
                            disabled={isLastActiveAdmin}
                            aria-label={`Toggle ${u.name}`}
                            onCheckedChange={(v) => void toggleActive(u, v)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${u.name}`}
                              onClick={() => setForm(editForm(u))}
                            >
                              <Edit3 className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${u.name}`}
                              disabled={u.id === session?.id || isLastActiveAdmin}
                              onClick={() => void deleteUser(u)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {filteredUsers.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No users found.</p>
            ) : null}
            <ListPagination
              page={pagination.page}
              pageCount={pagination.pageCount}
              pageSize={pagination.pageSize}
              totalItems={filteredUsers.length}
              itemLabel="users"
              onPageChange={pagination.setPage}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" aria-hidden /> Role privileges
            </CardTitle>
            <CardDescription>
              Menu visibility and server actions are scoped by role.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {ALL_ROLES.map((role) => (
              <div key={role} className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
                <p className="mt-1 text-sm text-muted-foreground">{ROLE_PRIVILEGES[role]}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={Boolean(form)} onOpenChange={(open) => !open && setForm(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Edit user" : "Add user"}</DialogTitle>
              <DialogDescription>
                Only administrators can create accounts and change role assignments.
              </DialogDescription>
            </DialogHeader>
            {form ? (
              <form onSubmit={submitUser} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      placeholder="juan_delacruz"
                      required
                    />
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={form.position}
                        onChange={(e) => setForm({ ...form, position: e.target.value })}
                        required
                      />
                    </div>
                  ) : null}
                  <div className="space-y-2">
                    <Label htmlFor="password">{isEditing ? "New password" : "Password"}</Label>
                    <Input
                      id="password"
                      type="password"
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={form.role}
                      onValueChange={(role: UserRole) => setForm({ ...form, role })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Office</Label>
                    <Select
                      value={form.officeId}
                      onValueChange={(officeId) => setForm({ ...form, officeId })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {offices.map((office) => (
                          <SelectItem key={office.id} value={office.id}>
                            {office.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-sm font-medium">Active account</span>
                  <Switch
                    checked={form.active}
                    onCheckedChange={(active) => setForm({ ...form, active })}
                  />
                </label>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setForm(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Save user"}
                  </Button>
                </DialogFooter>
              </form>
            ) : null}
          </DialogContent>
        </Dialog>
      </>
    </PermissionGate>
  );
}
