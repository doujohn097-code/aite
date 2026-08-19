import { useEffect, useRef, useState } from 'react';
import { HeroIcon } from '@components/ui/hero-icon';

type VoiceRecorderProps = {
  onComplete: (blob: Blob, duration: number, peaks: number[]) => void;
  onCancel: () => void;
};

const LIVE_BARS = 28;
const SAMPLE_INTERVAL_MS = 80;

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({
  onComplete,
  onCancel
}: VoiceRecorderProps): JSX.Element {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const peaksRef = useRef<number[]>([]);
  const startRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cancelledRef = useRef(false);

  const [elapsed, setElapsed] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>(
    Array.from({ length: LIVE_BARS }, () => 0.12)
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timerId: ReturnType<typeof setInterval> | null = null;

    const start = async (): Promise<void> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        intervalId = setInterval(() => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += (buffer[i] - 128) ** 2;
          const rms = Math.min(Math.sqrt(sum / buffer.length) / 40, 1);
          peaksRef.current.push(Math.max(rms, 0.08));
          setLiveBars((prev) => [...prev.slice(1), Math.max(rms, 0.12)]);
        }, SAMPLE_INTERVAL_MS);

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          void audioCtx.close().catch(() => undefined);
          if (cancelledRef.current) return;
          const duration = (Date.now() - startRef.current) / 1000;
          if (duration < 0.5 || !chunksRef.current.length) {
            onCancel();
            return;
          }
          onComplete(
            new Blob(chunksRef.current, {
              type: recorder.mimeType || 'audio/webm'
            }),
            duration,
            peaksRef.current.length ? peaksRef.current : [0.4, 0.8, 0.5, 1, 0.6]
          );
        };

        startRef.current = Date.now();
        recorder.start(200);
        timerId = setInterval(
          () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
          500
        );
      } catch {
        setError(true);
      }
    };

    void start();

    return () => {
      cancelledRef.current = true;
      if (intervalId) clearInterval(intervalId);
      if (timerId) clearInterval(timerId);
      if (recorderRef.current?.state !== 'inactive')
        recorderRef.current?.stop();
      else {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        void audioCtxRef.current?.close().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = (): void => {
    cancelledRef.current = false;
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
  };

  if (error)
    return (
      <div className='flex flex-1 items-center justify-between gap-2 px-3 py-2'>
        <p className='text-sm text-accent-red'>
          تعذر الوصول للميكروفون، تحقق من الأذونات
        </p>
        <button
          type='button'
          onClick={onCancel}
          className='custom-button dark-bg-tab p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
          aria-label='إغلاق'
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </button>
      </div>
    );

  return (
    <div className='flex flex-1 items-center gap-2 px-2 py-1'>
      <button
        type='button'
        onClick={onCancel}
        aria-label='حذف التسجيل'
        className='custom-button p-2 text-accent-red transition hover:bg-accent-red/10 active:scale-90'
      >
        <HeroIcon className='h-5 w-5' iconName='TrashIcon' />
      </button>

      <span className='h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent-red' />
      <span className='shrink-0 text-sm tabular-nums text-light-secondary dark:text-dark-secondary'>
        {formatTimer(elapsed)}
      </span>

      <div className='flex h-8 flex-1 items-center justify-end gap-[2px] overflow-hidden'>
        {liveBars.map((height, index) => (
          <span
            key={index}
            className='w-[3px] shrink-0 rounded-full bg-main-accent transition-[height] duration-100'
            style={{ height: `${Math.round(height * 100)}%` }}
          />
        ))}
      </div>

      <button
        type='button'
        onClick={finish}
        aria-label='إنهاء التسجيل'
        className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   bg-main-accent text-black transition hover:brightness-90 active:scale-90'
      >
        <HeroIcon className='h-5 w-5' iconName='CheckIcon' solid />
      </button>
    </div>
  );
}
