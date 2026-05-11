import { create } from 'zustand'
import { WsStatus } from '@lib/ws/NotificationSocket'

interface WsState {
  notifStatus:  WsStatus
  unreadCount:  number
  setNotifStatus: (s: WsStatus) => void
  setUnreadCount: (n: number) => void
  incrementUnread: () => void
}

export const useWsStore = create<WsState>((set) => ({
  notifStatus:  'disconnected',
  unreadCount:  0,
  setNotifStatus: (s) => set({ notifStatus: s }),
  setUnreadCount: (n) => set({ unreadCount: n }),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
}))
