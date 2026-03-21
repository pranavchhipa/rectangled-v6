export const INDUSTRIES = {
  RETAIL: 'retail',
  FNB: 'f&b',
  D2C: 'd2c',
  SMB: 'smb',
  HEALTHCARE: 'healthcare',
  AUTOMOTIVE: 'automotive',
  HOSPITALITY: 'hospitality',
  SALON_SPA: 'salon_spa',
  EDUCATION: 'education',
  PROFESSIONAL_SERVICES: 'professional_services',
  OTHER: 'other',
} as const

export type Industry = (typeof INDUSTRIES)[keyof typeof INDUSTRIES]

export const INDUSTRY_LABELS: Record<Industry, string> = {
  retail: 'Retail',
  'f&b': 'Food & Beverage',
  d2c: 'Direct to Consumer',
  smb: 'Small & Medium Business',
  healthcare: 'Healthcare',
  automotive: 'Automotive',
  hospitality: 'Hospitality',
  salon_spa: 'Salon & Spa',
  education: 'Education',
  professional_services: 'Professional Services',
  other: 'Other',
}
