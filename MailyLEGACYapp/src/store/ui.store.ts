import { create } from 'zustand'

interface UIState {
  // Doctor/Specialist: paciente activo en vista detalle
  activePatientId: string | null
  setActivePatientId: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activePatientId:    null,
  setActivePatientId: (id) => set({ activePatientId: id }),
}))
