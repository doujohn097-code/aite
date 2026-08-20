/** يحسب قمم الموجة الصوتية (0..1) والمدة بالثواني من ملف صوتي */
export async function getAudioWaveform(
  file: Blob
): Promise<{ duration: number; peaks: number[] }> {
  const fallback = { duration: 0, peaks: [] as number[] };
  if (typeof window === 'undefined') return fallback;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return fallback;

    const context = new AudioContextClass();
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    const duration = audioBuffer.duration;

    const channel = audioBuffer.getChannelData(0);
    const bars = 60;
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const peaks: number[] = [];
    for (let i = 0; i < bars; i += 1) {
      let sum = 0;
      const start = i * blockSize;
      for (let j = 0; j < blockSize; j += 1)
        sum += Math.abs(channel[start + j] ?? 0);
      peaks.push(sum / blockSize);
    }
    const max = Math.max(...peaks, 0.001);
    void context.close().catch(() => undefined);
    return { duration, peaks: peaks.map((p) => p / max) };
  } catch {
    return fallback;
  }
}
