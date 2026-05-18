import { create } from 'zustand'
import type { AppSettings } from '@shared/types'

const defaultSettings: AppSettings = {
  taxRate: 10,
  currency: 'JPY',
  language: 'ja',
  sasoServerUrl: 'https://saso.sksl.jp',
  aiProvider: 'claude',
  claudeApiKey: '',
  claudeModel: 'claude-opus-4-5',
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-pro',
  defaultPrinter: '',
  defaultLabelSize: '58mm'
}

interface SettingsState {
  settings: AppSettings
  loading: boolean
  loadSettings: () => Promise<void>
  updateSetting: (key: keyof AppSettings, value: string | number) => Promise<void>
  saveSettings: (partial: Partial<AppSettings>) => Promise<void>
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    try {
      const result = await window.api.settings.getAll()
      if (result.success && result.data) {
        const raw = result.data as Record<string, string>
        const settings: AppSettings = {
          taxRate: parseFloat(raw.taxRate || '10'),
          currency: raw.currency || 'JPY',
          language: raw.language || 'ja',
          sasoServerUrl: raw.sasoServerUrl || 'https://saso.sksl.jp',
          aiProvider: (raw.aiProvider as AppSettings['aiProvider']) || 'claude',
          claudeApiKey: raw.claudeApiKey || '',
          claudeModel: raw.claudeModel || 'claude-opus-4-5',
          openaiApiKey: raw.openaiApiKey || '',
          openaiModel: raw.openaiModel || 'gpt-4o',
          geminiApiKey: raw.geminiApiKey || '',
          geminiModel: raw.geminiModel || 'gemini-1.5-pro',
          defaultPrinter: raw.defaultPrinter || '',
          defaultLabelSize: raw.defaultLabelSize || '58mm'
        }
        set({ settings, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  updateSetting: async (key, value) => {
    await window.api.settings.set(key, String(value))
    set((state) => ({
      settings: { ...state.settings, [key]: value }
    }))
  },

  saveSettings: async (partial) => {
    for (const [key, value] of Object.entries(partial)) {
      if (value !== undefined) {
        await window.api.settings.set(key, String(value))
      }
    }
    set((state) => ({
      settings: { ...state.settings, ...partial }
    }))
  }
}))
