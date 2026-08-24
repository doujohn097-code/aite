import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  MAX_AUDIO_UPLOAD_BYTES,
  MAX_VOICE_DURATION_SECONDS
} from '@lib/media-limits';
import { HeroIcon } from '@components/ui/hero-icon';
import { useLanguage } from '@lib/context/language-context';
import { tx } from '@lib/i18n/tx';

type VoiceRecorderProps = {
  onComplete: (blob: Blob, duration: number, peaks: number[]) => void;
  onCancel: () => void;
};

const LIVE_BARS = 28;
const SAMPLE_INTERVAL_MS = 80;
const RECORDER_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus'
];

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getMicrophoneError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return tx('err.micDenied');
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return tx('err.micMissing');
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return tx('err.micBusy');
  if (error instanceof Error && error.message === 'unsupported')
    return tx('err.micWebview');

  return tx('err.micGeneric');
}

export function VoiceRecorder({
  onComplete,
  onCancel
}: VoiceRecorderProps): JSX.Element {
  const { t } = useLanguage();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedBytesRef = useRef(0);
  const peaksRef = useRef<number[]>([]);
  const startRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const cancelledRef = useRef(false);

  const [elapsed, setElapsed] = useState(0);
  const [liveBars, setLiveBars] = useState<number[]>(
    Array.from({ length: LIVE_BARS }, () => 0.12)
  );
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const isAndroidApp =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timerId: ReturnType<typeof setInterval> | null = null;

    cancelledRef.current = false;
    chunksRef.current = [];
    recordedBytesRef.current = 0;
    peaksRef.current = [];
    setElapsed(0);
    setLiveBars(Array.from({ length: LIVE_BARS }, () => 0.12));
    setError(null);

    const start = async (): Promise<void> => {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
          throw new Error('unsupported');

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        if (cancelledRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        // الرسم الصوتي تحسين بصري فقط؛ فشله في بعض إصدارات Android WebView
        // يجب ألا يمنع التسجيل نفسه.
        try {
          const AudioContextClass =
            window.AudioContext ||
            (window as Window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            audioCtxRef.current = audioCtx;
            if (audioCtx.state === 'suspended')
              await audioCtx.resume().catch(() => undefined);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            audioCtx.createMediaStreamSource(stream).connect(analyser);
            const buffer = new Uint8Array(analyser.frequencyBinCount);

            intervalId = setInterval(() => {
              analyser.getByteTimeDomainData(buffer);
              let sum = 0;
              for (let i = 0; i < buffer.length; i++)
                sum += (buffer[i] - 128) ** 2;
              const rms = Math.min(Math.sqrt(sum / buffer.length) / 40, 1);
              peaksRef.current.push(Math.max(rms, 0.08));
              setLiveBars((prev) => [...prev.slice(1), Math.max(rms, 0.12)]);
            }, SAMPLE_INTERVAL_MS);
          }
        } catch {
          // التسجيل يعمل حتى لو لم يتوفر AudioContext للرسم.
        }

        const mimeType =
          typeof MediaRecorder.isTypeSupported === 'function'
            ? RECORDER_MIME_TYPES.find((type) =>
                MediaRecorder.isTypeSupported(type)
              )
            : undefined;
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          recordedBytesRef.current += event.data.size;
          if (recordedBytesRef.current > MAX_AUDIO_UPLOAD_BYTES) {
            cancelledRef.current = true;
            if (recorder.state !== 'inactive') recorder.stop();
            setError(t('err.voiceMax'));
            return;
          }
          chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          if (intervalId) clearInterval(intervalId);
          if (timerId) clearInterval(timerId);
          stream.getTracks().forEach((track) => track.stop());
          void audioCtxRef.current?.close().catch(() => undefined);
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
        timerId = setInterval(() => {
          const seconds = Math.floor((Date.now() - startRef.current) / 1000);
          setElapsed(seconds);
          if (
            seconds >= MAX_VOICE_DURATION_SECONDS &&
            recorder.state !== 'inactive'
          )
            recorder.stop();
        }, 500);
      } catch (startError) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        void audioCtxRef.current?.close().catch(() => undefined);
        if (!cancelledRef.current) setError(getMicrophoneError(startError));
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
      recorderRef.current = null;
      streamRef.current = null;
      audioCtxRef.current = null;
    };
    // onComplete/onCancel intentionally stay stable for one recorder session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryVersion]);

  const finish = (): void => {
    cancelledRef.current = false;
    if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
  };

  if (error)
    return (
      <div className='flex flex-1 flex-col gap-2 px-3 py-2'>
        <p className='text-xs leading-5 text-accent-red'>{error}</p>
        <div className='flex flex-wrap items-center justify-end gap-1'>
          <button
            type='button'
            onClick={() => setRetryVersion((version) => version + 1)}
            className='rounded-full bg-main-accent px-3 py-1.5 text-xs font-bold text-main-accent-contrast'
          >
            {t('common.retry')}
          </button>
          {isAndroidApp && (
            <button
              type='button'
              onClick={() =>
                window.location.assign('aite://settings/microphone')
              }
              className='rounded-full border border-light-border px-3 py-1.5 text-xs font-bold dark:border-dark-border'
            >
              الإعدادات
            </button>
          )}
          <button
            type='button'
            onClick={onCancel}
            className='custom-button dark-bg-tab p-2 hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
            aria-label={t('common.close')}
          >
            <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
          </button>
        </div>
      </div>
    );

  return (
    <div className='flex flex-1 items-center gap-2 px-2 py-1'>
      <button
        type='button'
        onClick={onCancel}
        aria-label={t('chat.deleteRec')}
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
        aria-label={t('chat.endRec')}
        className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   bg-main-accent text-main-accent-contrast transition hover:brightness-90 active:scale-90'
      >
        <HeroIcon className='h-5 w-5' iconName='CheckIcon' solid />
      </button>
    </div>
  );
}
