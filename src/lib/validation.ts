import { tx } from './i18n/tx';
import { getRandomId } from './random';
import {
  MAX_IMAGE_UPLOAD_BYTES,
  inferMediaType,
  maxUploadBytesForType
} from './media-limits';
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
  return isValidImageExtension(name) && bytes <= MAX_IMAGE_UPLOAD_BYTES;
}

export function isValidMedia(
  name: string,
  size: number,
  type = 'video/mp4'
): boolean {
  return (
    isValidMediaExtension(name) &&
    size <= maxUploadBytesForType(inferMediaType(name, type))
  );
}

export function isValidUsername(
  username: string,
  value: string
): string | null {
  if (value.length < 4) return tx('valid.userMin');
  if (value.length > 15) return tx('valid.userMax');
  if (!/^\w+$/i.test(value)) return tx('valid.userChars');
  if (!/[a-z]/i.test(value)) return tx('valid.userLetter');
  if (value === username) return tx('valid.userSame');

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
      ? Array.from(files).filter(({ name, size, type }) =>
          allowUploadingVideos
            ? isValidMedia(name, size, type)
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
