import type { TutorialDialog } from './steps';
import { useTutorial } from './tutorialContext';
import styles from './TutorialHint.module.css';

// ダイアログの中に出すチュートリアルの案内
// （ダイアログは画面のいちばん上に重なるので、外に出した案内は見えなくなるため）
export function TutorialHint({ dialog }: { dialog: TutorialDialog }) {
  const { step } = useTutorial();
  if (step?.inDialog !== dialog) return null;
  return (
    <div className={styles.hint} role="status">
      <span className={styles.label}>使い方</span>
      <strong>{step.title}</strong>
      <span>{step.body}</span>
    </div>
  );
}
