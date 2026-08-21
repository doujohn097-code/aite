import { getRandomId } from './random';
import type { FilesWithId, FileWithId, ImagesPreview } from './types/file';

const IMAGE_EXTENSIONS = [
  'apng',
  'avif',
  'gif',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'png',
  'svg',
  'webp'
] as const;

type ImageExtensions = (typeof IMAGE_EXTENSIONS)[number];

const MEDIA_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'm4v',
  '3gp',
  'wmv',
  'ts'
] as const;

const AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'oga',
  'webm',
  'm4a',
  'aac',
  'opus',
  'flac'
] as const;

type AudioExtensions = (typeof AUDIO_EXTENSIONS)[number];

type MediaExtensions = (typeof MEDIA_EXTENSIONS)[number];

function isValidImageExtension(
  extension: string
): extension is ImageExtensions {
  return IMAGE_EXTENSIONS.includes(
    extension.split('.').pop()?.toLowerCase() as ImageExtensions
  );
}

function isValidMediaExtension(
  extension: string
): extension is MediaExtensions {
  const ext = extension.split('.').pop()?.toLowerCase();
  return (
    MEDIA_EXTENSIONS.includes(ext as MediaExtensions) ||
    AUDIO_EXTENSIONS.includes(ext as AudioExtensions) ||
    Boolean(
      extension &&
        (extension.startsWith('video/') ||
          extension.startsWith('image/') ||
          extension.startsWith('audio/'))
    )
  );
}

export function isValidImage(name: string, bytes: number): boolean {
  return isValidImageExtension(name) && bytes < 20 * Math.pow(1024, 2);
}

export function isValidMedia(name: string, size: number): boolean {
  return isValidMediaExtension(name) && size < 50 * Math.pow(1024, 2);
}

export function isValidUsername(
  username: string,
  value: string
): string | null {
  if (value.length < 4) return 'يجب أن يكون اسم المستخدم أطول من 4 أحرف.';
  if (value.length > 15) return 'يجب أن يكون اسم المستخدم أقصر من 15 حرفًا.';
  if (!/^\w+$/i.test(value))
    return "يمكن لاسم المستخدم أن يحتوي فقط على أحرف وأرقام و '_' .";
  if (!/[a-z]/i.test(value)) return 'يجب تضمين حرف غير رقمي.';
  if (value === username) return 'هذا اسم المستخدم الحالي.';

  return null;
}

type ImagesData = {
  imagesPreviewData: ImagesPreview;
  selectedImagesData: FilesWithId;
};

type ImagesDataOptions = {
  currentFiles?: number;
  allowUploadingVideos?: boolean;
};

export function getImagesData(
  files: FileList | null,
  { currentFiles, allowUploadingVideos }: ImagesDataOptions = {}
): ImagesData | null {
  if (!files || !files.length) return null;

  const singleEditingMode = currentFiles === undefined;

  const rawImages =
    singleEditingMode ||
    !(currentFiles === 4 || files.length > 4 - currentFiles)
      ? Array.from(files).filter(({ name, size }) =>
          allowUploadingVideos
            ? isValidMedia(name, size)
            : isValidImage(name, size)
        )
      : null;

  if (!rawImages || !rawImages.length) return null;

  const imagesId = rawImages.map(({ name }) => {
    const randomId = getRandomId();
    return {
      id: randomId,
      name: name === 'image.png' ? `${randomId}.png` : null
    };
  });

  const imagesPreviewData = rawImages.map((image, index) => ({
    id: imagesId[index].id,
    src: URL.createObjectURL(image),
    alt: imagesId[index].name ?? image.name,
    type: image.type
  }));

  const selectedImagesData = rawImages.map((image, index) =>
    renameFile(image, imagesId[index].id, imagesId[index].name)
  );

  return { imagesPreviewData, selectedImagesData };
}

function renameFile(
  file: File,
  newId: string,
  newName: string | null
): FileWithId {
  return Object.assign(
    newName
      ? new File([file], newName, {
          type: file.type,
          lastModified: file.lastModified
        })
      : file,
    { id: newId }
  );
}
