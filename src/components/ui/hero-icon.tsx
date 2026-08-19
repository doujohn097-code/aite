/* eslint-disable import/namespace */

import type { ReactElement, ComponentType } from 'react';
import * as SolidIcons from '@heroicons/react/24/solid';
import * as OutlineIcons from '@heroicons/react/24/outline';
import { CustomIcon } from './custom-icon';
import type { CustomIconProps } from './custom-icon';

export type IconName = string;

type HeroIconProps = {
  solid?: boolean;
  iconName: string;
  className?: string;
};

export function HeroIcon({
  solid,
  iconName,
  className
}: HeroIconProps): ReactElement {
  const solidMap = SolidIcons as unknown as Record<string, ComponentType<{ className?: string }>>;
  const outlineMap = OutlineIcons as unknown as Record<string, ComponentType<{ className?: string }>>;

  let Icon = solid
    ? solidMap[iconName] ?? outlineMap[iconName]
    : outlineMap[iconName] ?? solidMap[iconName];

  if (!Icon) {
    const withIcon = iconName.endsWith('Icon') ? iconName : `${iconName}Icon`;
    const withoutIcon = iconName.endsWith('Icon') ? iconName.slice(0, -4) : iconName;
    Icon =
      (solid ? solidMap[withIcon] ?? outlineMap[withIcon] : outlineMap[withIcon] ?? solidMap[withIcon]) ??
      (solid ? solidMap[withoutIcon] ?? outlineMap[withoutIcon] : outlineMap[withoutIcon] ?? solidMap[withoutIcon]);
  }

  if (Icon) {
    return <Icon className={className ?? 'h-6 w-6'} />;
  }

  // Fallback to CustomIcon
  try {
    return <CustomIcon iconName={iconName as CustomIconProps['iconName']} className={className} />;
  } catch {
    return <span className={className ?? 'inline-block h-6 w-6'} />;
  }
}
