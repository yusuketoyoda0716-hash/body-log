// 文字をクリップボードにコピーする。できたら true
//   1. ふつうはクリップボードAPI（navigator.clipboard）を使う
//   2. ブラウザやアプリ内ブラウザによっては使えないので、入力欄を選択して昔ながらの方法で試す
//   3. それもだめなら false を返す（入力欄は選択した状態のままなので、手でコピーしてもらう）
export async function copyText(
  text: string,
  fallbackField?: HTMLInputElement | HTMLTextAreaElement | null,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 次の方法を試す
  }

  if (!fallbackField) return false;
  fallbackField.focus();
  fallbackField.select();
  return document.execCommand?.('copy') ?? false;
}
