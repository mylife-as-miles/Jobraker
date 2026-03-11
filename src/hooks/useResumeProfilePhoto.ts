import { useCallback, useEffect, useState } from 'react';
import type { ResumeBasics } from '../store/artboard';
import {
  createResumePictureFromProfileAvatar,
  shouldHydrateProfilePhoto,
} from '../utils/resume-picture';

interface UseResumeProfilePhotoOptions {
  picture?: ResumeBasics['picture'];
  profileAvatarPath?: string | null;
  supabase: any;
  updateBasics: (basics: Partial<ResumeBasics>) => void;
}

export function useResumeProfilePhoto({
  picture,
  profileAvatarPath,
  supabase,
  updateBasics,
}: UseResumeProfilePhotoOptions) {
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [syncingProfilePhoto, setSyncingProfilePhoto] = useState(false);

  const syncProfilePicture = useCallback(
    async (force = false) => {
      if (!profileAvatarPath) return null;
      if (!force && !shouldHydrateProfilePhoto(picture)) return null;

      setSyncingProfilePhoto(true);
      try {
        const nextPicture = await createResumePictureFromProfileAvatar(
          supabase,
          profileAvatarPath,
          picture,
        );

        updateBasics({ picture: nextPicture });
        return nextPicture;
      } finally {
        setSyncingProfilePhoto(false);
      }
    },
    [picture, profileAvatarPath, supabase, updateBasics],
  );
  useEffect(() => {
    if (!profileAvatarPath) {
      setProfileAvatarUrl(null);
      return;
    }

    let active = true;

    const loadAvatarUrl = async () => {
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .createSignedUrl(profileAvatarPath, 60 * 10);

        if (error) throw error;
        if (active) setProfileAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setProfileAvatarUrl(null);
      }
    };

    void loadAvatarUrl();
    const intervalId = setInterval(loadAvatarUrl, 1000 * 60 * 8);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [profileAvatarPath, supabase]);

  useEffect(() => {
    if (!profileAvatarPath || !shouldHydrateProfilePhoto(picture)) return;

    syncProfilePicture(false).catch(() => {
      // Silent auto-hydration failure; the editor still exposes manual retry actions.
    });
  }, [picture?.effects?.hidden, picture?.url, profileAvatarPath, syncProfilePicture]);

  return {
    profileAvatarUrl,
    syncingProfilePhoto,
    syncProfilePicture,
  };
}
