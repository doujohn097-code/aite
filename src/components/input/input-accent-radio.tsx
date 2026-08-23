import cn from 'clsx';
import { useTheme } from '@lib/context/theme-context';
import { HeroIcon } from '@components/ui/hero-icon';
import type { Accent } from '@lib/types/theme';

type InputAccentRadioProps = {
  type: Accent;
};

type InputAccentData = Record<Accent, string>;

const InputColors: Readonly<InputAccentData> = {
  yellow:
    'bg-accent-yellow hover:ring-accent-yellow/10 active:ring-accent-yellow/20',
  blue: 'bg-accent-blue hover:ring-accent-blue/10 active:ring-accent-blue/20',
  pink: 'bg-accent-pink hover:ring-accent-pink/10 active:ring-accent-pink/20',
  purple:
    'bg-accent-purple hover:ring-accent-purple/10 active:ring-accent-purple/20',
  orange:
    'bg-accent-orange hover:ring-accent-orange/10 active:ring-accent-orange/20',
  green:
    'bg-accent-green hover:ring-accent-green/10 active:ring-accent-green/20'
};

const InputCheckColors: Readonly<InputAccentData> = {
  yellow: 'text-accent-yellow-contrast',
  blue: 'text-accent-blue-contrast',
  pink: 'text-accent-pink-contrast',
  purple: 'text-accent-purple-contrast',
  orange: 'text-accent-orange-contrast',
  green: 'text-accent-green-contrast'
};

export function InputAccentRadio({ type }: InputAccentRadioProps): JSX.Element {
  const { accent, changeAccent } = useTheme();

  const bgColor = InputColors[type];
  const checkColor = InputCheckColors[type];
  const isChecked = type === accent;

  return (
    <label
      className={cn(
        `hover-animation flex h-10 w-10 cursor-pointer items-center justify-center
         rounded-full hover:ring`,
        bgColor
      )}
      htmlFor={type}
    >
      <input
        className='peer absolute h-0 w-0 opacity-0'
        id={type}
        type='radio'
        name='accent'
        value={type}
        checked={isChecked}
        onChange={changeAccent}
      />
      <i className={cn('peer-checked:inner:opacity-100', checkColor)}>
        <HeroIcon
          className='h-6 w-6 opacity-0 transition-opacity duration-200'
          iconName='CheckIcon'
        />
      </i>
    </label>
  );
}
