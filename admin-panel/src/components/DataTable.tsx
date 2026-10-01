interface Column {
  key: string;
  label: string;
}

interface DataTableProps {
  columns: Column[];
  rows: Record<string, string>[];
  emptyMessage?: string;
}

export function DataTable({ columns, rows, emptyMessage = "No records yet." }: DataTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gold/15 bg-deep-blue/30 p-8 text-center text-muted text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/15 bg-deep-blue/30 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold/10 text-left text-muted">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 font-medium whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gold/5 last:border-0 hover:bg-white/5">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 align-top max-w-xs truncate">
                    {row[col.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
