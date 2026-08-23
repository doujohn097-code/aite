import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { completeOnboarding, uploadImages } from '@lib/firebase/utils';
import { getImagesData } from '@lib/validation';
import { Modal } from '@components/modal/modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { NextImage } from '@components/ui/next-image';
import type { ChangeEvent } from 'react';
import type { FilesWithId } from '@lib/types/file';

type Gender = 'male' | 'female';

const genderOptions: Readonly<
  { value: Gender; label: string; icon: string; classes: string }[]
> = [
  {
    value: 'male',
    label: 'ذكر',
    icon: '♂',
    classes:
      'text-[#1D9BF0] ring-[#1D9BF0]/40 bg-[#1D9BF0]/10 hover:bg-[#1D9BF0]/15'
  },
  {
    value: 'female',
    label: 'أنثى',
    icon: '♀',
    classes:
      'text-[#F91A82] ring-[#F91A82]/40 bg-[#F91A82]/10 hover:bg-[#F91A82]/15'
  }
];

/**
 * نافذة الإعداد الأولى بعد إنشاء الحساب:
 * صورة الملف الشخصي + صورة الغلاف + اختيار الجنس (بادج ملوّن).
 */
export function OnboardingModal(): JSX.Element | null {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [avatarFiles, setAvatarFiles] = useState<FilesWithId>([]);
  const [coverFiles, setCoverFiles] = useState<FilesWithId>([]);

  useEffect(() => {
    if (user && !user.onboarded) setOpen(true);
  }, [user?.id, user?.onboarded]);

  if (!user) return null;

  const pickImage =
    (type: 'avatar' | 'cover') =>
    ({ target: { files } }: ChangeEvent<HTMLInputElement>): void => {
      const imagesData = getImagesData(files);

      if (!imagesData) {
        toast.error('يرجى اختيار صورة صالحة');
        return;
      }

      const { imagesPreviewData, selectedImagesData } = imagesData;

      if (type === 'avatar') {
        setAvatarPreview(imagesPreviewData[0].src);
        setAvatarFiles(selectedImagesData);
      } else {
        setCoverPreview(imagesPreviewData[0].src);
        setCoverFiles(selectedImagesData);
      }
    };

  const finish = async (skip = false): Promise<void> => {
    if (loading) return;

    setLoading(true);

    try {
      const data: {
        photoURL?: string;
        coverPhotoURL?: string | null;
        gender?: Gender | null;
      } = {};

      if (!skip) {
        if (avatarFiles.length) {
          const uploaded = await uploadImages(user.id, avatarFiles);
          if (uploaded?.[0]) data.photoURL = uploaded[0].src;
        }

        if (coverFiles.length) {
          const uploaded = await uploadImages(user.id, coverFiles);
          if (uploaded?.[0]) data.coverPhotoURL = uploaded[0].src;
        }

        if (gender) data.gender = gender;
      }

      await completeOnboarding(user.id, data);

      setOpen(false);

      if (!skip) toast.success('تم إعداد ملفك الشخصي 🎉');
    } catch {
      toast.error('تعذر حفظ البيانات — حاول مجددًا');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      modalClassName='w-full max-w-md overflow-hidden rounded-3xl bg-main-background shadow-2xl'
      open={open}
      closeModal={(): void => undefined}
    >
      <div className='flex flex-col'>
        {/* الغلاف */}
        <div className='relative h-32 w-full overflow-hidden bg-gradient-to-tr from-main-accent/40 via-main-accent/20 to-main-accent/5'>
          {coverPreview && (
            <NextImage
              layout='fill'
              imgClassName='object-cover'
              src={coverPreview}
              alt='الغلاف'
            />
          )}
          <label
            className='absolute inset-0 flex cursor-pointer items-center justify-center
                       bg-black/25 text-white opacity-0 transition hover:opacity-100'
          >
            <input
              className='hidden'
              type='file'
              accept='image/*'
              onChange={pickImage('cover')}
            />
            <span className='flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold backdrop-blur'>
              <HeroIcon className='h-4 w-4' iconName='PhotoIcon' />
              تغيير الغلاف
            </span>
          </label>
          {!coverPreview && (
            <span className='pointer-events-none absolute bottom-2 left-3 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur'>
              اضغط لاختيار غلاف
            </span>
          )}
        </div>

        <div className='px-6 pb-6'>
          {/* الأفاتار */}
          <div className='-mt-12 mb-4 flex items-end justify-between'>
            <label className='group relative cursor-pointer'>
              <input
                className='hidden'
                type='file'
                accept='image/*'
                onChange={pickImage('avatar')}
              />
              <span className='block rounded-full bg-main-background p-1 shadow-lg'>
                <span className='relative block h-24 w-24 overflow-hidden rounded-full bg-main-search-background'>
                  <NextImage
                    layout='fill'
                    imgClassName='object-cover'
                    src={avatarPreview ?? user.photoURL}
                    alt={user.name}
                  />
                  <span
                    className='absolute inset-0 flex items-center justify-center bg-black/40
                               text-white opacity-0 transition group-hover:opacity-100'
                  >
                    <HeroIcon className='h-6 w-6' iconName='CameraIcon' />
                  </span>
                </span>
              </span>
            </label>
          </div>

          <div className='mb-5 flex flex-col gap-1'>
            <h2 className='text-xl font-bold'>أهلًا بك في Aite 👋</h2>
            <p className='text-sm text-light-secondary dark:text-dark-secondary'>
              أضِف صورتك وغلافك واختر البادج الذي يظهر بجانب اسمك.
            </p>
          </div>

          {/* الجنس */}
          <p className='mb-2 text-sm font-bold text-light-secondary dark:text-dark-secondary'>
            البادج بجانب الاسم
          </p>
          <div className='mb-6 grid grid-cols-2 gap-3'>
            {genderOptions.map(({ value, label, icon, classes }) => {
              const active = gender === value;

              return (
                <button
                  key={value}
                  type='button'
                  onClick={(): void => setGender(active ? null : value)}
                  className={cn(
                    `relative flex flex-col items-center gap-2 rounded-2xl p-4 ring-1
                     transition duration-200 active:scale-[0.97]`,
                    classes,
                    active ? 'ring-2' : 'ring-inset'
                  )}
                >
                  <span className='text-3xl leading-none'>{icon}</span>
                  <span className='text-sm font-bold'>{label}</span>
                  {active && (
                    <motion.span
                      layoutId='gender-check'
                      className='absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-current'
                    >
                      <HeroIcon
                        className='h-3.5 w-3.5 text-main-background'
                        iconName='CheckIcon'
                        solid
                      />
                    </motion.span>
                  )}
                </button>
              );
            })}
          </div>

          <div className='flex flex-col gap-2'>
            <Button
              className='bg-main-accent py-2.5 font-bold text-main-accent-contrast
                         transition hover:brightness-90 active:brightness-75'
              loading={loading}
              disabled={loading}
              onClick={(): Promise<void> => finish(false)}
            >
              حفظ ومتابعة
            </Button>
            <Button
              className='py-2 text-sm font-bold text-light-secondary transition
                         hover:bg-light-primary/10 dark:text-dark-secondary
                         dark:hover:bg-dark-primary/10'
              disabled={loading}
              onClick={(): Promise<void> => finish(true)}
            >
              تخطٍ الآن
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
