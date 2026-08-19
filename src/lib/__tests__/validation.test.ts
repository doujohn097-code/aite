import {
  isValidUsername,
  isValidImage,
  isValidMedia,
  getImagesData
} from '../validation';

describe('isValidUsername', () => {
  const currentUsername = 'currentuser';

  it('rejects a username shorter than 4 characters', () => {
    expect(isValidUsername(currentUsername, 'ab')).toBe(
      'يجب أن يكون اسم المستخدم أطول من 4 أحرف.'
    );
  });

  it('rejects a username longer than 15 characters', () => {
    expect(isValidUsername(currentUsername, 'thisusernameiswaytoolong')).toBe(
      'يجب أن يكون اسم المستخدم أقصر من 15 حرفًا.'
    );
  });

  it('rejects usernames with non-word characters', () => {
    expect(isValidUsername(currentUsername, 'bad name')).toBe(
      "يمكن لاسم المستخدم أن يحتوي فقط على أحرف وأرقام و '_' ."
    );
  });

  it('rejects usernames made of only digits', () => {
    expect(isValidUsername(currentUsername, '12345')).toBe(
      'يجب تضمين حرف غير رقمي.'
    );
  });

  it('rejects when the new value equals the current username', () => {
    expect(isValidUsername(currentUsername, currentUsername)).toBe(
      'هذا اسم المستخدم الحالي.'
    );
  });

  it('accepts a valid username differing from the current one', () => {
    expect(isValidUsername(currentUsername, 'newuser1')).toBeNull();
  });

  it('accepts a username containing an underscore', () => {
    expect(isValidUsername(currentUsername, 'new_user')).toBeNull();
  });
});

describe('isValidImage', () => {
  it('returns true for a png under the size limit', () => {
    expect(isValidImage('photo.png', 1024)).toBe(true);
  });

  it('returns false for a non-image extension', () => {
    expect(isValidImage('document.pdf', 1024)).toBe(false);
  });

  it('returns false for an image exceeding the 20MB limit', () => {
    const twentyMB = 20 * Math.pow(1024, 2);
    expect(isValidImage('photo.png', twentyMB)).toBe(false);
  });

  it('returns true for an image exactly at the size limit', () => {
    const justUnder = 20 * Math.pow(1024, 2) - 1;
    expect(isValidImage('photo.jpeg', justUnder)).toBe(true);
  });

  it('is case-insensitive for extensions', () => {
    expect(isValidImage('PHOTO.PNG', 1024)).toBe(true);
  });
});

describe('isValidMedia', () => {
  it('accepts image files', () => {
    expect(isValidMedia('photo.gif', 1024)).toBe(true);
  });

  it('accepts video files under the 50MB limit', () => {
    expect(isValidMedia('clip.mp4', 1024)).toBe(true);
  });

  it('rejects unsupported video extensions', () => {
    expect(isValidMedia('clip.flv', 1024)).toBe(false);
  });

  it('rejects media exceeding the 50MB limit', () => {
    const fiftyMB = 50 * Math.pow(1024, 2);
    expect(isValidMedia('clip.mp4', fiftyMB)).toBe(false);
  });
});

describe('getImagesData', () => {
  function makeFile(name: string, type: string, size = 100): File {
    return new File([new Uint8Array(size)], name, { type });
  }

  function makeFileList(files: File[]): FileList {
    return {
      length: files.length,
      item: (index: number) => files[index] ?? null,
      [Symbol.iterator]: function* () {
        for (const file of files) yield file;
      }
    } as unknown as FileList;
  }

  it('returns null when no files are provided', () => {
    expect(getImagesData(null)).toBeNull();
  });

  it('returns null for an empty file list', () => {
    expect(getImagesData(makeFileList([]))).toBeNull();
  });

  it('filters out files with invalid extensions', () => {
    const files = [makeFile('doc.pdf', 'application/pdf')];
    expect(getImagesData(makeFileList(files))).toBeNull();
  });

  it('returns preview and selected image data for valid images', () => {
    const files = [makeFile('photo.png', 'image/png')];
    const result = getImagesData(makeFileList(files));

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.imagesPreviewData).toHaveLength(1);
    expect(result.selectedImagesData).toHaveLength(1);
    expect(result.imagesPreviewData[0].src).toBe('blob:mock');
    expect(result.selectedImagesData[0].id).toEqual(
      result.imagesPreviewData[0].id
    );
  });

  it('renames files originally named image.png using the generated id', () => {
    const files = [makeFile('image.png', 'image/png')];
    const result = getImagesData(makeFileList(files));

    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.imagesPreviewData[0].alt).toMatch(/\.png$/);
    expect(result.selectedImagesData[0].name).toBe(
      result.imagesPreviewData[0].alt
    );
  });

  it('caps the total at 4 images when currentFiles is provided', () => {
    const four = [
      makeFile('a.png', 'image/png'),
      makeFile('b.png', 'image/png'),
      makeFile('c.png', 'image/png'),
      makeFile('d.png', 'image/png')
    ];
    // 4 files with currentFiles 0 keeps all 4 (4 > 4 is false)
    expect(
      getImagesData(makeFileList(four), { currentFiles: 0 })?.imagesPreviewData
    ).toHaveLength(4);

    // a 5th file pushes over the limit and the whole selection is rejected
    const five = [...four, makeFile('e.png', 'image/png')];
    expect(getImagesData(makeFileList(five), { currentFiles: 0 })).toBeNull();

    // currentFiles counts already-selected files against the 4-image total
    expect(
      getImagesData(makeFileList(five), { currentFiles: 1 })
    ).toBeNull();
  });

  it('does not cap in single editing mode (currentFiles undefined)', () => {
    const files = Array.from({ length: 5 }, (_, i) =>
      makeFile(`${i}.png`, 'image/png')
    );
    expect(getImagesData(makeFileList(files))?.imagesPreviewData).toHaveLength(
      5
    );
  });

  it('allows videos when allowUploadingVideos is true', () => {
    const files = [makeFile('clip.mp4', 'video/mp4')];
    expect(getImagesData(makeFileList(files))).toBeNull();
    expect(
      getImagesData(makeFileList(files), { allowUploadingVideos: true })
    ).not.toBeNull();
  });
});
