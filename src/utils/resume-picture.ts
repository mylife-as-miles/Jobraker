import type { ResumeBasics } from "../store/artboard";

const SNAPSHOT_SIZE = 384;
const SNAPSHOT_QUALITY = 0.88;
const DEFAULT_PICTURE_SIZE = 112;
const DEFAULT_BORDER_RADIUS = 28;

type ResumePicture = NonNullable<ResumeBasics["picture"]>;

const getPictureEffects = (picture?: ResumeBasics["picture"] | null) => ({
  hidden: picture?.effects?.hidden ?? false,
  border: picture?.effects?.border ?? false,
  grayscale: picture?.effects?.grayscale ?? false,
});

const loadImageFromBlob = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to process the selected image."));
    };

    image.src = objectUrl;
  });

const blobToSquareDataUrl = async (blob: Blob): Promise<string> => {
  const image = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  canvas.width = SNAPSHOT_SIZE;
  canvas.height = SNAPSHOT_SIZE;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not prepare this image.");
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.max(SNAPSHOT_SIZE / width, SNAPSHOT_SIZE / height);
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const x = (SNAPSHOT_SIZE - drawWidth) / 2;
  const y = (SNAPSHOT_SIZE - drawHeight) / 2;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, SNAPSHOT_SIZE, SNAPSHOT_SIZE);
  context.drawImage(image, x, y, drawWidth, drawHeight);

  return canvas.toDataURL("image/jpeg", SNAPSHOT_QUALITY);
};

export const createResumePictureDefaults = (
  picture?: ResumeBasics["picture"] | null,
  url = "",
): ResumePicture => ({
  url,
  size: picture?.size ?? DEFAULT_PICTURE_SIZE,
  aspectRatio: 1,
  borderRadius: picture?.borderRadius ?? DEFAULT_BORDER_RADIUS,
  effects: {
    ...getPictureEffects(picture),
    hidden: url ? false : picture?.effects?.hidden ?? false,
  },
});

export const shouldHydrateProfilePhoto = (
  picture?: ResumeBasics["picture"] | null,
) => !picture?.url && !picture?.effects?.hidden;

export const createResumePhotoOptOut = (
  picture?: ResumeBasics["picture"] | null,
): ResumePicture => ({
  ...createResumePictureDefaults(picture, ""),
  effects: {
    ...getPictureEffects(picture),
    hidden: true,
  },
});

export const setResumePhotoHidden = (
  picture?: ResumeBasics["picture"] | null,
  hidden = true,
): ResumePicture => ({
  ...createResumePictureDefaults(picture, picture?.url || ""),
  effects: {
    ...getPictureEffects(picture),
    hidden,
  },
});

export const createResumePictureFromBlob = async (
  blob: Blob,
  picture?: ResumeBasics["picture"] | null,
): Promise<ResumePicture> => {
  const dataUrl = await blobToSquareDataUrl(blob);
  return createResumePictureDefaults(picture, dataUrl);
};

export const createResumePictureFromFile = async (
  file: File,
  picture?: ResumeBasics["picture"] | null,
): Promise<ResumePicture> => createResumePictureFromBlob(file, picture);

export const createResumePictureFromProfileAvatar = async (
  supabase: any,
  avatarPath: string,
  picture?: ResumeBasics["picture"] | null,
): Promise<ResumePicture> => {
  const { data, error } = await supabase.storage
    .from("avatars")
    .download(avatarPath);

  if (error || !data) {
    throw new Error(error?.message || "Unable to load your profile image.");
  }

  return createResumePictureFromBlob(data, picture);
};
