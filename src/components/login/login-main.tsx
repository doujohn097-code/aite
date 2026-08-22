import { useState, type FormEvent, type ChangeEvent } from 'react';
import { useAuth } from '@lib/context/auth-context';
import { getActiveAuthUser } from '@lib/firebase/app';
import { saveAccount } from '@lib/accounts';
import { CustomIcon } from '@components/ui/custom-icon';
import { Button } from '@components/ui/button';
import { InputField } from '@components/input/input-field';

export function LoginMain(): JSX.Element {
  const {
    signInWithUsername,
    signUpWithUsername,
    error: authError
  } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetFields = (): void => {
    setName('');
    setUsername('');
    setPassword('');
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanedUsername = username.trim().replace(/\s+/g, '').toLowerCase();
      if (isSignUp) {
        if (!name.trim() || !cleanedUsername || !password) {
          throw new Error('يرجى ملء جميع الحقول');
        }
        await signUpWithUsername({
          name: name.trim(),
          username: cleanedUsername,
          password
        });
      } else {
        if (!cleanedUsername || !password)
          throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور');
        await signInWithUsername(cleanedUsername, password);
      }
      const currentUser = getActiveAuthUser();
      saveAccount({
        username: cleanedUsername,
        password,
        name:
          (isSignUp ? name.trim() : currentUser?.displayName) ??
          cleanedUsername,
        photoURL: currentUser?.photoURL ?? null
      });
      resetFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className='grid min-h-screen lg:grid-cols-[1fr,45vw]'>
      <div className='relative hidden items-center justify-center bg-black p-12 lg:flex'>
        <img
          src='/assets/home-logo.png'
          alt='Aite'
          className='w-full max-w-md select-none object-contain'
        />
      </div>
      <div className='flex flex-col items-center justify-between gap-6 p-8 lg:items-start lg:justify-center'>
        <i className='mb-0 self-center lg:mb-10 lg:self-auto'>
          <CustomIcon
            className='-mt-4 h-10 w-10 lg:h-14 lg:w-14'
            iconName='AiteIcon'
          />
        </i>
        <div className='flex max-w-md flex-col gap-4 font-aite-extended lg:max-w-2xl lg:gap-16'>
          <h1 className='font-aite-extended text-3xl lg:text-6xl'>
            تواصل بشكل أنيق مع الجميع!
          </h1>
          <h2 className='hidden text-xl lg:block lg:text-3xl'>
            انضم إلى Aite اليوم.
          </h2>
        </div>
        <div className='flex w-full max-w-xs flex-col gap-6 [&_button]:py-2'>
          <div className='flex flex-col items-center gap-3'>
            <img
              src='/assets/home-logo-black.png'
              alt='Aite'
              className='h-10 w-auto select-none object-contain dark:hidden'
            />
            <img
              src='/assets/home-logo.png'
              alt=''
              aria-hidden='true'
              className='hidden h-10 w-auto select-none object-contain dark:block'
            />
            <i className='w-full border-b border-light-border dark:border-dark-border' />
          </div>
          <form onSubmit={handleSubmit} className='grid gap-3'>
            {isSignUp && (
              <InputField
                label='الاسم الكامل'
                inputId='name'
                inputValue={name}
                handleChange={({
                  target: { value }
                }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
                  setName(value)
                }
              />
            )}
            <InputField
              label='اسم المستخدم'
              inputId='username'
              inputValue={username}
              handleChange={({
                target: { value }
              }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
                setUsername(value.replace(/\s+/g, '').toLowerCase())
              }
            />

            <InputField
              label='كلمة المرور'
              inputId='password'
              inputValue={password}
              type='password'
              handleChange={({
                target: { value }
              }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void =>
                setPassword(value)
              }
            />
            {(error || authError) && (
              <p className='text-sm text-accent-red'>
                {error ?? authError?.message}
              </p>
            )}
            <Button
              type='submit'
              className='bg-accent-blue text-black transition hover:brightness-90
                         focus-visible:!ring-accent-blue/80 focus-visible:brightness-90 active:brightness-75'
              loading={loading}
              disabled={loading}
            >
              {isSignUp ? 'إنشاء حساب' : 'تسجيل الدخول'}
            </Button>
          </form>
          <p className='text-center text-sm text-light-secondary dark:text-dark-secondary'>
            {isSignUp ? 'لديك حساب؟ ' : 'ليس لديك حساب؟ '}
            <button
              type='button'
              onClick={(): void => {
                setIsSignUp((prev) => !prev);
                setError(null);
              }}
              className='text-accent-blue hover:underline'
            >
              {isSignUp ? 'سجل الدخول' : 'سجل الآن'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
