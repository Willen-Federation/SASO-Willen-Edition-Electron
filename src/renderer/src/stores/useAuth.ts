import { create } from 'zustand'
import type { AuthUser } from '@shared/types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  /** Browser-based pairing flow (QR / external provider). */
  login: () => Promise<void>
  /** REST credential flow — POST /api/v1/auth/login. */
  loginWithPassword: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,

  checkAuth: async () => {
    set({ loading: true })
    try {
      const result = await window.api.auth.getUser()
      if (result.success && result.data) {
        const tokenResult = await window.api.auth.getToken()
        set({
          user: result.data as AuthUser,
          token: tokenResult.data || null,
          isAuthenticated: true,
          loading: false
        })
      } else {
        set({ user: null, token: null, isAuthenticated: false, loading: false })
      }
    } catch {
      set({ user: null, token: null, isAuthenticated: false, loading: false })
    }
  },

  login: async () => {
    const result = await window.api.auth.pair()
    if (!result.success) {
      throw new Error(result.error || 'ペアリングに失敗しました')
    }
  },

  loginWithPassword: async (username, password) => {
    const result = await window.api.auth.login(username, password)
    if (!result.success) {
      throw new Error(result.error || 'ログインに失敗しました')
    }
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ user: null, token: null, isAuthenticated: false })
  }
}))
