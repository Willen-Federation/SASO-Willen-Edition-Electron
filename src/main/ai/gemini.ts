import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import type { FunctionDeclaration, FunctionDeclarationSchemaProperty } from '@google/generative-ai'
import { randomUUID } from 'crypto'
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
          functionDeclarations: tools.map((t): FunctionDeclaration => ({
            name: t.name,
            description: t.description,
            parameters: {
              type: SchemaType.OBJECT,
              properties: (t.parameters as { properties?: Record<string, FunctionDeclarationSchemaProperty> }).properties || {},
              required: (t.parameters as { required?: string[] }).required || []
            }
          }))
        }
      ],
      systemInstruction: 'あなたはSASO Willen Editionの在庫・販売管理AIアシスタントです。日本語で回答してください。'
    })

    // Build history (all except last user message)
    const allMessages = messages.filter((m) => m.role !== 'system')
    const historyMessages = allMessages.slice(0, -1)
    const lastMessage = allMessages[allMessages.length - 1]

    const history = historyMessages.map((m) => {
      const msg = m as AIMessage & { tool_calls?: ToolCall[] }
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
          id: randomUUID(),
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
}
