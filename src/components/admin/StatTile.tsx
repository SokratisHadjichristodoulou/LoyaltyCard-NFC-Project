export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-crema/70 px-4 py-3.5">
      <p className="text-xs font-semibold tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl leading-none font-medium tabular">{value}</p>
      {note && <p className="mt-1.5 text-xs text-muted">{note}</p>}
    </div>
  );
}
