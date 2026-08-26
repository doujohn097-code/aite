import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import cn from 'clsx';
import { useUser } from '@lib/context/user-context';
import { useModal } from '@lib/hooks/useModal';
import { updateUserData, uploadImages } from '@lib/firebase/utils';
import { withTimeout } from '@lib/utils';

import { getImagesData } from '@lib/validation';
import { Modal } from '@components/modal/modal';
import { EditProfileModal } from '@components/modal/edit-profile-modal';
import { Button } from '@components/ui/button';
import { InputField } from '@components/input/input-field';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { FilesWithId } from '@lib/types/file';
import type { User, EditableData, EditableUserData } from '@lib/types/user';
import type { InputFieldProps } from '@components/input/input-field';
import { useLanguage } from '@lib/context/language-context';
import { BIO_TEXT_MAX } from '@lib/text-limits';

type RequiredInputFieldProps = Omit<InputFieldProps, 'handleChange'> & {
  inputId: EditableData;
};

type UserImages = Record<
  Extract<EditableData, 'photoURL' | 'coverPhotoURL'>,
  FilesWithId
>;

type TrimmedTexts = Pick<
  EditableUserData,
  Exclude<EditableData, 'photoURL' | 'coverPhotoURL'>
>;

type UserEditProfileProps = {
  hide?: boolean;
};

export function UserEditProfile({ hide }: UserEditProfileProps): JSX.Element {
  const { t } = useLanguage();

  const { user } = useUser();
  const { open, openModal, closeModal } = useModal();

  const [loading, setLoading] = useState(false);

  const { bio, name, website, location, photoURL, coverPhotoURL } =
    user as User;

  const [editUserData, setEditUserData] = useState<EditableUserData>({
    bio,
    name,
    website,
    photoURL,
    location,
    coverPhotoURL
  });

  const [userImages, setUserImages] = useState<UserImages>({
    photoURL: [],
    coverPhotoURL: []
  });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => cleanImage, []);

  const inputNameError = !editUserData.name?.trim() ? t('valid.nameEmpty') : '';

  const updateData = async (): Promise<void> => {
    setLoading(true);

    try {
      const userId = user?.id as string;

      const { photoURL, coverPhotoURL: coverURL } = userImages;

      const [newPhotoURL, newCoverPhotoURL] = await withTimeout(
        Promise.all(
          [photoURL, coverURL].map((image) => uploadImages(userId, image))
        ),
        60_000
      );

      const newImages: Partial<Pick<User, 'photoURL' | 'coverPhotoURL'>> = {
        coverPhotoURL:
          coverPhotoURL === editUserData.coverPhotoURL
            ? coverPhotoURL
            : newCoverPhotoURL?.[0].src ?? null,
        ...(newPhotoURL && { photoURL: newPhotoURL[0].src })
      };

      const trimmedKeys: Readonly<EditableData[]> = [
        'name',
        'bio',
        'location',
        'website'
      ];

      const trimmedTexts = trimmedKeys.reduce(
        (acc, curr) => ({ ...acc, [curr]: editUserData[curr]?.trim() ?? null }),
        {} as TrimmedTexts
      );

      const newUserData: Readonly<EditableUserData> = {
        ...editUserData,
        ...trimmedTexts,
        ...newImages
      };

      await updateUserData(userId, newUserData);

      closeModal();

      cleanImage();

      setEditUserData(newUserData);

      toast.success(t('profile.updated'));
    } catch (error) {
      toast.error(t('err.profileUpdate'));
    } finally {
      setLoading(false);
    }
  };

  const editImage =
    (type: 'cover' | 'profile') =>
    ({ target: { files } }: ChangeEvent<HTMLInputElement>): void => {
      const imagesData = getImagesData(files);

      if (!imagesData) {
        toast.error(t('err.validImage'));
        return;
      }

      const { imagesPreviewData, selectedImagesData } = imagesData;

      const targetKey = type === 'cover' ? 'coverPhotoURL' : 'photoURL';
      const newImage = imagesPreviewData[0].src;

      setEditUserData({
        ...editUserData,
        [targetKey]: newImage
      });

      setUserImages({
        ...userImages,
        [targetKey]: selectedImagesData
      });
    };

  const removeCoverImage = (): void => {
    setEditUserData({
      ...editUserData,
      coverPhotoURL: null
    });

    setUserImages({
      ...userImages,
      coverPhotoURL: []
    });

    URL.revokeObjectURL(editUserData.coverPhotoURL ?? '');
  };

  const cleanImage = (): void => {
    const imagesKey: Readonly<Partial<EditableData>[]> = [
      'photoURL',
      'coverPhotoURL'
    ];

    imagesKey.forEach((image) =>
      URL.revokeObjectURL(editUserData[image] ?? '')
    );

    setUserImages({
      photoURL: [],
      coverPhotoURL: []
    });
  };

  const resetUserEditData = (): void =>
    setEditUserData({
      bio,
      name,
      website,
      photoURL,
      location,
      coverPhotoURL
    });

  const handleChange =
    (key: EditableData) =>
    ({
      target: { value }
    }: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setEditUserData({ ...editUserData, [key]: value });

  const handleKeyboardShortcut = ({
    key,
    target,
    ctrlKey
  }: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    if (ctrlKey && key === 'Enter' && !inputNameError) {
      target.blur();
      void updateData();
    }
  };

  const inputFields: Readonly<RequiredInputFieldProps[]> = [
    {
      label: t('profile.name'),
      inputId: 'name',
      inputValue: editUserData.name,
      inputLimit: 50,
      errorMessage: inputNameError
    },
    {
      label: t('profile.bio'),
      inputId: 'bio',
      inputValue: editUserData.bio,
      inputLimit: BIO_TEXT_MAX,
      useTextArea: true
    },
    {
      label: t('profile.location'),
      inputId: 'location',
      inputValue: editUserData.location,
      inputLimit: 30
    },
    {
      label: t('profile.website'),
      inputId: 'website',
      inputValue: editUserData.website,
      inputLimit: 100,
      dirMode: 'ltr'
    }
  ];

  return (
    <form className={cn(hide && 'hidden md:block')}>
      <Modal
        modalClassName='relative bg-main-background rounded-2xl max-w-xl w-full h-[672px] overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <EditProfileModal
          name={name}
          loading={loading}
          photoURL={editUserData.photoURL}
          coverPhotoURL={editUserData.coverPhotoURL}
          inputNameError={inputNameError}
          editImage={editImage}
          closeModal={closeModal}
          updateData={updateData}
          removeCoverImage={removeCoverImage}
          resetUserEditData={resetUserEditData}
        >
          {inputFields.map((inputData) => (
            <InputField
              {...inputData}
              handleChange={handleChange(inputData.inputId)}
              handleKeyboardShortcut={handleKeyboardShortcut}
              key={inputData.inputId}
            />
          ))}
        </EditProfileModal>
      </Modal>
      <Button
        className='dark-bg-tab self-start border border-light-line-reply px-4 py-1.5 font-bold
                   hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
        onClick={openModal}
      >
        {t('profile.edit')}
      </Button>
    </form>
  );
}
