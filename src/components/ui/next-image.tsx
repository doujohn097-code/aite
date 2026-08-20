import { useState, useEffect } from 'react';
import Image from 'next/image';
import cn from 'clsx';
import type { ReactNode } from 'react';
import type { ImageProps } from 'next/image';

type NextImageProps = {
  alt: string;
  width?: string | number;
  children?: ReactNode;
  useSkeleton?: boolean;
  imgClassName?: string;
  previewCount?: number;
  blurClassName?: string;
} & ImageProps;

/**
 *
 * @description Must set width and height, if not add layout='fill'
 * @param useSkeleton add background with pulse animation, don't use it if image is transparent
 */
export function NextImage({
  src,
  alt,
  width,
  height,
  children,
  className,
  useSkeleton,
  imgClassName,
  previewCount,
  blurClassName,
  ...rest
}: NextImageProps): JSX.Element {
  const [loading, setLoading] = useState(!!useSkeleton);
  const [imgSrc, setImgSrc] = useState(src);

  // متابعة تغيّر المصدر (معاينة الصور المختارة محليًا) وإلا ظلّت الصورة القديمة
  useEffect(() => {
    setImgSrc(src);
    setLoading(!!useSkeleton);
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoad = (): void => setLoading(false);
  const handleError = (): void => {
    setLoading(false);
    if (typeof src === 'string' && src.includes('avatar')) {
      setImgSrc('/assets/default-avatar.png');
    }
  };

  return (
    <figure style={{ width }} className={className}>
      <Image
        className={cn(
          imgClassName,
          loading
            ? blurClassName ??
                'animate-pulse bg-light-secondary dark:bg-dark-secondary'
            : previewCount === 1
            ? '!h-auto !min-h-0 !w-auto !min-w-0 rounded-lg object-contain'
            : 'object-cover'
        )}
        src={imgSrc}
        width={width}
        height={height}
        alt={alt}
        unoptimized
        onLoadingComplete={handleLoad}
        onError={handleError}
        layout='responsive'
        {...rest}
      />
      {children}
    </figure>
  );
}
