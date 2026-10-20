import { createContext, useContext } from 'react';
import type { ChapterId, TutorialEvent, TutorialStep } from './steps';

export type TutorialState = {
  step: TutorialStep | null; // 表示中のステップ（チュートリアル中でなければ null）
  lastEntryId: string | null; // チュートリアル中に追加した記録（「記録を直す」で光らせる）
  start: (chapter?: ChapterId) => void;
  notify: (event: TutorialEvent, entryId?: string) => void;
};

export const TutorialContext = createContext<TutorialState | null>(null);

// チュートリアルの外（テストなど）で使われても困らないように、何もしない形を返す
const inactive: TutorialState = {
  step: null,
  lastEntryId: null,
  start: () => {},
  notify: () => {},
};

export function useTutorial(): TutorialState {
  return useContext(TutorialContext) ?? inactive;
}
