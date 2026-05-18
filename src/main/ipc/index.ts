import { registerItemHandlers } from './items'
import { registerQuantityLogHandlers } from './quantity_logs'
import { registerSalesHandlers } from './sales'
import { registerSettingsHandlers } from './settings'
import { registerAIHandlers } from './ai'
import { registerLabelHandlers } from './labels'
import { registerDashboardHandlers } from './dashboard'
import { registerSyncHandlers } from '../sync'

export function registerAllHandlers(): void {
  registerItemHandlers()
  registerQuantityLogHandlers()
  registerSalesHandlers()
  registerSettingsHandlers()
  registerAIHandlers()
  registerLabelHandlers()
  registerDashboardHandlers()
  registerSyncHandlers()
}
