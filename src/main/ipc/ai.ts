import { ipcMain } from 'electron'
import { getSetting, getProducts, searchProducts, getInventory, getInventoryByProductId, adjustStock, getOrders, createOrder, getDashboardStats } from '../database'
import { createAIProvider } from '../ai'
import type { AIMessage, AIConfig, ToolDefinition, ToolCall } from '../../shared/types'

const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'listProducts',
    description: '商品一覧を取得する',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索キーワード（省略可）' }
      },
      required: []
    }
  },
  {
    name: 'getProduct',
    description: '商品詳細を取得する',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '商品ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'getInventory',
    description: '在庫情報を取得する',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: '商品ID（省略時は全商品）' }
      },
      required: []
    }
  },
  {
    name: 'adjustStock',
    description: '在庫を調整する',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: '商品ID' },
        quantity: { type: 'number', description: '数量（正=入庫、負=出庫）' },
        reason: { type: 'string', description: '理由' }
      },
      required: ['productId', 'quantity']
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
  },
  {
    name: 'searchProducts',
    description: '商品を検索する',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '検索キーワード' }
      },
      required: ['query']
    }
  }
]

async function executeTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  switch (toolName) {
    case 'listProducts':
      return args.query ? searchProducts(args.query as string) : getProducts()
    case 'getProduct': {
      const products = getProducts()
      return products.find((p) => p.id === args.id) || null
    }
    case 'getInventory':
      return args.productId
        ? getInventoryByProductId(args.productId as string)
        : getInventory()
    case 'adjustStock': {
      const qty = args.quantity as number
      const type = qty >= 0 ? 'in' : 'out'
      return adjustStock(
        args.productId as string,
        qty,
        type as 'in' | 'out',
        args.reason as string | undefined
      )
    }
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
    case 'searchProducts':
      return searchProducts(args.query as string)
    default:
      throw new Error(`Unknown tool: ${toolName}`)
  }
}

export function registerAIHandlers(): void {
  ipcMain.handle('ai:chat', async (_event, messages: AIMessage[]) => {
    try {
      const provider = (getSetting('aiProvider') || 'claude') as AIConfig['provider']
      const apiKey = getSetting(`${provider}ApiKey`) || getSetting(`${provider === 'claude' ? 'claude' : provider}ApiKey`) || ''
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
            tool_call_id: tc.name,
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
