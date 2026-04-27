import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from '@google/generative-ai'
import type { AIMessage, AIResponse, ToolDefinition, ToolCall } from '../../shared/types'
import type { AIProvider } from './index'

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI
  private model: string

  constructor(apiKey: string, model: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = model || 'gemini-1.5-pro'
  }

  async chat(messages: AIMessage[], tools: ToolDefinition[]): Promise<AIResponse> {
    const genModel = this.genAI.getGenerativeModel({
      model: this.model,
      tools: [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: this.convertParameters(t.parameters)
          }))
        }
      ],
      systemInstruction: 'あなたはSASO Willen Editionの在庫・販売管理AIアシスタントです。日本語で回答してください。'
    })

    // Build history (all except last user message)
    const history = messages
      .filter((m) => m.role !== 'system')
      .slice(0, -1)
      .map((m) => {
        if (m.role === 'tool') {
          return {
            role: 'function' as const,
            parts: [
              {
                functionResponse: {
                  name: m.tool_name || 'unknown',
                  response: { result: m.content }
                }
              }
            ]
          }
        }
        const msg = m as AIMessage & { tool_calls?: ToolCall[] }
        if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
          return {
            role: 'model' as const,
            parts: msg.tool_calls.map((tc) => ({
              functionCall: {
                name: tc.name,
                args: tc.arguments
              }
            }))
          }
        }
        return {
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.content }]
        }
      })

    const lastMessage = messages.filter((m) => m.role !== 'system').slice(-1)[0]
    const chat = genModel.startChat({ history })

    const result = await chat.sendMessage(lastMessage?.content || '')
    const response = result.response

    const toolCalls: ToolCall[] = []
    let textContent = ''

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if ('text' in part && part.text) {
        textContent += part.text
      } else if ('functionCall' in part && part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          arguments: part.functionCall.args as Record<string, unknown>
        })
      }
    }

    return {
      message: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }

  private convertParameters(params: Record<string, unknown>): Record<string, unknown> {
    if (!params || typeof params !== 'object') return { type: FunctionDeclarationSchemaType.OBJECT, properties: {} }
    return params as Record<string, unknown>
  }
}
