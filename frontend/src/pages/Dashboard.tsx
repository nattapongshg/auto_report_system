export function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-sm text-[#636E72] mt-1">Coming soon.</p>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; dot: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
    generating: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    sent: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    fetching: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  };
  const s = map[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
  return (
    <span className={`status-pill ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
