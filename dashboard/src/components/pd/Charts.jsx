/* ═══════════════════════════════════════════════════════════════
   CHARTS — All 6 Recharts visualizations for the productivity dashboard
   ═══════════════════════════════════════════════════════════════ */

import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';

/* ── Custom Tooltip ── */
function PdTooltip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pd-tooltip">
      <div className="pd-tooltip-label">{label}</div>
      <div className="pd-tooltip-value">{payload[0].value}{suffix}</div>
    </div>
  );
}

/* ── Shared date formatter ── */
function shortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ═══════════════════════════════════
   1. Task Completion Area Chart (30d)
   ═══════════════════════════════════ */
export function TaskCompletionChart({ data }) {
  if (!data || data.length === 0) return <div className="pd-empty">No completion data yet</div>;

  const formatted = data.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="completionGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#5b9aef" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#5b9aef" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-2)' }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<PdTooltip suffix=" tasks" />} />
        <Area type="monotone" dataKey="count" stroke="#5b9aef" strokeWidth={2} fill="url(#completionGrad)" dot={false} activeDot={{ r: 4, fill: '#5b9aef' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════
   2. Focus Time Bar Chart (30d)
   ═══════════════════════════════════ */
export function FocusTimeChart({ data }) {
  if (!data || data.length === 0) return <div className="pd-empty">No focus sessions yet</div>;

  const formatted = data.map((d) => ({ ...d, label: shortDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={formatted} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-2)' }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<PdTooltip suffix=" min" />} />
        <Bar dataKey="minutes" fill="#a855f7" radius={[4, 4, 0, 0]} maxBarSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════
   3. Task Status Donut
   ═══════════════════════════════════ */
export function TaskStatusDonut({ data }) {
  if (!data || data.every((d) => d.value === 0)) return <div className="pd-empty">No tasks yet</div>;

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const donePercent = total > 0 ? Math.round((data[0].value / total) * 100) : 0;

  return (
    <div className="pd-donut-wrap">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip content={<PdTooltip suffix=" tasks" />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pd-donut-center">
        <span className="pd-donut-center-value">{donePercent}%</span>
        <span className="pd-donut-center-label">Done</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   4. Priority Breakdown Bar Chart
   ═══════════════════════════════════ */
export function PriorityBarChart({ data }) {
  if (!data || data.every((d) => d.count === 0)) return <div className="pd-empty">No tasks yet</div>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-2)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<PdTooltip suffix=" tasks" />} />
        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════
   5. Project Activity (Horizontal Bar)
   ═══════════════════════════════════ */
export function ProjectActivityChart({ data }) {
  if (!data || data.length === 0) return <div className="pd-empty">No project data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.3} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-2)' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fill: 'var(--text-2)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<PdTooltip suffix=" done" />} />
        <Bar dataKey="done" radius={[0, 6, 6, 0]} maxBarSize={24}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color || '#5b9aef'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════
   6. Weekly Pattern Bar Chart
   ═══════════════════════════════════ */
export function WeeklyPatternChart({ data }) {
  if (!data || data.every((d) => d.count === 0)) return <div className="pd-empty">No pattern data yet</div>;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--text-2)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} allowDecimals={false} tickLine={false} axisLine={false} />
        <Tooltip content={<PdTooltip suffix=" completions" />} />
        <Bar dataKey="count" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
