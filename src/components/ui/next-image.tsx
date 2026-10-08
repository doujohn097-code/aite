import { useState, useEffect } from 'react';
import Image from 'next/image';
import cn from 'clsx';
import type { ReactNode } from 'react';
import type { ImageProps } from 'next/image';

/** قيم layout من واجهة next/image القديمة — ما زلنا نقبلها ونترجمها داخلياً. */
type LegacyLayout = 'fill' | 'responsive' | 'fixed' | 'intrinsic' | boolean;

type NextImageProps = {
  alt: string;
  width?: string | number;
  children?: ReactNode;
  useSkeleton?: boolean;
  imgClassName?: string;
  previewCount?: number;
  blurClassName?: string;
  layout?: LegacyLayout;
} & Omit<ImageProps, 'layout' | 'onLoadingComplete' | 'onLoad'>;

/**
 * غلاف موحّد لعرض الصور.
 * ملاحظة: layout='fill' يترجَم إلى fill (والحاوية يجب أن تكون positioned)،
 * وأي شيء آخر يعرض الصورة بعرض كامل ونسبة أبعاد ثابتة (مثل responsive سابقاً).
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
  layout,
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

  const isFill = layout === 'fill' || layout === true;
  const numericWidth = typeof width === 'number' ? width : Number(width);

  return (
    <figure
      style={isFill ? undefined : { width }}
      className={cn(loading && 'overflow-hidden', className)}
    >
      <Image
        className={cn(
          imgClassName,
          loading
            ? blurClassName ??
                'animate-pulse bg-light-secondary/30 dark:bg-dark-secondary/40'
            : previewCount === 1
            ? '!h-auto !min-h-0 !w-auto !min-w-0 rounded-lg object-contain'
            : 'object-cover'
        )}
        src={imgSrc}
        width={isFill || !Number.isFinite(numericWidth) ? undefined : numericWidth}
        height={isFill ? undefined : height}
        fill={isFill}
        alt={alt}
        unoptimized
        onLoad={handleLoad}
        onError={handleError}
        style={isFill ? undefined : { width: '100%', height: 'auto' }}
        {...rest}
      />
      {children}
    </figure>
  );
}
