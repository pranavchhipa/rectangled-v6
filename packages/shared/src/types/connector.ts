import type { AuthType, BindingLevel, ConnectorStatus } from '../constants/connectors'

export interface ConnectorType {
  id: string
  name: string
  description: string
  iconUrl: string | null
  authType: AuthType
  bindingLevel: BindingLevel
  configSchema: Record<string, unknown>
  isActive: boolean
}

export interface ConnectorInstance {
  id: string
  connectorTypeId: string
  workspaceId: string
  locationId: string | null
  config: Record<string, unknown>
  status: ConnectorStatus
  lastHealthCheck: Date | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}
