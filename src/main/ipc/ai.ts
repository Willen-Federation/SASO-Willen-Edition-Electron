import { ipcMain } from 'electron'
import {
  getSetting,
  searchItems,
  listFeatures,
  getFeature,
  addStockIn,
  addShipment,
  getFeatureCurrentQuantity,
  listQuantityLogs,
  getOrders,
  createOrder,
  getDashboardStats
} from '../database'
import { createAIProvider } from '../ai'
import type { AIMessage, AIConfig, ToolDefinition, ToolCall } from '../../shared/types'

const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'searchItems',
    description: '商品を検索する',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索キーワード' }
      },
      required: ['query']
    }
  },
  {
    name: 'getFeature',
    description: 'バリエーション（バーコード単位）の詳細を取得する',
    parameters: {
      type: 'object',
      properties: {
        fullCode: { type: 'string', description: '12桁のフルコード（バーコード）' }
      },
      required: ['fullCode']
    }
  },
  {
    name: 'listFeatures',
    description: 'バリエーション一覧を取得する',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: '商品ID（省略時は全バリエーション）' }
      },
      required: []
    }
  },
  {
    name: 'stockIn',
    description: '入庫処理（在庫を増やす）',
    parameters: {
      type: 'object',
      properties: {
        fullCode: { type: 'string', description: '12桁のフルコード' },
        quantity: { type: 'number', description: '入庫数量（正の数）' },
        reason: { type: 'string', description: '理由（任意）' }
      },
      required: ['fullCode', 'quantity']
    }
  },
  {
    name: 'shipment',
    description: '出荷処理（在庫を減らす）',
    parameters: {
      type: 'object',
      properties: {
        fullCode: { type: 'string', description: '12桁のフルコード' },
        quantity: { type: 'number', description: '出荷数量（正の数）' },
        reason: { type: 'string', description: '理由（任意）' }
      },
      required: ['fullCode', 'quantity']
    }
  },
  {
    name: 'getQuantity',
    description: '現在の在庫数を取得する',
    parameters: {
      type: 'object',
      properties: {
        fullCode: { type: 'string', description: '12桁のフルコード' }
      },
      required: ['fullCode']
    }
  },
  {
    name: 'listQuantityLogs',
    description: '在庫変動履歴を取得する',
    parameters: {
      type: 'object',
      properties: {
        fullCode: { type: 'string', description: 'フルコード（省略時は全履歴）' }
      },
      required: []
    }
  },
  {
    name: 'listOrders',
    description: '販売注文一覧を取得する',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'createSalesOrder',
    description: '販売注文を作成する',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '注文アイテム',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' }
            }
          }
        },
        customerId: { type: 'string', description: '顧客ID（省略可）' },
        notes: { type: 'string', description: '備考' }
      },
      required: ['items']
    }
  },
  {
    name: 'getDashboardStats',
    description: 'ダッシュボード統計を取得する',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
]

async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'searchItems':
      return searchItems(args.query as string)
    case 'getFeature':
      return getFeature(args.fullCode as string)
    case 'listFeatures':
      return listFeatures(args.itemId as string | undefined)
    case 'stockIn':
      return addStockIn(args.fullCode as string, args.quantity as number, args.reason as string | undefined)
    case 'shipment':
      return addShipment(args.fullCode as string, args.quantity as number, args.reason as string | undefined)
    case 'getQuantity':
      return getFeatureCurrentQuantity(args.fullCode as string)
    case 'listQuantityLogs':
      return listQuantityLogs(args.fullCode as string | undefined)
    case 'listOrders':
      return getOrders()
    case 'createSalesOrder':
      return createOrder({
        customer_id: args.customerId as string | undefined,
        items: args.items as { product_id: string; quantity: number; unit_price: number }[],
        notes: args.notes as string | undefined
      })
    case 'getDashboardStats':
      return getDashboardStats()
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

export function registerAIHandlers(): void {
  ipcMain.handle('ai:chat', async (_event, messages: AIMessage[]) => {
    try {
      const provider = (getSetting('aiProvider') || 'claude') as AIConfig['provider']
      const apiKey = getSetting(`${provider}ApiKey`) || ''
      const model = getSetting(`${provider}Model`) || ''

      if (!apiKey) {
        return { success: false, error: 'APIキーが設定されていません。設定ページで入力してください。' }
      }

      const config: AIConfig = { provider, apiKey, model }
      const aiProvider = createAIProvider(config)

      const toolCalls: ToolCall[] = []
      let currentMessages = [...messages]

      // First call
      let response = await aiProvider.chat(currentMessages, AI_TOOLS)

      // Handle tool calls in a loop
      while (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          const result = await executeTool(tc.name, tc.arguments)
          tc.result = result
          toolCalls.push(tc)
        }

        // Add assistant message with tool calls and tool results for follow-up
        currentMessages = [
          ...currentMessages,
          {
            role: 'assistant',
            content: response.message || '',
            tool_calls: response.toolCalls
          } as AIMessage & { tool_calls?: ToolCall[] },
          ...response.toolCalls.map((tc) => ({
            role: 'tool' as const,
            content: JSON.stringify(tc.result),
            tool_call_id: tc.id,
            tool_name: tc.name
          }))
        ]

        response = await aiProvider.chat(currentMessages, AI_TOOLS)
        if (!response.toolCalls || response.toolCalls.length === 0) break
      }

      return {
        success: true,
        data: {
          message: response.message,
          toolCalls
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
