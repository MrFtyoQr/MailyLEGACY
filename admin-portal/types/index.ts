// ── Dashboard KPIs ────────────────────────────────────────────────────────────

export interface DashboardData {
  users: {
    total:     number
    by_role:   Record<string, number>
    new_today: number
  }
  specialists: {
    total:    number
    pending:  number
    verified: number
    rejected: number
  }
  subscriptions: {
    active:   number
    by_tier:  Record<string, number>
  }
  referrals: {
    today:   number
    pending: number
  }
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditEntry {
  id:             string
  created_at:     string
  actor_email:    string
  actor_role:     string
  action:         string
  resource_type:  string
  resource_id:    string
  patient:        string | null
  ip_address:     string
  user_agent:     string
  endpoint:       string
  http_status:    number
  changed_fields: Record<string, unknown> | null
  note:           string
}

export interface AuditResponse {
  count:    number
  next:     string | null
  previous: string | null
  results:  AuditEntry[]
}

export interface AuditFilters {
  action?:        string
  resource_type?: string
  actor_email?:   string
  date_from?:     string
  date_to?:       string
  page?:          number
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id:         string
  email:      string
  role:       string
  is_active:  boolean
  created_at: string
}
