import { registerItemHandlers } from './items'
import { registerQuantityLogHandlers } from './quantity_logs'
import { registerSalesHandlers } from './sales'
import { registerSettingsHandlers } from './settings'
import { registerAIHandlers } from './ai'
import { registerLabelHandlers } from './labels'
import { registerDashboardHandlers } from './dashboard'
import { registerShellHandlers } from './shell'
import { registerDialogHandlers } from './dialog'
import { registerSyncHandlers } from '../sync'
import { registerSyncQueueHandlers, startSyncQueueWorker } from '../sync/queue'

export function registerAllHandlers(): void {
  registerItemHandlers()
  registerQuantityLogHandlers()
  registerSalesHandlers()
  registerSettingsHandlers()
  registerAIHandlers()
  registerLabelHandlers()
  registerDashboardHandlers()
  registerShellHandlers()
  registerDialogHandlers()
  registerSyncHandlers()
  registerSyncQueueHandlers()
  startSyncQueueWorker()
}
