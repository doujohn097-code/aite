import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { uploadStory } from '@lib/firebase/utils';
import { withTimeout } from '@lib/utils';
import { getImagesData } from '@lib/validation';
import { getRandomId } from '@lib/random';
import { HeroIcon } from '@components/ui/hero-icon';
import { MusicSearch } from './music-search';
import { MusicTrimmer } from './music-trimmer';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import type { StoryMusic, StoryText } from '@lib/types/story';

const TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#F91A82',
  '#FF3B30',
  '#FF9500',
  '#FFD500',
  '#00D68F',
  '#1D9BF0',
  '#7857FF'
];

const FONTS: Readonly<{ id: string; label: string; css: string }[]> = [
  { id: 'aite', label: 'الافتراضي', css: '"IBM Plex Sans Arabic", sans-serif' },
  { id: 'serif', label: 'كلاسيكي', css: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'آلة كاتبة', css: '"Courier New", monospace' },
  { id: 'script', label: 'مزخرف', css: '"Great Vibes", cursive' },
  { id: 'heavy', label: 'عريض', css: '"Arial Black", Impact, sans-serif' }
];

const fontCss = (id: string): string =>
  FONTS.find((font) => font.id === id)?.css ?? FONTS[0].css;

type Panel = 'none' | 'music' | 'text';

type StoryEditorProps = {
  open: boolean;
  closeModal: () => void;
};

