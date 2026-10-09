import { useState, useEffect, useRef } from 'react';
import cn from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import type { ImageProps } from 'next/image';

/**
 * قيم layout من واجهة next/image القديمة — ما زلنا نقبلها ونترجمها داخلياً.
 * ملاحظة: هذا الغلاف يُخرج <img> مباشرة (كل الصور unoptimized أصلاً) ويعيد
 * إنتاج سلوك next/image v12 حرفياً:
 * - fill: صورة مطلقة الموضع تملأ الحاوية مع object-fit: cover.
 * - responsive (الافتراضي): حاوية بنسبة أبعاد width/height + صورة مطلقة
 *   الموضع مقصوصة cover — هذا ما يجعل صور البروفيل دوائر والمرفقات
 *   بأبعاد صحيحة. الكلاسات ذات !important (مثل !h-auto) تتجاوز كما كانت.
 */

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
} & Omit<
  ImageProps,
  'layout' | 'onLoadingComplete' | 'onLoad' | 'width' | 'height'
>;

/** خصائص خاصة بـ next/image لا يجب أن تصل إلى وسم img */
const NEXT_IMAGE_ONLY_PROPS = new Set([
  'priority',
  'placeholder',
  'blurDataURL',
  'loader',
  'quality',
  'objectFit',
  'objectPosition',
  'unoptimized',
  'overrideSrc',
  'fetchPriority'
]);

/** أنماط صورة fill — مطابقة لمخرجات v12 (object-fit: cover افتراضياً). */
const FILL_IMG_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover'
};

/** أنماط صورة responsive — مطابقة لمخرجات v12 (sizer + قص cover). */
const RESPONSIVE_IMG_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  boxSizing: 'border-box',
  padding: 0,
  border: 'none',
  margin: 'auto',
  display: 'block',
  width: 0,
  height: 0,
  minWidth: '100%',
  maxWidth: '100%',
  minHeight: '100%',
  maxHeight: '100%',
  objectFit: 'cover'
};

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

  const wantsFill = layout === 'fill' || layout === true;
  const numericWidth =
    typeof width === 'number'
      ? width
      : Number.isFinite(Number(width))
      ? Number(width)
      : NaN;
  const numericHeight =
    typeof height === 'number'
      ? height
      : Number.isFinite(Number(height))
      ? Number(height)
      : NaN;
  const canSize =
    Number.isFinite(numericWidth) &&
    numericWidth > 0 &&
    Number.isFinite(numericHeight) &&
    numericHeight > 0;
  // fill صريح، أو غياب أبعاد قابلة للاستخدام → سلوك fill
  const useFill = wantsFill || !canSize;

  const imgClasses = cn(
    imgClassName,
    loading
      ? blurClassName ??
          'animate-pulse bg-light-secondary/30 dark:bg-dark-secondary/40'
      : previewCount === 1
      ? '!h-auto !min-h-0 !w-auto !min-w-0 rounded-lg object-contain'
      : 'object-cover'
  );

  // تمرير الخصائص الآمنة فقط إلى وسم img
  const imgProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (!NEXT_IMAGE_ONLY_PROPS.has(key) && typeof value !== 'function') {
      imgProps[key] = value;
    }
  }

  return (
    <figure
      style={useFill ? undefined : { width }}
      className={cn(loading && 'overflow-hidden', className)}
    >
      {useFill ? (
        <img
          ref={imgRef}
          src={imgSrc as string | undefined}
          alt={alt}
          className={imgClasses}
          style={FILL_IMG_STYLE}
          onLoad={handleLoad}
          onError={handleError}
          loading='lazy'
          decoding='async'
          {...imgProps}
        />
      ) : (
        <span
          style={{
            boxSizing: 'border-box',
            display: 'block',
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            height: 0,
            paddingTop: `${(numericHeight / numericWidth) * 100}%`
          }}
        >
          <img
            ref={imgRef}
            src={imgSrc as string | undefined}
            alt={alt}
            className={imgClasses}
            style={RESPONSIVE_IMG_STYLE}
            onLoad={handleLoad}
            onError={handleError}
            loading='lazy'
            decoding='async'
            {...imgProps}
          />
        </span>
      )}
      {children}
    </figure>
  );
}
