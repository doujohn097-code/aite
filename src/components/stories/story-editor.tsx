import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useLanguage } from '@lib/context/language-context';
import { TEXT_FONTS, fontCss as sharedFontCss } from '@lib/text-fonts';
import { FontPicker } from '@components/input/font-picker';

const TEXT_COLORS = [
  '#FFFFFF',
  '#000000',
  '#F91A82',
  '#FF3B30',
  '#FF9500',
  '#FFD500',
  '#00D68F',
  '#1D9BF0',
  '#7857FF',
  '#8B5E3C'
];

const RING_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#d946ef',
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ffffff',
  '#000000'
];

/** الاسم المعروض يُكتب بنفس الخط ليكون معاينة حقيقية */
export const STORY_FONTS = TEXT_FONTS;

export const fontCss = (id: string): string => sharedFontCss(id);

const MIN_SIZE = 0.02;
const MAX_SIZE = 0.2;

type Panel = 'none' | 'music' | 'text' | 'color';

type Gesture =
  | {
      kind: 'drag';
      id: string;
      pointerId: number;
      dx: number;
      dy: number;
    }
  | {
      kind: 'resize';
      id: string;
      pointerId: number;
      baseSize: number;
      baseDistance: number;
    }
  | {
      kind: 'pinch';
      id: string;
      pointers: [number, number];
      baseSize: number;
      baseDistance: number;
    };

type StoryEditorProps = {
  open: boolean;
  closeModal: () => void;
};

