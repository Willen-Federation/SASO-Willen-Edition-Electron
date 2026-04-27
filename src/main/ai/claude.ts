import Anthropic from '@anthropic-ai/sdk'
import type { AIMessage, AIResponse, ToolDefinition, ToolCall } from '../../shared/types'
import type { AIProvider } from './index'

export class ClaudeProvider implements AIProvider {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey })
    this.model = model || 'claude-opus-4-5'
  }

  async chat(messages: AIMessage[], tools: ToolDefinition[]): Promise<AIResponse> {
    const anthropicMessages: Anthropic.MessageParam[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: m.tool_call_id || 'unknown',
                content: m.content
              }
            ]
          }
        }
        const msg = m as AIMessage & { tool_calls?: ToolCall[] }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const content: Anthropic.MessageParam['content'] = []
          if (m.content) {
            (content as Array<{ type: string; text: string }>).push({ type: 'text', text: m.content })
          }
          for (const tc of msg.tool_calls) {
            (content as Array<{ type: string; id: string; name: string; input: unknown }>).push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments
            })
          }
          return {
            role: 'assistant' as const,
            content
          }
        }
        return {
          role: m.role as 'user' | 'assistant',
          content: m.content
        }
      })

    const systemMessage = messages.find((m) => m.role === 'system')?.content ||
      'あなたはSASO Willen Editionの在庫・販売管理AIアシスタントです。日本語で回答してください。ツールを使って在庫や売上のデータを確認・操作できます。'

    const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as Anthropic.Tool['input_schema']
    }))

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage,
      messages: anthropicMessages,
      tools: anthropicTools
    })

    const toolCalls: ToolCall[] = []
    let textContent = ''

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>
        })
      }
    }

    return {
      message: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }
}
