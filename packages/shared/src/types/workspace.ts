import type { Industry } from '../constants/industries'

export interface Workspace {
  id: string
  name: string
  slug: string
  industry: Industry
  logoUrl: string | null
  brandColors: BrandColors | null
  tonePreset: TonePreset
  settings: WorkspaceSettings
  createdAt: Date
  updatedAt: Date
}

export interface BrandColors {
  primary: string
  secondary: string
  accent: string
}

export type TonePreset = 'professional' | 'friendly' | 'empathetic' | 'witty'

export interface WorkspaceSettings {
  defaultTimezone: string
  aiAutoRespond: boolean
  reviewResponseDelay: { min: number; max: number } // days
  frequencyCap: { maxSurveys: number; windowDays: number }
}

export interface Location {
  id: string
  workspaceId: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  phone: string | null
  email: string | null
  timezone: string
  isActive: boolean
  settings: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}
