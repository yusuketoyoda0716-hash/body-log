import { createContext, useContext } from 'react';
import type { DataRepository } from './DataRepository';

export const RepositoryContext = createContext<DataRepository | null>(null);

// 各画面からリポジトリを受け取るためのフック
export function useRepository(): DataRepository {
  const repository = useContext(RepositoryContext);
  if (!repository) {
    throw new Error('useRepository は RepositoryProvider の内側で使ってください');
  }
  return repository;
}
