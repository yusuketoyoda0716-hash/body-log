import type { ReactNode } from 'react';
import type { DataRepository } from './DataRepository';
import { RepositoryContext } from './repositoryContext';

type Props = {
  repository: DataRepository;
  children: ReactNode;
};

export function RepositoryProvider({ repository, children }: Props) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}
