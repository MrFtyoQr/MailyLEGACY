'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const TIER_COLORS: Record<string, string> = {
  FREE:     '#94A3B8',
  SILVER:   '#5E9FE0',
  GOLD:     '#F5A623',
  PLATINUM: '#9B59B6',
}

const TIER_ICONS: Record<string, string> = {
  FREE:     '🆓',
  SILVER:   '🥈',
  GOLD:     '🥇',
  PLATINUM: '💎',
}

interface Props {
  byTier: Record<string, number>
}

export function TierChart({ byTier }: Props) {
  const order = ['FREE', 'SILVER', 'GOLD', 'PLATINUM']
  const data = order
    .filter((t) => byTier[t] !== undefined)
    .map((tier) => ({
      name:  `${TIER_ICONS[tier]} ${tier}`,
      value: byTier[tier] ?? 0,
      color: TIER_COLORS[tier] ?? '#94A3B8',
    }))

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        💳 Suscripciones por plan
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} barSize={36}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#64748B' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            axisLine={false}
            tickLine={false}
            width={30}
          />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            contentStyle={{
              borderRadius: 8,
              fontSize:     13,
              border:       '1px solid #E2E8F0',
            }}
            formatter={(value) => [value, 'suscripciones']}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
