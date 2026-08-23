import { useState, useEffect, useRef, useCallback } from 'react';
import cn from 'clsx';
import { auth } from '@lib/firebase/app';
import { HeroIcon } from '@components/ui/hero-icon';
import type { MusicTrack } from '@pages/api/music';

type MusicSearchProps = {
  selected: { src: string; name: string } | null;
  onSelect: (track: { src: string; name: string } | null) => void;
};

export function MusicSearch({
  selected,
  onSelect
}: MusicSearchProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  const stopPreview = useCallback((): void => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setPlayingSrc(null);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      stopPreview();
    };
  }, [stopPreview]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current;

      void (async (): Promise<void> => {
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const response = await fetch(
            `/api/music?term=${encodeURIComponent(trimmed)}&limit=25`,
            {
              headers: idToken ? { Authorization: `Bearer ${idToken}` } : {}
            }
          );

          if (!response.ok) throw new Error('search failed');

          const data = (await response.json()) as { tracks: MusicTrack[] };

          // only apply if this is the latest request
          if (requestId === requestIdRef.current) {
            setResults(data.tracks);
            setLoading(false);
          }
        } catch {
          if (requestId === requestIdRef.current) {
            setError('تعذّر البحث عن الموسيقى. حاول مجددًا.');
            setLoading(false);
          }
        }
      })();
    }, 450);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const togglePreview = (track: MusicTrack): void => {
    if (playingSrc === track.src) {
      stopPreview();
      return;
    }
    stopPreview();
    const audio = new Audio(track.src);
    audioRef.current = audio;
    audio.volume = 0.7;
    void audio.play().catch(() => null);
    setPlayingSrc(track.src);
    audio.onended = () => setPlayingSrc(null);
  };

  const handleSelect = (track: MusicTrack): void => {
    if (selected?.src === track.src) {
      onSelect(null);
    } else {
      onSelect({ src: track.src, name: `${track.name} — ${track.artist}` });
    }
    stopPreview();
  };

  return (
    <div>
      <p className='mb-2 text-sm text-light-secondary dark:text-dark-secondary'>
        ابحث عن أي أغنية على الإنترنت وأضِفها
      </p>
      <input
        type='text'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='ابحث: اسم الأغنية أو المغني...'
        className='mb-2 w-full rounded-xl bg-light-line-reply/30 p-2 text-sm outline-none
                   dark:bg-dark-line-reply/30'
      />

      <div className='max-h-56 overflow-y-auto rounded-xl border border-light-border p-1 dark:border-dark-border'>
        {loading && (
          <p className='p-3 text-center text-sm text-light-secondary dark:text-dark-secondary'>
            جارٍ البحث...
          </p>
        )}

        {!loading && error && (
          <p className='p-3 text-center text-sm text-accent-red'>{error}</p>
        )}

        {!loading && !error && !query.trim() && (
          <p className='p-3 text-center text-sm text-light-secondary dark:text-dark-secondary'>
            ابدأ بالكتابة للبحث عن الأغاني
          </p>
        )}

        {!loading && !error && query.trim() && !results.length && (
          <p className='p-3 text-center text-sm text-light-secondary dark:text-dark-secondary'>
            لا توجد نتائج
          </p>
        )}

        {!loading &&
          !error &&
          results.map((track) => {
            const isSelected = selected?.src === track.src;
            const isPlaying = playingSrc === track.src;
            return (
              <div
                key={`${track.id}-${track.src}`}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-2 py-2 transition',
                  isSelected
                    ? 'bg-main-accent/20'
                    : 'hover:bg-light-primary/5 dark:hover:bg-dark-primary/5'
                )}
              >
                <button
                  type='button'
                  onClick={() => togglePreview(track)}
                  className='relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-light-line-reply dark:bg-dark-line-reply'
                  aria-label='تشغيل معاينة'
                >
                  {track.artwork ? (
                    <img
                      src={track.artwork}
                      alt={track.name}
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <HeroIcon className='h-5 w-5' iconName='MusicalNoteIcon' />
                  )}
                  <span className='absolute inset-0 flex items-center justify-center bg-black/40 text-white'>
                    <HeroIcon
                      className='h-5 w-5'
                      iconName={isPlaying ? 'PauseIcon' : 'PlayIcon'}
                    />
                  </span>
                </button>

                <button
                  type='button'
                  onClick={() => handleSelect(track)}
                  className='flex flex-1 flex-col text-right'
                >
                  <span
                    className={cn(
                      'truncate text-sm',
                      isSelected && 'font-bold text-main-accent-text'
                    )}
                  >
                    {track.name}
                  </span>
                  <span className='truncate text-xs text-light-secondary dark:text-dark-secondary'>
                    {track.artist}
                  </span>
                </button>

                {isSelected && (
                  <HeroIcon
                    className='h-5 w-5 shrink-0 text-main-accent-text'
                    iconName='CheckIcon'
                  />
                )}
              </div>
            );
          })}
      </div>

      {selected && (
        <div className='mt-2 flex items-center gap-2 text-sm text-main-accent-text'>
          <HeroIcon className='h-4 w-4' iconName='MusicalNoteIcon' />
          <span className='truncate'>{selected.name}</span>
          <button
            type='button'
            onClick={() => {
              onSelect(null);
              stopPreview();
            }}
            className='text-light-secondary hover:text-accent-red'
            aria-label='إزالة الموسيقى'
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
