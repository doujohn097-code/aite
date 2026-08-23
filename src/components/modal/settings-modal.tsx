import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { useAuth } from '@lib/context/auth-context';
import { useTheme } from '@lib/context/theme-context';
import { auth } from '@lib/firebase/app';
import { usernameToInternalEmail } from '@lib/utils';
import { saveAccount, removeSavedAccount } from '@lib/accounts';
import { themesMeta } from '@lib/types/theme';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { InputField } from '@components/input/input-field';
import { ThemePicker } from '@components/input/theme-picker';
import { InputAccentRadio } from '@components/input/input-accent-radio';
import type { Accent } from '@lib/types/theme';
import type { ChangeEvent, FormEvent } from 'react';
import type { User } from '@lib/types/user';

type SettingsView = 'main' | 'password' | 'delete' | 'appearance';

const accents: Readonly<Accent[]> = [
  'blue',
  'yellow',
  'pink',
  'purple',
  'orange',
  'green'
];

type SettingsModalProps = {
  closeModal: () => void;
};

export function SettingsModal({ closeModal }: SettingsModalProps): JSX.Element {
  const { user, signOut } = useAuth();
  const { theme } = useTheme();
  const { username, name, photoURL } = user as User;

  const [view, setView] = useState<SettingsView>('main');
  const [loading, setLoading] = useState(false);

  // تغيير كلمة المرور
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // حذف الحساب
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const resetForms = (): void => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setDeletePassword('');
    setDeleteConfirmText('');
  };

  const goBack = (): void => {
    resetForms();
    setView('main');
  };

  const reauthenticate = async (password: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
    const credential = EmailAuthProvider.credential(
      usernameToInternalEmail(username),
      password
    );
    await reauthenticateWithCredential(currentUser, credential);
  };

  const handleChangePassword = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (loading) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('كلمة المرور الجديدة ضعيفة (6 أحرف على الأقل)');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('كلمتا المرور غير متطابقتين');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('كلمة المرور الجديدة مطابقة للحالية');
      return;
    }

    setLoading(true);
    try {
      await reauthenticate(currentPassword);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('انتهت الجلسة');
      await updatePassword(currentUser, newPassword);

      // تحديث الحساب المحفوظ محليًا للتبديل السريع
      try {
        saveAccount({
          username,
          password: newPassword,
          name: name ?? username,
          photoURL: photoURL ?? null
        });
      } catch {
        // لا يؤثر على العملية
      }

      toast.success('تم تغيير كلمة المرور بنجاح');
      resetForms();
      closeModal();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        toast.error('كلمة المرور الحالية غير صحيحة');
      else if (code === 'auth/too-many-requests')
        toast.error('محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا');
      else if (code === 'auth/weak-password')
        toast.error('كلمة المرور الجديدة ضعيفة');
      else
        toast.error(
          err instanceof Error && !code ? err.message : 'تعذر تغيير كلمة المرور'
        );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (loading) return;

    if (!deletePassword) {
      toast.error('أدخل كلمة المرور للتأكيد');
      return;
    }
    if (deleteConfirmText.trim() !== 'حذف') {
      toast.error("اكتب كلمة 'حذف' للتأكيد");
      return;
    }

    setLoading(true);
    try {
      await reauthenticate(deletePassword);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('انتهت الجلسة');

      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? 'تعذر حذف الحساب');
      }

      try {
        removeSavedAccount(username);
      } catch {
        // لا يؤثر
      }

      toast.success('تم حذف الحساب نهائيًا');
      closeModal();
      await signOut();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        toast.error('كلمة المرور غير صحيحة');
      else if (code === 'auth/too-many-requests')
        toast.error('محاولات كثيرة — انتظر قليلًا ثم حاول مجددًا');
      else
        toast.error(
          err instanceof Error && !code ? err.message : 'تعذر حذف الحساب'
        );
    } finally {
      setLoading(false);
    }
  };

  const inputHandler =
    (setter: (value: string) => void) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
      setter(e.target.value);

  return (
    <div className='flex flex-col gap-1'>
      {/* الرأس */}
      <div className='mb-2 flex items-center gap-3'>
        {view !== 'main' && (
          <button
            type='button'
            onClick={goBack}
            aria-label='رجوع'
            className='flex h-8 w-8 items-center justify-center rounded-full transition
                       hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
          >
            <HeroIcon className='h-5 w-5' iconName='ArrowRightIcon' />
          </button>
        )}
        <h2 className='text-xl font-bold'>
          {view === 'main' && 'الإعدادات'}
          {view === 'password' && 'تغيير كلمة المرور'}
          {view === 'appearance' && 'المظهر'}
          {view === 'delete' && 'حذف الحساب'}
        </h2>
      </div>

      {view === 'main' && (
        <div className='flex flex-col gap-1'>
          <button
            type='button'
            onClick={(): void => setView('password')}
            className='flex items-center justify-between rounded-xl p-3.5 text-start transition
                       hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          >
            <div className='flex items-center gap-3'>
              <HeroIcon
                className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                iconName='KeyIcon'
              />
              <div>
                <p className='font-semibold'>تغيير كلمة المرور</p>
                <p className='text-xs text-light-secondary dark:text-dark-secondary'>
                  حدّث كلمة مرور حسابك
                </p>
              </div>
            </div>
            <HeroIcon
              className='h-4 w-4 text-light-secondary dark:text-dark-secondary'
              iconName='ChevronLeftIcon'
            />
          </button>

          <button
            type='button'
            onClick={(): void => setView('appearance')}
            className='flex items-center justify-between rounded-xl p-3.5 text-start transition
                       hover:bg-light-primary/10 active:bg-light-primary/20
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          >
            <div className='flex items-center gap-3'>
              <HeroIcon
                className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                iconName='SwatchIcon'
              />
              <div>
                <p className='font-semibold'>المظهر والخلفية</p>
                <p className='text-xs text-light-secondary dark:text-dark-secondary'>
                  {themesMeta[theme].label} · {themesMeta[theme].description}
                </p>
              </div>
            </div>
            <span
              className='h-7 w-7 shrink-0 rounded-full ring-2 ring-main-accent/40'
              style={{
                background: themesMeta[theme].preview,
                ...(themesMeta[theme].thumbnail && {
                  backgroundImage: `url('${
                    themesMeta[theme].thumbnail ?? ''
                  }')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                })
              }}
            />
          </button>

          <div className='my-1 border-t border-light-border dark:border-dark-border' />

          <button
            type='button'
            onClick={(): void => setView('delete')}
            className='flex items-center justify-between rounded-xl p-3.5 text-start transition
                       hover:bg-accent-red/10 active:bg-accent-red/20'
          >
            <div className='flex items-center gap-3'>
              <HeroIcon
                className='h-5 w-5 text-accent-red'
                iconName='TrashIcon'
              />
              <div>
                <p className='font-semibold text-accent-red'>حذف الحساب</p>
                <p className='text-xs text-light-secondary dark:text-dark-secondary'>
                  حذف نهائي لحسابك وبياناتك
                </p>
              </div>
            </div>
            <HeroIcon
              className='h-4 w-4 text-light-secondary dark:text-dark-secondary'
              iconName='ChevronLeftIcon'
            />
          </button>
        </div>
      )}

      {view === 'appearance' && (
        <div className='flex flex-col gap-5'>
          <div className='flex flex-col gap-2'>
            <p className='text-sm font-bold text-light-secondary dark:text-dark-secondary'>
              الخلفية والمظهر
            </p>
            <ThemePicker />
          </div>
          <div className='flex flex-col gap-2'>
            <p className='text-sm font-bold text-light-secondary dark:text-dark-secondary'>
              لون التمييز
            </p>
            <div
              className='grid grid-cols-6 justify-items-center gap-2 rounded-2xl
                         bg-main-sidebar-background py-3'
            >
              {accents.map((accentColor) => (
                <InputAccentRadio type={accentColor} key={accentColor} />
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'password' && (
        <form
          className='flex flex-col gap-4'
          onSubmit={(e): void => void handleChangePassword(e)}
        >
          <InputField
            label='كلمة المرور الحالية'
            inputId='current-password'
            type='password'
            inputValue={currentPassword}
            handleChange={inputHandler(setCurrentPassword)}
          />
          <InputField
            label='كلمة المرور الجديدة'
            inputId='new-password'
            type='password'
            inputValue={newPassword}
            handleChange={inputHandler(setNewPassword)}
          />
          <InputField
            label='تأكيد كلمة المرور الجديدة'
            inputId='confirm-password'
            type='password'
            inputValue={confirmPassword}
            handleChange={inputHandler(setConfirmPassword)}
          />
          <Button
            type='submit'
            className='mt-1 bg-main-accent py-2.5 font-bold text-main-accent-contrast transition
                       hover:brightness-90 active:brightness-75'
            loading={loading}
            disabled={loading}
          >
            حفظ كلمة المرور
          </Button>
        </form>
      )}

      {view === 'delete' && (
        <form
          className='flex flex-col gap-4'
          onSubmit={(e): void => void handleDeleteAccount(e)}
        >
          <div
            className='rounded-xl border border-accent-red/30 bg-accent-red/10 p-3.5
                       text-sm leading-relaxed text-accent-red'
          >
            <p className='font-bold'>تحذير: هذا الإجراء نهائي</p>
            <p className='mt-1'>
              سيتم حذف حسابك @{username} وجميع بياناتك نهائيًا ولا يمكن التراجع
              عن ذلك.
            </p>
          </div>
          <InputField
            label='كلمة المرور'
            inputId='delete-password'
            type='password'
            inputValue={deletePassword}
            handleChange={inputHandler(setDeletePassword)}
          />
          <InputField
            label="اكتب 'حذف' للتأكيد"
            inputId='delete-confirm'
            inputValue={deleteConfirmText}
            handleChange={inputHandler(setDeleteConfirmText)}
          />
          <Button
            type='submit'
            className='mt-1 bg-accent-red py-2.5 font-bold text-white transition
                       hover:brightness-90 active:brightness-75'
            loading={loading}
            disabled={loading || deleteConfirmText.trim() !== 'حذف'}
          >
            حذف الحساب نهائيًا
          </Button>
        </form>
      )}
    </div>
  );
}
