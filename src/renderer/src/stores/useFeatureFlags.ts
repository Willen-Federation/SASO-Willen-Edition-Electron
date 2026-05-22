import { create } from 'zustand'
import type { FeatureFlag } from '@shared/types'

interface FeatureFlagsState {
  flags: FeatureFlag[]
  version: string
  generatedAt: string
  loaded: boolean
  loading: boolean
  error: string | null
  load: () => Promise<void>
  isEnabled: (key: string) => boolean
}

export const useFeatureFlags = create<FeatureFlagsState>((set, get) => ({
  flags: [],
  version: '',
  generatedAt: '',
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    const result = await window.api.sync.mobileConfig()
    if (result.success) {
      set({
        flags: result.data.featureFlags ?? [],
        version: result.data.version ?? '',
        generatedAt: result.data.generatedAt ?? '',
        loaded: true,
        loading: false
      })
    } else {
      set({ loading: false, error: result.error })
    }
  },

  isEnabled: (key: string) => {
    const flag = get().flags.find((f) => f.key === key)
    return flag ? flag.enabled : false
  }
}))
