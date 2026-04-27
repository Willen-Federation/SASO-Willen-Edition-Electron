import type { AIConfig, AIMessage, AIResponse, ToolDefinition } from '../../shared/types'
import { ClaudeProvider } from './claude'
import { OpenAIProvider } from './openai'
import { GeminiProvider } from './gemini'

export interface AIProvider {
  chat(messages: AIMessage[], tools: ToolDefinition[]): Promise<AIResponse>
}

export function createAIProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'claude':
      return new ClaudeProvider(config.apiKey, config.model)
    case 'openai':
      return new OpenAIProvider(config.apiKey, config.model)
    case 'gemini':
      return new GeminiProvider(config.apiKey, config.model)
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}
