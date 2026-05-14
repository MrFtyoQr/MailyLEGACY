import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import { useWsStore } from '@store/ws.store'

export interface Notification {
  id:         string
  title:      string
  body:       string
  type:       string
  is_read:    boolean
  created_at: string
  data:       Record<string, unknown> | null
}

export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    staleTime: 60 * 1000,
    queryFn:  () => get<{ results: Notification[] }>(EP.notifications).then(r => r.results ?? []),
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  const setUnread = useWsStore((s) => s.setUnreadCount)
  return useMutation({
    mutationFn: (id: string) => post(EP.notificationRead(id), {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      // Reset WS badge count
      qc.fetchQuery({ queryKey: ['notifications', 'unread'] }).then((count) => {
        setUnread((count as number) ?? 0)
      }).catch(() => {})
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  const setUnread = useWsStore((s) => s.setUnreadCount)
  return useMutation({
    mutationFn: () => post(EP.notificationsReadAll, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setUnread(0)
    },
  })
}