/** محرّر القصص بملء الشاشة — معاينة + موسيقى مقتطعة + نصوص حرة */
export function StoryEditor({
  open,
  closeModal
}: StoryEditorProps): JSX.Element | null {
  const { user } = useAuth();

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);

  const [file, setFile] = useState<FilesWithId>([]);
  const [preview, setPreview] = useState<ImagesPreview>([]);
  const [duration, setDuration] = useState<Record<string, number>>({});

  const [panel, setPanel] = useState<Panel>('none');
  const [music, setMusic] = useState<StoryMusic | null>(null);
  const [texts, setTexts] = useState<StoryText[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const media = preview[0];
  const isVideo = !!media?.type?.startsWith('video/');
  const activeText = texts.find(({ id }) => id === activeTextId) ?? null;

  /* فتح منتقي الملفات فور فتح المحرّر */
  useEffect(() => {
    if (!open) return;

    setFile([]);
    setPreview([]);
    setDuration({});
    setMusic(null);
    setTexts([]);
    setActiveTextId(null);
    setPanel('none');
    setLoading(false);

    const timer = window.setTimeout(() => fileRef.current?.click(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* منع تمرير الصفحة خلف المحرّر */
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const imagesData = getImagesData(event.target.files, {
      allowUploadingVideos: true
    });

    if (!imagesData) {
      toast.error('يرجى اختيار صورة أو فيديو صالح');
      if (!preview.length) closeModal();
      return;
    }

    const [firstPreview] = imagesData.imagesPreviewData;
    const [firstFile] = imagesData.selectedImagesData;

    setPreview([firstPreview]);
    setFile([firstFile]);

    if (firstFile.type.startsWith('video/')) {
      const url = URL.createObjectURL(firstFile as File);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.src = url;
      video.onloadedmetadata = (): void => {
        setDuration({
          [firstFile.id]: Math.min(
            Math.round((video.duration || 15) * 1000),
            60_000
          )
        });
        URL.revokeObjectURL(url);
      };
    }
  };

  const addText = (): void => {
    const newText: StoryText = {
      id: getRandomId(),
      text: 'اكتب هنا',
      x: 0.5,
      y: 0.45,
      color: '#FFFFFF',
      font: 'aite',
      size: 0.06,
      background: false
    };

    setTexts((prev) => [...prev, newText]);
    setActiveTextId(newText.id);
    setPanel('text');
  };

  const updateText = (id: string, patch: Partial<StoryText>): void =>
    setTexts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );

  const removeText = (id: string): void => {
    setTexts((prev) => prev.filter((item) => item.id !== id));
    setActiveTextId(null);
    setPanel('none');
  };

  /* سحب النص فوق الوسائط */
  const startDrag =
    (id: string) =>
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      dragRef.current = { id, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
      setActiveTextId(id);
    };

  const onDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    const stage = stageRef.current;

    if (!drag || !stage || drag.pointerId !== event.pointerId) return;

    const { left, top, width, height } = stage.getBoundingClientRect();

    const x = Math.min(0.96, Math.max(0.04, (event.clientX - left) / width));
    const y = Math.min(0.96, Math.max(0.04, (event.clientY - top) / height));

    updateText(drag.id, { x, y });
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const publish = async (): Promise<void> => {
    if (!user || !file.length || loading) return;

    setLoading(true);

    try {
      const cleanTexts = texts
        .map((item) => ({ ...item, text: item.text.trim() }))
        .filter(({ text }) => text.length);

      await withTimeout(
        uploadStory(
          user.id,
          file,
          user.storyColor ?? '#3b82f6',
          null,
          duration,
          music,
          cleanTexts
        ),
        120_000
      );

      toast.success('تم نشر القصة');
      closeModal();
    } catch {
      toast.error('فشل نشر القصة');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      className='fixed inset-0 z-[60] flex h-app flex-col bg-black'
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <input
        ref={fileRef}
        type='file'
        accept='image/*,video/*'
        className='hidden'
        onChange={handleFile}
      />

      {/* الشريط العلوي */}
      <header className='pt-safe absolute inset-x-0 top-0 z-30 flex items-center justify-between px-3 py-3'>
        <button
          type='button'
          onClick={closeModal}
          aria-label='إغلاق'
          className='flex h-10 w-10 items-center justify-center rounded-full bg-black/45
                     text-white backdrop-blur-md transition active:scale-90'
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </button>

        {!!media && (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={(): void =>
                setPanel((prev) => (prev === 'music' ? 'none' : 'music'))
              }
              aria-label='إضافة موسيقى'
              className={cn(
                `flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md
                 transition active:scale-90`,
                music
                  ? 'bg-main-accent text-main-accent-contrast'
                  : 'bg-black/45 text-white'
              )}
            >
              <HeroIcon className='h-5 w-5' iconName='MusicalNoteIcon' />
            </button>
            <button
              type='button'
              onClick={addText}
              aria-label='إضافة نص'
              className='flex h-10 w-10 items-center justify-center rounded-full bg-black/45
                         text-base font-black text-white backdrop-blur-md transition active:scale-90'
            >
              Aa
            </button>
            <button
              type='button'
              onClick={(): void => fileRef.current?.click()}
              aria-label='تغيير الوسائط'
              className='flex h-10 w-10 items-center justify-center rounded-full bg-black/45
                         text-white backdrop-blur-md transition active:scale-90'
            >
              <HeroIcon className='h-5 w-5' iconName='PhotoIcon' />
            </button>
          </div>
        )}
      </header>

      {/* منصة المعاينة */}
      <div
        ref={stageRef}
        className='relative flex flex-1 items-center justify-center overflow-hidden'
        onPointerMove={onDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {media ? (
          isVideo ? (
            <video
              key={media.src}
              src={media.src}
              className='h-full w-full object-contain'
              autoPlay
              loop
              muted
              playsInline
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.src}
              alt='معاينة القصة'
              className='h-full w-full object-contain'
              draggable={false}
            />
          )
        ) : (
          <button
            type='button'
            onClick={(): void => fileRef.current?.click()}
            className='flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed
                       border-white/25 px-10 py-12 text-white/80 transition hover:bg-white/5'
          >
            <HeroIcon className='h-10 w-10' iconName='PhotoIcon' />
            <span className='font-bold'>اختر صورة أو فيديو</span>
          </button>
        )}

        {/* النصوص فوق الوسائط */}
        {texts.map((item) => (
          <div
            key={item.id}
            onPointerDown={startDrag(item.id)}
            onDoubleClick={(): void => {
              setActiveTextId(item.id);
              setPanel('text');
            }}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: item.color,
              fontFamily: fontCss(item.font),
              fontSize: `clamp(12px, ${item.size * 100}vh, 96px)`
            }}
            className={cn(
              `absolute max-w-[86%] cursor-move touch-none select-none whitespace-pre-wrap
               break-words px-2 text-center font-bold leading-tight
               drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]`,
              item.background &&
                'rounded-2xl bg-black/45 px-3 py-1 backdrop-blur-sm',
              activeTextId === item.id && 'ring-2 ring-white/70 ring-offset-0'
            )}
          >
            {item.text || ' '}
          </div>
        ))}
      </div>

      {/* الشريط السفلي */}
      {!!media && panel === 'none' && (
        <footer className='pb-safe absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 px-4 pb-4'>
          {music ? (
            <span className='flex min-w-0 items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-xs text-white backdrop-blur'>
              <HeroIcon className='h-4 w-4' iconName='MusicalNoteIcon' />
              <span className='truncate'>{music.name}</span>
            </span>
          ) : (
            <span />
          )}
          <button
            type='button'
            onClick={(): Promise<void> => publish()}
            disabled={loading}
            className='flex items-center gap-2 rounded-full bg-main-accent px-6 py-3 text-sm
                       font-bold text-main-accent-contrast shadow-xl transition
                       active:scale-95 disabled:opacity-60'
          >
            {loading ? (
              <HeroIcon
                className='h-5 w-5 animate-spin'
                iconName='ArrowPathIcon'
              />
            ) : (
              <HeroIcon className='h-5 w-5' iconName='PaperAirplaneIcon' />
            )}
            نشر القصة
          </button>
        </footer>
      )}

      {/* اللوحات السفلية */}
      <AnimatePresence>
        {panel === 'music' && (
          <motion.section
            key='music-panel'
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className='pb-safe absolute inset-x-0 bottom-0 z-40 max-h-[70%] overflow-y-auto
                       rounded-t-3xl bg-[#111]/95 p-4 text-white backdrop-blur-2xl'
          >
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='font-bold'>الموسيقى</h3>
              <button
                type='button'
                onClick={(): void => setPanel('none')}
                aria-label='إغلاق'
                className='flex h-8 w-8 items-center justify-center rounded-full bg-white/10'
              >
                <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
              </button>
            </div>

            {music ? (
              <div className='flex flex-col gap-4'>
                <MusicTrimmer
                  src={music.src}
                  name={music.name}
                  start={music.start ?? 0}
                  onChange={(start): void =>
                    setMusic((prev) => (prev ? { ...prev, start } : prev))
                  }
                  onRemove={(): void => setMusic(null)}
                />
                <button
                  type='button'
                  onClick={(): void => setPanel('none')}
                  className='rounded-full bg-main-accent py-2.5 font-bold text-main-accent-contrast'
                >
                  تم
                </button>
              </div>
            ) : (
              <div className='[&_input]:text-white'>
                <MusicSearch
                  selected={null}
                  onSelect={(track): void =>
                    setMusic(track ? { ...track, start: 0, clip: 15 } : null)
                  }
                />
              </div>
            )}
          </motion.section>
        )}

        {panel === 'text' && activeText && (
          <motion.section
            key='text-panel'
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className='pb-safe absolute inset-x-0 bottom-0 z-40 rounded-t-3xl bg-[#111]/95 p-4
                       text-white backdrop-blur-2xl'
          >
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='font-bold'>النص</h3>
              <div className='flex items-center gap-2'>
                <button
                  type='button'
                  onClick={(): void => removeText(activeText.id)}
                  aria-label='حذف النص'
                  className='flex h-8 w-8 items-center justify-center rounded-full bg-accent-red/20 text-accent-red'
                >
                  <HeroIcon className='h-4 w-4' iconName='TrashIcon' />
                </button>
                <button
                  type='button'
                  onClick={(): void => setPanel('none')}
                  className='rounded-full bg-main-accent px-4 py-1.5 text-sm font-bold text-main-accent-contrast'
                >
                  تم
                </button>
              </div>
            </div>

            <textarea
              value={activeText.text}
              onChange={(event): void =>
                updateText(activeText.id, { text: event.target.value })
              }
              rows={2}
              autoFocus
              placeholder='اكتب نصك…'
              style={{
                fontFamily: fontCss(activeText.font),
                color: activeText.color
              }}
              className='mb-3 w-full resize-none rounded-2xl bg-white/10 p-3 text-lg font-bold
                         outline-none ring-1 ring-white/15 placeholder:text-white/40'
            />

            {/* الخطوط */}
            <div className='mb-3 flex gap-2 overflow-x-auto pb-1'>
              {FONTS.map(({ id, label, css }) => (
                <button
                  key={id}
                  type='button'
                  onClick={(): void => updateText(activeText.id, { font: id })}
                  style={{ fontFamily: css }}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-1.5 text-sm transition',
                    activeText.font === id
                      ? 'bg-white text-black'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* الألوان */}
            <div className='mb-3 flex gap-2 overflow-x-auto pb-1'>
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type='button'
                  onClick={(): void => updateText(activeText.id, { color })}
                  aria-label={`اللون ${color}`}
                  style={{ backgroundColor: color }}
                  className={cn(
                    'h-8 w-8 shrink-0 rounded-full ring-2 transition',
                    activeText.color === color
                      ? 'scale-110 ring-white'
                      : 'ring-white/25'
                  )}
                />
              ))}
              <button
                type='button'
                onClick={(): void =>
                  updateText(activeText.id, {
                    background: !activeText.background
                  })
                }
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition',
                  activeText.background
                    ? 'bg-white text-black'
                    : 'bg-white/10 text-white'
                )}
              >
                خلفية
              </button>
            </div>

            {/* الحجم */}
            <div className='flex items-center gap-3'>
              <HeroIcon className='h-4 w-4 shrink-0' iconName='MinusIcon' />
              <input
                type='range'
                min={2}
                max={16}
                step={0.5}
                value={activeText.size * 100}
                onChange={(event): void =>
                  updateText(activeText.id, {
                    size: Number(event.target.value) / 100
                  })
                }
                className='h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25
                           [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
                           [&::-webkit-slider-thumb]:bg-white'
              />
              <HeroIcon className='h-5 w-5 shrink-0' iconName='PlusIcon' />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
