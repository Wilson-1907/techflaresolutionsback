interface Stat {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-gold/15 bg-deep-blue/30 p-5">
          <p className="text-sm text-muted">{stat.label}</p>
          <p className="text-2xl font-bold mt-2">{stat.value}</p>
          {stat.hint && <p className="text-xs text-muted mt-1">{stat.hint}</p>}
        </div>
      ))}
    </div>
  );
}
