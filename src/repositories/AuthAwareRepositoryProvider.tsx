import { useMemo, type ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import type { DataRepository } from './DataRepository';
import { FirestoreRepository } from './firestoreRepository';
import { LocalStorageRepository } from './localStorageRepository';
import { RepositoryProvider } from './RepositoryProvider';

const guestRepository = new LocalStorageRepository();

export function AuthAwareRepositoryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? null;

  // ログイン中は Firestore、ゲストは localStorage
  const repository = useMemo<DataRepository>(
    () => (uid ? new FirestoreRepository(uid) : guestRepository),
    [uid],
  );

  // ログイン状態の確認が終わるまでは画面を出さない（ゲストのデータが一瞬見えるのを防ぐ）
  if (loading) {
    return <p style={{ padding: 24, color: 'var(--color-muted)' }}>読み込み中…</p>;
  }

  // key を変えると中身が作り直され、各画面の表示が新しい保存先のデータに切り替わる
  return (
    <RepositoryProvider key={uid ?? 'guest'} repository={repository}>
      {children}
    </RepositoryProvider>
  );
}
