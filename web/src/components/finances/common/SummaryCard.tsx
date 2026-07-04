interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  color?: 'blue' | 'green' | 'red' | 'purple' | 'amber';
}

const valueColor: Record<NonNullable<SummaryCardProps['color']>, string> = {
  blue: 'text-gray-50',
  green: 'text-emerald-400',
  red: 'text-red-400',
  purple: 'text-gray-50',
  amber: 'text-gray-50',
};

export default function SummaryCard({ title, value, subtitle, color = 'blue' }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-gray-900/60 px-5 py-4 transition-colors hover:border-white/10">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-gray-500">{title}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-tight tabular-nums ${valueColor[color]}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}
