import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const BASE = '/api/v1';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : {},
    ...init,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────

export interface Location {
  id: string;
  name: string;
  station_code: string | null;
  is_active: boolean;
  is_report_enabled: boolean;
  location_share_rate: number | null;
  transaction_fee_rate: number | null;
  electricity_cost: number | null;
  internet_cost: number | null;
  etax: number | null;
  email_recipients: string[] | null;
  group_name: string | null;
}

export interface Snapshot {
  id: string;
  year_month: string;
  question_id: number;
  total_rows: number;
  file_path: string | null;
  status: string;
  error_message: string | null;
  fetched_at: string | null;
  created_at: string;
}

export interface Entry {
  id: string;
  snapshot_id: string;
  location_id: string;
  location_name: string;
  year_month: string;
  status: string;
  electricity_cost: number | null;
  internet_cost: number | null;
  etax: number | null;
  bill_image_url: string | null;
  preview_rows: number | null;
  preview_revenue: number | null;
  preview_kwh: number | null;
  preview_gp: number | null;
  preview_share: number | null;
  file_name: string | null;
  email_sent_at: string | null;
  email_error: string | null;
}

export interface GroupInfo {
  group_name: string;
  location_count: number;
}

export interface GroupReportHistory {
  id: string;
  group_name: string;
  status: string;
  file_name: string | null;
  preview_share: number | null;
  email_error: string | null;
}

export interface PrivilegeConfig {
  id: string;
  privilege_program_name: string | null;
  discount_label: string | null;
  privilege_type: string;
  share_rate: number | null;
  notes: string | null;
  is_active: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  location_ids: string[];
  trigger_day: number;
  is_active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_detail: Record<string, unknown> | null;
  created_at: string;
}

// ─── Query keys ──────────────────────────────────────────────────────────

export const qk = {
  locations: ['locations'] as const,
  snapshots: ['monthly', 'snapshots'] as const,
  workflow: (snapshotId: string) => ['workflow', snapshotId] as const,
  groups: ['group-reports', 'groups'] as const,
  groupHistory: (snapshotId: string) => ['group-reports', snapshotId, 'history'] as const,
  groupLocations: (snapshotId: string, group: string) =>
    ['group-reports', 'groups', group, 'locations', snapshotId] as const,
  groupPreview: (snapshotId: string, group: string) =>
    ['group-reports', snapshotId, 'preview', group] as const,
  privileges: (type?: string) => ['privileges', type ?? 'all'] as const,
  schedules: ['schedules'] as const,
};

// ─── Locations ───────────────────────────────────────────────────────────

export function useLocations() {
  return useQuery({
    queryKey: qk.locations,
    queryFn: () => api<{ items: Location[]; total: number }>('/locations'),
    select: (d) => d.items,
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Location> }) =>
      api(`/locations/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.locations }),
  });
}

// ─── Snapshots + workflow ────────────────────────────────────────────────

export function useSnapshots() {
  return useQuery({
    queryKey: qk.snapshots,
    queryFn: () => api<{ items: Snapshot[] }>('/monthly/snapshots'),
    select: (d) => d.items,
  });
}

export function useFetchSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { year_month: string; question_id?: number }) =>
      api('/monthly/snapshots/fetch', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.snapshots }),
  });
}

export function useWorkflowEntries(snapshotId: string | null, options?: { refetchMs?: number }) {
  return useQuery({
    queryKey: snapshotId ? qk.workflow(snapshotId) : ['workflow', 'none'],
    queryFn: () => api<{ items: Entry[]; total: number; stats: Record<string, number> }>(
      `/workflow/${snapshotId}`
    ),
    enabled: Boolean(snapshotId),
    refetchInterval: options?.refetchMs,
  });
}

export function useInitWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      api(`/workflow/init/${snapshotId}`, { method: 'POST' }),
    onSuccess: (_, snapshotId) =>
      qc.invalidateQueries({ queryKey: qk.workflow(snapshotId) }),
  });
}

export function useResetSnapshot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: string) =>
      api(`/workflow/reset/${snapshotId}`, { method: 'DELETE' }),
    onSuccess: (_, snapshotId) =>
      qc.invalidateQueries({ queryKey: qk.workflow(snapshotId) }),
  });
}

export interface SendPayload {
  electricity_cost: number;
  internet_cost: number;
  etax: number;
  email_recipients?: string[];
  skip_email?: boolean;
}

export function useSendEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ snapshotId, entryId, payload }: {
      snapshotId: string; entryId: string; payload: SendPayload;
    }) =>
      api(`/workflow/${snapshotId}/send/${entryId}`, {
        method: 'POST', body: JSON.stringify(payload),
      }),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: qk.workflow(v.snapshotId) }),
  });
}

// ─── Group reports ───────────────────────────────────────────────────────

export function useGroups() {
  return useQuery({
    queryKey: qk.groups,
    queryFn: () => api<{ items: GroupInfo[] }>('/group-reports/groups'),
    select: (d) => d.items,
  });
}

export function useGroupHistory(snapshotId: string | null) {
  return useQuery({
    queryKey: snapshotId ? qk.groupHistory(snapshotId) : ['group-reports', 'none', 'history'],
    queryFn: () => api<{ items: GroupReportHistory[] }>(
      `/group-reports/${snapshotId}/history`
    ),
    enabled: Boolean(snapshotId),
    select: (d) => {
      const map: Record<string, GroupReportHistory> = {};
      for (const g of d.items) map[g.group_name] = g;
      return map;
    },
  });
}

export function useGroupLocations(snapshotId: string, groupName: string) {
  return useQuery({
    queryKey: qk.groupLocations(snapshotId, groupName),
    queryFn: () => api<{ items: Array<Location & { preview_rows?: number | null }> }>(
      `/group-reports/groups/${encodeURIComponent(groupName)}/locations?snapshot_id=${snapshotId}`
    ),
    select: (d) => d.items,
  });
}

export function useGroupPreview(snapshotId: string, groupName: string) {
  return useQuery({
    queryKey: qk.groupPreview(snapshotId, groupName),
    queryFn: () => api<{
      group_name: string; location_count: number; rows: number; kwh: number; revenue: number;
    }>(`/group-reports/${snapshotId}/preview/${encodeURIComponent(groupName)}`),
  });
}

export function useSendGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ snapshotId, body }: { snapshotId: string; body: unknown }) =>
      api(`/group-reports/${snapshotId}/send`, {
        method: 'POST', body: JSON.stringify(body),
      }),
    onSuccess: (_, v) =>
      qc.invalidateQueries({ queryKey: qk.groupHistory(v.snapshotId) }),
  });
}

// ─── Privileges ──────────────────────────────────────────────────────────

export function usePrivileges(type?: string) {
  return useQuery({
    queryKey: qk.privileges(type),
    queryFn: () => api<{ items: PrivilegeConfig[] }>(
      type ? `/privileges?privilege_type=${type}` : '/privileges'
    ),
    select: (d) => d.items,
  });
}

export function useSavePrivilege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<PrivilegeConfig> }) =>
      api(`/privileges/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['privileges'] }),
  });
}

export function useCreatePrivilege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PrivilegeConfig>) =>
      api('/privileges', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['privileges'] }),
  });
}

export function useDeletePrivilege() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/privileges/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['privileges'] }),
  });
}

// ─── Schedules ───────────────────────────────────────────────────────────

export function useSchedules() {
  return useQuery({
    queryKey: qk.schedules,
    queryFn: () => api<{ items: Schedule[] }>('/schedules'),
    select: (d) => d.items,
  });
}
