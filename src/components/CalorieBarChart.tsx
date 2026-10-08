import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Goals, Nutrients } from '../types';
import { fromDateString } from '../utils/date';
import styles from './CalorieBarChart.module.css';

const COLORS = {
  bar: '#333333',
  band: '#e6e6e6',
  muted: '#6b6b6b',
  grid: '#e5e5e5',
  axis: '#dddddd',
};

type Props = {
  days: { date: string; totals: Nutrients | null }[];
  goals: Goals;
};

export function CalorieBarChart({ days, goals }: Props) {
  // 記録がない日は null（棒を出さない）
  const data = days.map((day) => {
    const d = fromDateString(day.date);
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      kcal: day.totals ? Math.round(day.totals.kcal) : null,
    };
  });

  return (
    <section className={styles.card} aria-labelledby="calorie-chart-title">
      <h2 id="calorie-chart-title" className={styles.title}>
        日別カロリー
      </h2>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={COLORS.grid} vertical={false} />
          {/* 目標範囲の帯（範囲外でも見えるよう縦軸を広げる） */}
          <ReferenceArea
            y1={goals.kcal.min}
            y2={goals.kcal.max}
            fill={COLORS.band}
            fillOpacity={0.8}
            ifOverflow="extendDomain"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: COLORS.muted }}
            tickLine={false}
            axisLine={{ stroke: COLORS.axis }}
            minTickGap={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: COLORS.muted }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toLocaleString()} kcal`, 'カロリー']}
            cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
            contentStyle={{ borderRadius: 8, borderColor: COLORS.axis, fontSize: 12 }}
          />
          <Bar
            dataKey="kcal"
            fill={COLORS.bar}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <p className={styles.legend}>
        <span className={styles.swatch} aria-hidden="true" />
        目標範囲（{goals.kcal.min.toLocaleString()}〜{goals.kcal.max.toLocaleString()} kcal）
      </p>
    </section>
  );
}
