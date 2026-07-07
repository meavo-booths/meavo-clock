export default function KpiCard({ label, value, sub, accent = 'bg-meavo-blue' }) {
  return (
    <div className={`card ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-meavo-grey">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-meavo-ink">{value}</p>
      {sub && <p className="mt-1 text-sm text-meavo-grey">{sub}</p>}
    </div>
  );
}
