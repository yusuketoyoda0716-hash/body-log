import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useRepository } from '../repositories/repositoryContext';
import { SKIPPED_STEP, stepsFor, type ChapterId, type TutorialEvent, type TutorialStep } from './steps';
import { TutorialContext } from './tutorialContext';
import { TutorialOverlay } from './TutorialOverlay';

type Progress = { steps: TutorialStep[]; index: number };

// チュートリアルの進み具合を持ち、画面の上に案内を重ねる
// ログインしている人は Firestore、ゲストはブラウザに「見終わった」を保存して、初回だけ自動で出す
export function TutorialProvider({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [lastEntryId, setLastEntryId] = useState<string | null>(null);

  const step = progress ? progress.steps[progress.index] : null;

  // まだ見ていなければ、最初から出す
  useEffect(() => {
    let ignore = false;
    repository.isTutorialDone().then((done) => {
      if (!ignore && !done) setProgress({ steps: stepsFor(), index: 0 });
    });
    return () => {
      ignore = true;
    };
  }, [repository]);

  // ステップに画面が決まっていれば、その画面を開く
  const route = step?.route;
  useEffect(() => {
    if (route && pathname !== route) navigate(route);
  }, [route, pathname, navigate]);

  const finish = useCallback(() => {
    setProgress(null);
    setLastEntryId(null);
    repository.markTutorialDone().catch(() => {
      // 保存できなくても使い方には困らないので、次に開いたときにもう一度出るだけにする
    });
  }, [repository]);

  const next = useCallback(() => {
    if (!progress) return;
    if (progress.index + 1 >= progress.steps.length) {
      finish();
      return;
    }
    setProgress({ ...progress, index: progress.index + 1 });
  }, [progress, finish]);

  // スキップしたら「見終わった」として保存し、見直し方だけ伝える
  const skip = useCallback(() => {
    repository.markTutorialDone().catch(() => {});
    setLastEntryId(null);
    setProgress({ steps: [SKIPPED_STEP], index: 0 });
  }, [repository]);

  const start = useCallback((chapter?: ChapterId) => {
    setLastEntryId(null);
    setProgress({ steps: stepsFor(chapter), index: 0 });
  }, []);

  const notify = useCallback(
    (event: TutorialEvent, entryId?: string) => {
      if (event === 'entry-added' && entryId) setLastEntryId(entryId);
      if (!progress || !step) return;
      if (step.waitFor === event) {
        next();
        return;
      }
      // ダイアログの中の案内の途中で閉じたら、ダイアログを開くステップに戻る
      if (event === 'dialog-closed' && step.inDialog && progress.index > 0) {
        setProgress({ ...progress, index: progress.index - 1 });
      }
    },
    [progress, step, next],
  );

  return (
    <TutorialContext.Provider value={{ step, lastEntryId, start, notify }}>
      {children}
      {progress && step && !step.inDialog && (
        <TutorialOverlay
          // ステップが変わるたびに作り直して、光らせる場所を探し直す
          key={`${progress.steps.length}-${progress.index}-${step.title}`}
          step={step}
          position={{ current: progress.index + 1, total: progress.steps.length }}
          isLast={progress.index + 1 >= progress.steps.length}
          onNext={next}
          onSkip={step === SKIPPED_STEP ? null : skip}
        />
      )}
    </TutorialContext.Provider>
  );
}