/** محرّر القصص بملء الشاشة — معاينة + موسيقى مقتطعة + نصوص حرة */
export function StoryEditor({
  open,
  closeModal
}: StoryEditorProps): JSX.Element | null {
  const { t } = useLanguage();

  const { user } = useAuth();

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pickerOpenedRef = useRef(false);

  const [file, setFile] = useState<FilesWithId>([]);
  const [preview, setPreview] = useState<ImagesPreview>([]);
  const [duration, setDuration] = useState<Record<string, number>>({});

  const [panel, setPanel] = useState<Panel>('none');
  const [music, setMusic] = useState<
    (StoryMusic & { fullDuration?: number | null }) | null
  >(null);
  const [ringColor, setRingColor] = useState('#3b82f6');
  const [texts, setTexts] = useState<StoryText[]>([]);
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const media = preview[0];
  const isVideo = !!media?.type?.startsWith('video/');
  const activeText = texts.find(({ id }) => id === activeTextId) ?? null;

  /* تهيئة عند الفتح — يُفتح منتقي الملفات مرة واحدة فقط */
  useEffect(() => {
    if (!open) {
      pickerOpenedRef.current = false;
      return;
    }

    setFile([]);
    setPreview([]);
    setDuration({});
    setMusic(null);
    setTexts([]);
    setActiveTextId(null);
    setPanel('none');
    setLoading(false);
    setRingColor(user?.storyColor ?? '#3b82f6');

    if (pickerOpenedRef.current) return;

    pickerOpenedRef.current = true;
    const timer = window.setTimeout(() => fileRef.current?.click(), 150);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const updateText = useCallback(
    (id: string, patch: Partial<StoryText>): void =>
      setTexts((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      ),
    []
  );

  /* إيماءات النص: سحب بإصبع، تكبير/تصغير بإصبعين أو من المقبض */
  useEffect(() => {
    const onMove = (event: PointerEvent): void => {
      const gesture = gestureRef.current;
      const stage = stageRef.current;

      if (!gesture || !stage) return;

      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });

      const { left, top, width, height } = stage.getBoundingClientRect();

      if (gesture.kind === 'drag') {
        if (gesture.pointerId !== event.pointerId) return;

        const x = (event.clientX - left - gesture.dx) / width;
        const y = (event.clientY - top - gesture.dy) / height;

        updateText(gesture.id, {
          x: Math.min(0.97, Math.max(0.03, x)),
          y: Math.min(0.97, Math.max(0.03, y))
        });

        return;
      }

      if (gesture.kind === 'resize') {
        if (gesture.pointerId !== event.pointerId) return;

        const text = document.getElementById(`story-text-${gesture.id}`);
        if (!text) return;

        const box = text.getBoundingClientRect();
        const centerX = box.left + box.width / 2;
        const centerY = box.top + box.height / 2;

        const distance = Math.hypot(
          event.clientX - centerX,
          event.clientY - centerY
        );

        const size =
          (gesture.baseSize * distance) / Math.max(12, gesture.baseDistance);

        updateText(gesture.id, {
          size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
        });

        return;
      }

      // pinch
      const [first, second] = gesture.pointers;
      const a = pointersRef.current.get(first);
      const b = pointersRef.current.get(second);

      if (!a || !b) return;

      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const size =
        (gesture.baseSize * distance) / Math.max(12, gesture.baseDistance);

      updateText(gesture.id, {
        size: Math.min(MAX_SIZE, Math.max(MIN_SIZE, size))
      });
    };

    const onUp = (event: PointerEvent): void => {
      pointersRef.current.delete(event.pointerId);

      const gesture = gestureRef.current;
      if (!gesture) return;

      if (gesture.kind === 'pinch') {
        if (pointersRef.current.size < 2) gestureRef.current = null;
        return;
      }

      if (gesture.pointerId === event.pointerId) gestureRef.current = null;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [updateText]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const { files } = event.target;

    // إلغاء الاختيار: لا نفتح المنتقي مجددًا ولا نغلق إن كان هناك محتوى
    if (!files?.length) {
      if (!preview.length) closeModal();
      return;
    }

    const imagesData = getImagesData(files, { allowUploadingVideos: true });

    if (!imagesData) {
      toast.error(t('stories.invalidMedia'));
      return;
    }

    const [firstPreview] = imagesData.imagesPreviewData;
    const [firstFile] = imagesData.selectedImagesData;

    setPreview([firstPreview]);
    setFile([firstFile]);

    // نظّف قيمة الحقل حتى يمكن اختيار نفس الملف مجددًا لاحقًا
    event.target.value = '';

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
      text: t('stories.writeHere'),
      x: 0.5,
      y: 0.42,
      color: '#FFFFFF',
      font: 'aite',
      size: 0.06,
      background: false
    };

    setTexts((prev) => [...prev, newText]);
    setActiveTextId(newText.id);
    setPanel('text');
  };

  const removeText = (id: string): void => {
    setTexts((prev) => prev.filter((item) => item.id !== id));
    setActiveTextId(null);
    setPanel('none');
  };

  const startTextGesture =
    (item: StoryText) =>
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
      });

      setActiveTextId(item.id);

      const current = gestureRef.current;

      // إصبع ثانٍ على نفس النص → تكبير/تصغير
      if (
        current &&
        current.kind === 'drag' &&
        current.id === item.id &&
        pointersRef.current.size >= 2
      ) {
        const a = pointersRef.current.get(current.pointerId);
        const b = { x: event.clientX, y: event.clientY };

        if (a) {
          gestureRef.current = {
            kind: 'pinch',
            id: item.id,
            pointers: [current.pointerId, event.pointerId],
            baseSize: item.size,
            baseDistance: Math.max(12, Math.hypot(a.x - b.x, a.y - b.y))
          };
        }

        return;
      }

      const box = event.currentTarget.getBoundingClientRect();

      gestureRef.current = {
        kind: 'drag',
        id: item.id,
        pointerId: event.pointerId,
        dx: event.clientX - (box.left + box.width / 2),
        dy: event.clientY - (box.top + box.height / 2)
      };
    };

  const startResize =
    (item: StoryText) =>
    (event: ReactPointerEvent<HTMLButtonElement>): void => {
      event.stopPropagation();

      const text = document.getElementById(`story-text-${item.id}`);
      if (!text) return;

      const box = text.getBoundingClientRect();

      gestureRef.current = {
        kind: 'resize',
        id: item.id,
        pointerId: event.pointerId,
        baseSize: item.size,
        baseDistance: Math.max(
          12,
          Math.hypot(
            event.clientX - (box.left + box.width / 2),
            event.clientY - (box.top + box.height / 2)
          )
        )
      };
    };

  const publish = async (): Promise<void> => {
    if (!user || !file.length || loading) return;

    setLoading(true);

    try {
      const cleanTexts = texts
        .map((item) => ({ ...item, text: item.text.trim() }))
        .filter(({ text }) => text.length);

      const storyMusic: StoryMusic | null = music
        ? {
            src: music.src,
            name: music.name,
            start: music.start ?? 0,
            clip: 15
          }
        : null;

      await withTimeout(
        uploadStory(
          user.id,
          file,
          ringColor,
          null,
          duration,
          storyMusic,
          cleanTexts
        ),
        120_000
      );

      toast.success(t('stories.published'));
      closeModal();
    } catch {
      toast.error(t('stories.publishFail'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const toolbarHidden = panel !== 'none';

  return (
    <motion.div
      className='fixed inset-0 z-[60] flex h-app flex-col overflow-hidden bg-black'
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

      {/* زر الإغلاق */}
      <button
        type='button'
        onClick={closeModal}
        aria-label={t('common.close')}
        className='pt-safe absolute right-3 top-3 z-40 flex h-10 w-10 items-center
                   justify-center rounded-full bg-black/50 text-white backdrop-blur-md
                   transition active:scale-90'
      >
        <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
      </button>

      {/* شريط الأدوات العمودي — لا يحجب المحتوى */}
      {!!media && !toolbarHidden && (
        <div className='absolute left-3 top-16 z-40 flex flex-col gap-2.5'>
          <ToolButton
            label={t('stories.music')}
            active={!!music}
            onClick={(): void => setPanel('music')}
          >
            <HeroIcon className='h-5 w-5' iconName='MusicalNoteIcon' />
          </ToolButton>
          <ToolButton label={t('stories.text')} onClick={addText}>
            <span className='text-base font-black leading-none'>Aa</span>
          </ToolButton>
          <ToolButton
            label={t('stories.storyColor')}
            onClick={(): void => setPanel('color')}
          >
            <span
              className='h-5 w-5 rounded-full ring-2 ring-white/70'
              style={{ backgroundColor: ringColor }}
            />
          </ToolButton>
          <ToolButton
            label={t('stories.changeMedia')}
            onClick={(): void => fileRef.current?.click()}
          >
            <HeroIcon className='h-5 w-5' iconName='PhotoIcon' />
          </ToolButton>
        </div>
      )}

      {/* منصة المعاينة */}
      <div
        ref={stageRef}
        className='relative flex flex-1 items-center justify-center overflow-hidden'
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
              alt={t('stories.preview')}
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
            <span className='font-bold'>{t('stories.pickMedia')}</span>
          </button>
        )}

        {/* النصوص */}
        {texts.map((item) => {
          const isActive = activeTextId === item.id;

          return (
            <div
              key={item.id}
              id={`story-text-${item.id}`}
              onPointerDown={startTextGesture(item)}
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
                fontSize: `clamp(10px, ${item.size * 100}vh, 140px)`
              }}
              dir='auto'
              className={cn(
                `user-text absolute max-w-[88%] cursor-move touch-none select-none whitespace-pre-wrap
                 break-words px-2 text-center font-bold leading-tight
                 drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)]`,
                item.background &&
                  'rounded-2xl bg-black/45 px-3 py-1 backdrop-blur-sm',
                isActive &&
                  'rounded-xl outline-dashed outline-1 outline-white/70'
              )}
            >
              {item.text || ' '}

              {isActive && (
                <button
                  type='button'
                  aria-label={t('stories.resize')}
                  onPointerDown={startResize(item)}
                  className='absolute -bottom-3 -left-3 flex h-7 w-7 touch-none items-center
                             justify-center rounded-full bg-white text-black shadow-lg'
                >
                  <HeroIcon
                    className='h-4 w-4'
                    iconName='ArrowsPointingOutIcon'
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* الشريط السفلي */}
      {!!media && panel === 'none' && (
        <footer className='pb-safe absolute inset-x-0 bottom-0 z-40 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10'>
          {music ? (
            <button
              type='button'
              onClick={(): void => setPanel('music')}
              className='flex min-w-0 max-w-[45%] items-center gap-1.5 rounded-full bg-black/60
                         px-3 py-2 text-xs text-white backdrop-blur'
            >
              <HeroIcon
                className='h-4 w-4 shrink-0'
                iconName='MusicalNoteIcon'
              />
              <span className='truncate'>{music.name}</span>
            </button>
          ) : (
            <span />
          )}
          <button
            type='button'
            onClick={(): Promise<void> => publish()}
            disabled={loading}
            className='flex shrink-0 items-center gap-2 rounded-full bg-main-accent px-6 py-3
                       text-sm font-bold text-main-accent-contrast shadow-xl transition
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
            {t('stories.publish')}
          </button>
        </footer>
      )}

      {/* اللوحات السفلية */}
      <AnimatePresence>
        {panel === 'music' && (
          <Sheet
            key='music'
            title={t('stories.music')}
            onClose={(): void => setPanel('none')}
          >
            {music ? (
              <div className='flex flex-col gap-4'>
                <MusicTrimmer
                  src={music.src}
                  name={music.name}
                  start={music.start ?? 0}
                  fullDuration={music.fullDuration ?? null}
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
                  {t('stories.done')}
                </button>
              </div>
            ) : (
              <MusicSearch
                selected={null}
                onSelect={(track): void =>
                  setMusic(track ? { ...track, start: 0, clip: 15 } : null)
                }
              />
            )}
          </Sheet>
        )}

        {panel === 'color' && (
          <Sheet
            key='color'
            title={t('stories.storyColor')}
            onClose={(): void => setPanel('none')}
          >
            <div
              className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full p-[3px]'
              style={{ backgroundColor: ringColor }}
            >
              <div className='h-full w-full rounded-full bg-black' />
            </div>
            <div className='flex flex-wrap gap-3 pb-2'>
              {RING_COLORS.map((color) => (
                <button
                  key={color}
                  type='button'
                  onClick={(): void => setRingColor(color)}
                  aria-label={`اللون ${color}`}
                  style={{ backgroundColor: color }}
                  className={cn(
                    'h-10 w-10 rounded-full ring-2 transition',
                    ringColor === color
                      ? 'scale-110 ring-white'
                      : 'ring-white/25'
                  )}
                />
              ))}
            </div>
            <p className='mb-3 text-xs text-white/50'>
              {t('stories.colorRing')}
            </p>
            <button
              type='button'
              onClick={(): void => setPanel('none')}
              className='w-full rounded-full bg-main-accent py-2.5 font-bold text-main-accent-contrast'
            >
              {t('stories.done')}
            </button>
          </Sheet>
        )}

        {panel === 'text' && activeText && (
          <Sheet
            key='text'
            title={t('stories.text')}
            onClose={(): void => setPanel('none')}
            actions={
              <button
                type='button'
                onClick={(): void => removeText(activeText.id)}
                aria-label={t('stories.deleteText')}
                className='flex h-8 w-8 items-center justify-center rounded-full bg-accent-red/20 text-accent-red'
              >
                <HeroIcon className='h-4 w-4' iconName='TrashIcon' />
              </button>
            }
          >
            <textarea
              value={activeText.text}
              onChange={(event): void =>
                updateText(activeText.id, { text: event.target.value })
              }
              rows={2}
              autoFocus
              placeholder={t('stories.writeText')}
              dir='auto'
              style={{
                fontFamily: fontCss(activeText.font),
                color: activeText.color
              }}
              className='user-text mb-3 w-full resize-none rounded-2xl bg-white/10 p-3 text-lg font-bold
                         outline-none ring-1 ring-white/15 placeholder:text-white/40'
            />

            <div className='mb-3'>
              <FontPicker
                dark
                compact
                value={activeText.font}
                onChange={(id): void => updateText(activeText.id, { font: id })}
              />
            </div>

            {/* الألوان */}
            <div className='flex items-center gap-2 overflow-x-auto pb-1'>
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
                {t('stories.bg')}
              </button>
            </div>

            <p className='mt-3 text-center text-[11px] text-white/50'>
              {t('stories.pinchHint')}
            </p>
          </Sheet>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type ToolButtonProps = {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolButton({
  label,
  active,
  onClick,
  children
}: ToolButtonProps): JSX.Element {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={label}
      className={cn(
        `flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md
         transition active:scale-90`,
        active
          ? 'bg-main-accent text-main-accent-contrast'
          : 'bg-black/50 text-white'
      )}
    >
      {children}
    </button>
  );
}

type SheetProps = {
  title: string;
  onClose: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

function Sheet({ title, onClose, actions, children }: SheetProps): JSX.Element {
  const { t } = useLanguage();
  return (
    <motion.section
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      className='pb-safe absolute inset-x-0 bottom-0 z-50 max-h-[78%] overflow-y-auto
                 rounded-t-3xl bg-[#111]/95 p-4 text-white backdrop-blur-2xl'
    >
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='font-bold'>{title}</h3>
        <div className='flex items-center gap-2'>
          {actions}
          <button
            type='button'
            onClick={onClose}
            aria-label={t('common.close')}
            className='flex h-8 w-8 items-center justify-center rounded-full bg-white/10'
          >
            <HeroIcon className='h-4 w-4' iconName='ChevronDownIcon' />
          </button>
        </div>
      </div>
      {children}
    </motion.section>
  );
}
