import type { User } from 'firebase/auth';
import { createContext, useContext } from 'react';

export type AuthState = {
  user: User | null; // ログインしていなければ null
  loading: boolean; // ログイン状態を確認中なら true
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

// 各画面からログイン状態を受け取るためのフック
export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth は AuthProvider の内側で使ってください');
  }
  return auth;
}
