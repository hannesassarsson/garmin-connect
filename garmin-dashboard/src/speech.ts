// Uppläsning med telefonens inbyggda talsyntes (ingen kostnad, inget skickas iväg).
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function plainText(md: string): string {
  return md
    .replace(/\|[-: |]+\|/g, ' ')
    .replace(/[#*_>`|]/g, ' ')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(plainText(text));
  u.lang = 'sv-SE';
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('sv'));
  if (voice) u.voice = voice;
  u.rate = 1.02;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  synth.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}
