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

// index.css の色と同じ値（グラフの部品には直接色を渡す）
const COLORS = {
  protein: '#2a78d6',
  fat: '#eb6834',
  carbs: '#1baf7a',
  band: '#e2efe8',
  muted: '#5c6b64',
  grid: '#e6ece9',
  axis: '#dbe3df',
  surface: '#ffffff',
};

// グラフ1本分のデータ。記録がない日は null（棒を出さない）
type Datum = {
  label: string;
  kcal: number | null; // 登録されたカロリーの合計
  pKcal: number | null; // P・F・C それぞれから来たカロリー（積み上げ用）
  fKcal: number | null;
  cKcal: number | null;
  totals: Nutrients | null;
};

type Props = {
  days: { date: string; totals: Nutrients | null }[];
  goals: Goals;
};

// マウスを乗せたときに出る吹き出し
function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Datum }[] }) {
  const datum = payload?.[0]?.payload;
  if (!active || !datum || !datum.totals) return null;
  const { totals } = datum;

  const rows = [
    { label: 'P', grams: totals.protein, kcal: datum.pKcal, color: COLORS.protein },
    { label: 'F', grams: totals.fat, kcal: datum.fKcal, color: COLORS.fat },
    { label: 'C', grams: totals.carbs, kcal: datum.cKcal, color: COLORS.carbs },
  ];

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipHead}>
        {datum.label}{'\u3000'}{datum.kcal?.toLocaleString()} kcal
      </div>
      {rows.map((row) => (
        <div key={row.label} className={styles.tooltipRow}>
          <span className={styles.swatch} style={{ background: row.color }} aria-hidden="true" />
          {row.label} {row.grams}g（{row.kcal}kcal）
        </div>
      ))}
    </div>
  );
}

export function CalorieBarChart({ days, goals }: Props) {
  const data: Datum[] = days.map((day) => {
    const d = fromDateString(day.date);
    const t = day.totals;
    return {
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      kcal: t ? Math.round(t.kcal) : null,
      // P・C は1gあたり4kcal、F は9kcal
      pKcal: t ? Math.round(t.protein * 4) : null,
      fKcal: t ? Math.round(t.fat * 9) : null,
      cKcal: t ? Math.round(t.carbs * 4) : null,
      totals: t,
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
          <ReferenceArea
            y1={goals.kcal.min}
            y2={goals.kcal.max}
            fill={COLORS.band}
            fillOpacity={0.9}
            ifOverflow="extendDomain"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: COLORS.muted }}
            tickLine={false}
            axisLine={{ stroke: COLORS.axis }}
            minTickGap={8}
          />
          <YAxis tick={{ fontSize: 11, fill: COLORS.muted }} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }} />
          {/* 下から P → F → C の順に積み上げる。境目は白い線で区切る */}
          <Bar dataKey="pKcal" stackId="kcal" fill={COLORS.protein} stroke={COLORS.surface} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
          <Bar dataKey="fKcal" stackId="kcal" fill={COLORS.fat} stroke={COLORS.surface} strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
          <Bar
            dataKey="cKcal"
            stackId="kcal"
            fill={COLORS.carbs}
            stroke={COLORS.surface}
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>

      <ul className={styles.legend}>
        <li>
          <span className={styles.swatch} style={{ background: COLORS.protein }} aria-hidden="true" />P
        </li>
        <li>
          <span className={styles.swatch} style={{ background: COLORS.fat }} aria-hidden="true" />F
        </li>
        <li>
          <span className={styles.swatch} style={{ background: COLORS.carbs }} aria-hidden="true" />C
        </li>
        <li>
          <span className={styles.band} aria-hidden="true" />
          目標範囲（{goals.kcal.min.toLocaleString()}〜{goals.kcal.max.toLocaleString()} kcal）
        </li>
      </ul>
    </section>
  );
}
