export const CONNECTOR_IDS = {
  GBP: 'gbp',
  ZOMATO: 'zomato',
  WAPISNAP: 'wapisnap',
  EMAIL: 'email',
  // Roadmap
  SWIGGY: 'swiggy',
  JUSTDIAL: 'justdial',
  MAGICPIN: 'magicpin',
  FACEBOOK: 'facebook',
  INSTAGRAM: 'instagram',
  SHOPIFY: 'shopify',
  WOOCOMMERCE: 'woocommerce',
  RAZORPAY: 'razorpay',
} as const

export type ConnectorId = (typeof CONNECTOR_IDS)[keyof typeof CONNECTOR_IDS]

export const AUTH_TYPES = {
  OAUTH2: 'oauth2',
  API_KEY: 'api_key',
  SCRAPE: 'scrape',
  PROFILE_URL: 'profile_url',
} as const

export type AuthType = (typeof AUTH_TYPES)[keyof typeof AUTH_TYPES]

export const BINDING_LEVELS = {
  WORKSPACE: 'workspace',
  LOCATION: 'location',
} as const

export type BindingLevel = (typeof BINDING_LEVELS)[keyof typeof BINDING_LEVELS]

export const CONNECTOR_STATUSES = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  ERROR: 'error',
  PENDING: 'pending',
} as const

export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[keyof typeof CONNECTOR_STATUSES]
