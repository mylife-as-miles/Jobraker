import React, { useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  ImagePlus,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../components/ui/toast";
import { useArtboardStore } from "../../../../store/artboard";
import {
  createResumePhotoOptOut,
  createResumePictureFromFile,
  setResumePhotoHidden,
} from "../../../../utils/resume-picture";

interface ResumePhotoEditorProps {
  hasProfileAvatar: boolean;
  profileAvatarUrl: string | null;
  syncingProfilePhoto: boolean;
  onUseProfileImage: () => Promise<boolean>;
  onRefreshProfileImage: () => Promise<boolean>;
}

export const ResumePhotoEditor = ({
  hasProfileAvatar,
  profileAvatarUrl,
  syncingProfilePhoto,
  onUseProfileImage,
  onRefreshProfileImage,
}: ResumePhotoEditorProps) => {
  const picture = useArtboardStore((state) => state.resume.data.basics.picture);
  const updateBasics = useArtboardStore((state) => state.updateBasics);
  const { success, error: toastError } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isHidden = Boolean(picture?.effects?.hidden);
  const previewUrl =
    picture?.url || (!isHidden && hasProfileAvatar ? profileAvatarUrl : null);
  const hasStoredPhoto = Boolean(picture?.url);
  const hasAnyPhoto = Boolean(previewUrl);

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const nextPicture = await createResumePictureFromFile(file, picture);
      updateBasics({ picture: nextPicture });
      success(
        "Resume photo updated",
        "Your custom photo is ready across all resume templates.",
      );
    } catch (error: any) {
      toastError(
        "Photo upload failed",
        error?.message || "Try another image file.",
      );
    } finally {
      setUploading(false);
      event.currentTarget.value = "";
    }
  };

  const handleUseProfileImage = async () => {
    try {
      const didUpdate = await onUseProfileImage();
      if (!didUpdate) {
        toastError(
          "Profile image unavailable",
          "Add a profile image in your account first, or upload a custom photo here.",
        );
        return;
      }

      success(
        "Profile image applied",
        "Your resume is now using the latest photo from your app profile.",
      );
    } catch (error: any) {
      toastError(
        "Profile image failed",
        error?.message || "We couldn't pull in your profile photo just now.",
      );
    }
  };

  const handleRefreshProfileImage = async () => {
    try {
      const didUpdate = await onRefreshProfileImage();
      if (!didUpdate) {
        toastError(
          "Profile image unavailable",
          "There's no profile image to refresh from right now.",
        );
        return;
      }

      success(
        "Profile image refreshed",
        "This resume now has the latest snapshot of your profile image.",
      );
    } catch (error: any) {
      toastError(
        "Refresh failed",
        error?.message || "We couldn't refresh your profile image.",
      );
    }
  };

  const handleToggleHidden = () => {
    if (!picture?.url) return;

    updateBasics({
      picture: setResumePhotoHidden(picture, !isHidden),
    });
  };

  const handleRemove = () => {
    updateBasics({
      picture: createResumePhotoOptOut(picture),
    });
    success(
      "Photo removed",
      "This resume will stay photo-free until you add or reapply one.",
    );
  };

  return (
    <div className='col-span-2 rounded-xl border border-border/50 bg-[hsl(var(--product-surface-muted))] p-4'>
      <div className='flex items-start gap-4'>
        <div className='relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-brand/35 bg-white shadow-sm'>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt='Resume profile'
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#1dff00,transparent)] text-brand'>
              <ImagePlus className='h-6 w-6' />
            </div>
          )}
          {isHidden && hasStoredPhoto && (
            <div className='absolute inset-0 flex items-center justify-center bg-black/50 text-white'>
              <EyeOff className='h-5 w-5' />
            </div>
          )}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='product-page-title text-sm font-semibold'>
            Profile Photo
          </div>
          <p className='product-helper-text mt-1 text-xs leading-relaxed'>
            {hasStoredPhoto
              ? "This resume has its own saved photo snapshot for previews and public sharing."
              : hasProfileAvatar
                ? "Pull in your app profile image as the default headshot, or replace it with a custom resume photo."
                : "Upload a custom headshot here. When you add a profile image to your account later, you can pull it into this resume too."}
          </p>
        </div>
      </div>

      <div className='mt-4 flex flex-wrap gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={handleUseProfileImage}
          disabled={!hasProfileAvatar || syncingProfilePhoto || uploading}
          className='product-outline-button border-brand/45 hover:border-brand hover:text-[#7a5d00]'
        >
          <ImagePlus className='mr-2 h-4 w-4' />
          Use Profile Image
        </Button>

        <Button
          type='button'
          variant='outline'
          onClick={handleRefreshProfileImage}
          disabled={!hasProfileAvatar || syncingProfilePhoto || uploading}
          className='product-outline-button'
        >
          <RefreshCcw className='mr-2 h-4 w-4' />
          Refresh From Profile
        </Button>

        <Button
          type='button'
          variant='outline'
          onClick={() => inputRef.current?.click()}
          disabled={uploading || syncingProfilePhoto}
          className='product-outline-button'
        >
          <Upload className='mr-2 h-4 w-4' />
          {hasStoredPhoto ? "Replace Photo" : "Upload Custom Photo"}
        </Button>

        {hasStoredPhoto && (
          <Button
            type='button'
            variant='outline'
            onClick={handleToggleHidden}
            className='product-outline-button'
          >
            {isHidden ? (
              <Eye className='mr-2 h-4 w-4' />
            ) : (
              <EyeOff className='mr-2 h-4 w-4' />
            )}
            {isHidden ? "Show Photo" : "Hide Photo"}
          </Button>
        )}

        {(hasAnyPhoto || hasProfileAvatar) && (
          <Button
            type='button'
            variant='outline'
            onClick={handleRemove}
            className='product-outline-button hover:border-brand hover:text-brand'
          >
            <Trash2 className='mr-2 h-4 w-4' />
            Remove Photo
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={handleFilePick}
      />
    </div>
  );
};
