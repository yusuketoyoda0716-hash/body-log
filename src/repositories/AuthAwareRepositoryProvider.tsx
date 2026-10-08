import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/authContext';
import type { DataRepository } from './DataRepository';
import { LocalStorageRepository } from './localStorageRepository';
import { RepositoryProvider } from './RepositoryProvider';

const guestRepository = new LocalStorageRepository();

export function AuthAwareRepositoryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const uid = user?.uid ?? null;

  // 読み込んだ Firestore 版を「どのユーザーの分か」とセットで持つ（今日画面と同じ考え方）
  const [loaded, setLoaded] = useState<{ uid: string; repository: DataRepository } | null>(null);

  // ログインしたときだけ、Firestore 版のファイルを読み込む
  useEffect(() => {
    if (!uid) return;
    let ignore = false;
    import('./firestoreRepository').then(({ FirestoreRepository }) => {
      if (!ignore) setLoaded({ uid, repository: new FirestoreRepository(uid) });
    });
    return () => {
      ignore = true;
    };
  }, [uid]);

  // ゲストは localStorage。ログイン中は、そのユーザーの Firestore 版が用意できていれば使う
  const repository = uid ? (loaded?.uid === uid ? loaded.repository : null) : guestRepository;

  // ログイン状態の確認中、または Firestore 版の読み込み中
  if (loading || !repository) {
    return <p style={{ padding: 24, color: 'var(--color-muted)' }}>読み込み中…</p>;
  }

  return (
    <RepositoryProvider key={uid ?? 'guest'} repository={repository}>
      {children}
    </RepositoryProvider>
  );
}
