let context;
let utterance;
export function speak(text, enabled = true, onEnd) {
  if (
    !enabled ||
    !("speechSynthesis" in window) ||
    !("SpeechSynthesisUtterance" in window)
  ) {
    onEnd?.();
    return false;
  }
  try {
    window.speechSynthesis.cancel();
    utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = 0.78;
    utterance.pitch = 1.08;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice =
      voices.find(
        (v) => v.lang === "en-GB" && /female|serena|kate|google/i.test(v.name),
      ) ||
      voices.find((v) => v.lang === "en-GB") ||
      voices.find((v) => v.lang.startsWith("en")) ||
      null;
    utterance.onend = () => onEnd?.();
    utterance.onerror = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    onEnd?.();
    return false;
  }
}
export function stopSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* Optional audio must never block play. */
  }
}
export function chime(enabled = true, big = false) {
  if (!enabled) return;
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    context.resume();
    [523.25, 659.25, 783.99, ...(big ? [1046.5] : [])].forEach((hz, i) => {
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.type = "sine";
      osc.frequency.value = hz;
      const t = context.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  } catch {}
}
