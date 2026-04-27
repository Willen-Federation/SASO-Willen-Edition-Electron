import { registerProductHandlers } from './products'
import { registerInventoryHandlers } from './inventory'
import { registerSalesHandlers } from './sales'
import { registerSettingsHandlers } from './settings'
import { registerAIHandlers } from './ai'
import { registerLabelHandlers } from './labels'
import { registerDashboardHandlers } from './dashboard'

export function registerAllHandlers(): void {
  registerProductHandlers()
  registerInventoryHandlers()
  registerSalesHandlers()
  registerSettingsHandlers()
  registerAIHandlers()
  registerLabelHandlers()
  registerDashboardHandlers()
}
