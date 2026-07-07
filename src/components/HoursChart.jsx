export default function HoursChart({ data }) {
  if (!data?.length) {
    return <p className="text-sm text-meavo-grey">No hours data for this month.</p>;
  }
  const max = Math.max(...data.map((d) => d.hours), 1);

  return (
    <div className="space-y-3">
      {data.map((row) => (
        <div key={row.worker_id}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-medium">{row.name}</span>
            <span className="text-meavo-grey">{row.hours.toFixed(1)}h</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-meavo-beige-300">
            <div
              className="h-full rounded-full bg-meavo-accent transition-all"
              style={{ width: `${(row.hours / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
