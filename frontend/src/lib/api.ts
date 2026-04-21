const BASE = '/api/v1';

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export interface MetabaseColumn {
  name: string;
  display_name: string;
  base_type: string;
  semantic_type: string | null;
}

export interface QuestionMeta {
  question_id: number;
  name: string;
  description: string | null;
  columns: MetabaseColumn[];
}

export const api = {
  metabase: {
    metadata: (questionId: number) => request<QuestionMeta>(`/metabase/questions/${questionId}/metadata`),
    preview: (questionId: number, parameters?: Record<string, unknown>) =>
      request<{ rows: Record<string, unknown>[]; count: number }>(`/metabase/questions/${questionId}/preview`, {
        method: 'POST',
        body: JSON.stringify(parameters ?? {}),
      }),
  },
};
