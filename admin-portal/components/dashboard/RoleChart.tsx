'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const ROLE_COLORS: Record<string, string> = {
  PATIENT:    '#F97316',
  DOCTOR:     '#2196F3',
  SPECIALIST: '#00BFA5',
  PARTNER:    '#8B5CF6',
  ADMIN:      '#00C5E3',
}

const ROLE_LABELS: Record<string, string> = {
  PATIENT:    'Pacientes',
  DOCTOR:     'Doctores',
  SPECIALIST: 'Especialistas',
  PARTNER:    'Partners',
  ADMIN:      'Admins',
}

interface Props {
  byRole: Record<string, number>
}

export function RoleChart({ byRole }: Props) {
  const data = Object.entries(byRole)
    .filter(([, v]) => v > 0)
    .map(([role, count]) => ({
      name:  ROLE_LABELS[role] ?? role,
      value: count,
      color: ROLE_COLORS[role] ?? '#94A3B8',
    }))

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">
        👥 Usuarios por rol
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            innerRadius={40}
            paddingAngle={3}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [value, name]}
            contentStyle={{
              borderRadius: 8,
              fontSize:     13,
              border:       '1px solid #E2E8F0',
            }}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 12, color: '#64748B' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
