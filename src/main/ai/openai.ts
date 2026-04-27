import OpenAI from 'openai'
import type { AIMessage, AIResponse, ToolDefinition, ToolCall } from '../../shared/types'
import type { AIProvider } from './index'

export class OpenAIProvider implements AIProvider {
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey })
    this.model = model || 'gpt-4o'
  }

  async chat(messages: AIMessage[], tools: ToolDefinition[]): Promise<AIResponse> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.tool_call_id || m.tool_name || 'unknown'
        }
      }
      const msg = m as AIMessage & { tool_calls?: ToolCall[] }
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: msg.tool_calls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }))
        }
      }
      return {
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      }
    })

    const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }))

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: 'auto'
    })

    const choice = response.choices[0]
    const toolCalls: ToolCall[] = []

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>
        })
      }
    }

    return {
      message: choice.message.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }
}
