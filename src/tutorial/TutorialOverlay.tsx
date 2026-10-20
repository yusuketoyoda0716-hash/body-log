import { useEffect, useState } from 'react';
import { targetOf, type TutorialStep } from './steps';
import styles from './TutorialOverlay.module.css';

type Props = {
  step: TutorialStep;
  position: { current: number; total: number };
  isLast: boolean;
  onNext: () => void;
  onSkip: (() => void) | null; // null ならスキップを出さない
};

type Rect = { top: number; left: number; width: number; height: number };

// 光らせる要素のまわりに少し余白をとる
const PADDING = 6;

function findRect(step: TutorialStep): Rect | null {
  const target = targetOf(step);
  if (!target) return null;
  const el = document.querySelector(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - PADDING,
    left: r.left - PADDING,
    width: r.width + PADDING * 2,
    height: r.height + PADDING * 2,
  };
}

// 光らせる要素（スポットライト）と、説明のカードを重ねて出す
export function TutorialOverlay({ step, position, isLast, onNext, onSkip }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  // 要素が見つからないまま時間がたったら、画面の真ん中に案内を出す
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const target = targetOf(step);
    if (!target) return;
    let scrolled = false;

    // 画面の切り替えや読み込みを待つため、しばらく探し続ける。スクロールや大きさの変化にもついていく
    const update = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el && !scrolled) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        scrolled = true;
      }
      setRect(findRect(step));
    };
    update();
    const timer = window.setInterval(update, 200);
    const giveUp = window.setTimeout(() => setGaveUp(true), 2000);
    window.addEventListener('resize', update);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(giveUp);
      window.removeEventListener('resize', update);
    };
  }, [step]);

  const hasTarget = targetOf(step) !== null;
  // 探している途中は何も出さない（一瞬だけ真ん中に出てから動くのを防ぐ）
  if (hasTarget && !rect && !gaveUp) return null;

  // 操作を待つステップでも、光らせる要素が見つからなければ「次へ」で進めるようにする
  const waiting = Boolean(step.waitFor) && rect !== null;

  // 要素が画面の上半分にあればカードは下に、下半分にあれば上に出す
  const cardPlace = !rect ? 'center' : rect.top + rect.height / 2 < window.innerHeight / 2 ? 'bottom' : 'top';

  return (
    <div className={styles.root}>
      {/* 操作を待たないステップでは、ほかの場所を押せないようにする */}
      {!waiting && <div className={styles.blocker} />}

      {rect ? (
        <div
          className={styles.spotlight}
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      ) : (
        <div className={styles.dim} />
      )}

      <section
        className={`${styles.card} ${styles[cardPlace]}`}
        role="dialog"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-body"
      >
        <p className={styles.progress}>
          {position.total > 1 ? `${position.current} / ${position.total}` : '使い方'}
        </p>
        <h2 id="tutorial-title" className={styles.title}>
          {step.title}
        </h2>
        <p id="tutorial-body" className={styles.body}>
          {step.body}
        </p>

        <div className={styles.actions}>
          {onSkip && (
            <button type="button" className={styles.skip} onClick={onSkip}>
              スキップ
            </button>
          )}
          {waiting ? (
            <span className={styles.waiting}>光っているところを押してください</span>
          ) : (
            <button type="button" className={styles.next} onClick={onNext} autoFocus>
              {isLast ? '閉じる' : '次へ'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
