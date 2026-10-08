import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BodyGoal, BodyRecord } from '../types';
import { fromDateString } from '../utils/date';
import styles from './BodyTrendChart.module.css';

// index.css の色と同じ値（グラフの部品には直接色を渡す）
const COLORS = {
  line: '#1f6b4f',
  muted: '#6b6b6b',
  grid: '#e5e5e5',
  axis: '#dddddd',
  surface: '#ffffff',
};

const METRICS = [
  { key: 'bodyFat', label: '体脂肪率', unit: '%' },
  { key: 'weight', label: '体重', unit: 'kg' },
] as const;

type MetricKey = (typeof METRICS)[number]['key'];

type Props = {
  records: BodyRecord[];
  goal: BodyGoal | null;
};

// 小数第1位までの見やすい数字にする
const round1 = (n: number) => Math.round(n * 10) / 10;

export function BodyTrendChart({ records, goal }: Props) {
  const [metricKey, setMetricKey] = useState<MetricKey>('bodyFat');
  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];
  const target = goal?.[metricKey] ?? null;

  // 直近30件をグラフ用のデータに変換
  const data = records.slice(-30).map((record) => {
    const d = fromDateString(record.date);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: record[metricKey] };
  });

  return (
    <section className={styles.card} aria-labelledby="trend-title">
      <div className={styles.head}>
        <h2 id="trend-title" className={styles.title}>
          推移
        </h2>
        <div className={styles.toggle} role="group" aria-label="表示する項目">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={metricKey === m.key}
              className={metricKey === m.key ? `${styles.toggleButton} ${styles.active}` : styles.toggleButton}
              onClick={() => setMetricKey(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <p className={styles.empty}>記録が2件以上になるとグラフが表示されます</p>
      ) : (
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: COLORS.muted }}
                tickLine={false}
                axisLine={{ stroke: COLORS.axis }}
                minTickGap={16}
              />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fontSize: 11, fill: COLORS.muted }}
                tickFormatter={(v: number) => String(round1(v))}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip
                formatter={(value) => [`${value}${metric.unit}`, metric.label]}
                contentStyle={{ borderRadius: 8, borderColor: COLORS.axis, fontSize: 12 }}
              />
              {target !== null && (
                <ReferenceLine
                  y={target}
                  stroke={COLORS.muted}
                  strokeDasharray="4 4"
                  ifOverflow="extendDomain"
                  label={{
                    value: `目標 ${target}${metric.unit}`,
                    position: 'insideTopRight',
                    fontSize: 11,
                    fill: COLORS.muted,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                name={metric.label}
                stroke={COLORS.line}
                strokeWidth={2}
                dot={{ r: 4, strokeWidth: 2, stroke: COLORS.surface, fill: COLORS.line }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: COLORS.surface }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
