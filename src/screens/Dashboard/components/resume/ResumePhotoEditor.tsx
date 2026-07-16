import React, { useRef, useState, useEffect } from "react";
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
import { Modal } from "../../../../components/ui/modal";
import {
  createResumePhotoOptOut,
  createResumePictureDefaults,
  setResumePhotoHidden,
} from "../../../../utils/resume-picture";

interface ResumePhotoEditorProps {
  hasProfileAvatar: boolean;
  profileAvatarUrl: string | null;
  syncingProfilePhoto: boolean;
  onUseProfileImage: () => Promise<boolean>;
  onRefreshProfileImage: () => Promise<boolean>;
}

// Internal Crop Dialog Component
interface PhotoCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (croppedDataUrl: string) => void;
}

const PhotoCropDialog = ({ open, onClose, imageSrc, onSave }: PhotoCropDialogProps) => {
  const D = 250; // display frame size
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const getScale = (z: number) => {
    if (dimensions.width === 0 || dimensions.height === 0) return 0.1;
    const s0 = Math.max(D / dimensions.width, D / dimensions.height);
    return s0 * z;
  };

  const clampPosition = (x: number, y: number, z: number) => {
    const scale = getScale(z);
    const w = dimensions.width * scale;
    const h = dimensions.height * scale;
    const minX = D - w;
    const minY = D - h;
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  };

  const handleImageLoad = () => {
    if (!imageRef.current) return;
    const { naturalWidth, naturalHeight } = imageRef.current;
    setDimensions({ width: naturalWidth, height: naturalHeight });
    
    // Initial centering of image
    const s0 = Math.max(D / naturalWidth, D / naturalHeight);
    const w = naturalWidth * s0;
    const h = naturalHeight * s0;
    setPosition({
      x: (D - w) / 2,
      y: (D - h) / 2,
    });
    setZoom(1);
  };

  const handleZoomChange = (newZoom: number) => {
    const oldScale = getScale(zoom);
    const newScale = getScale(newZoom);
    const cx = D / 2;
    const cy = D / 2;
    
    // Maintain zoom focus at the viewport center
    const px = (cx - position.x) / oldScale;
    const py = (cy - position.y) / oldScale;
    const newX = cx - px * newScale;
    const newY = cy - py * newScale;
    
    const clamped = clampPosition(newX, newY, newZoom);
    setPosition(clamped);
    setZoom(newZoom);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const clamped = clampPosition(newX, newY, zoom);
    setPosition(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
  };

  const handleSave = () => {
    if (!imageRef.current || dimensions.width === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = 384;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = getScale(zoom);
    const ratio = 384 / D;
    const drawW = dimensions.width * scale * ratio;
    const drawH = dimensions.height * scale * ratio;
    const drawX = position.x * ratio;
    const drawY = position.y * ratio;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 384, 384);
    ctx.drawImage(imageRef.current, drawX, drawY, drawW, drawH);

    const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    onSave(croppedDataUrl);
  };

  const scale = getScale(zoom);
  const w = dimensions.width * scale;
  const h = dimensions.height * scale;

  return (
    <Modal open={open} onClose={onClose} title="Reposition Profile Photo" size="sm">
      <div className="flex flex-col items-center gap-6 py-2">
        <div 
          className="relative w-[250px] h-[250px] rounded-full overflow-hidden border border-brand/30 bg-muted select-none cursor-move shadow-inner"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="To crop"
            onLoad={handleImageLoad}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: dimensions.width ? `${w}px` : "auto",
              height: dimensions.height ? `${h}px` : "auto",
              transform: `translate(${position.x}px, ${position.y}px)`,
              pointerEvents: "none",
              maxWidth: "none",
            }}
          />
        </div>
        
        <div className="w-full space-y-2 px-2">
          <div className="flex justify-between text-xs text-muted-foreground font-medium">
            <span>Zoom</span>
            <span>{Math.round((zoom - 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
            className="w-full accent-brand h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex w-full gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 bg-brand text-black hover:bg-brand/90 rounded-xl font-semibold">
            Apply Photo
          </Button>
        </div>
      </div>
    </Modal>
  );
};

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
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isHidden = Boolean(picture?.effects?.hidden);
  const previewUrl =
    picture?.url || (!isHidden && hasProfileAvatar ? profileAvatarUrl : null);
  const hasStoredPhoto = Boolean(picture?.url);
  const hasAnyPhoto = Boolean(previewUrl);

  const handleFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Use FileReader to get data URL for cropping modal
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result;
      if (typeof dataUrl === "string") {
        setCropImageSrc(dataUrl);
      }
    };
    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const handleSaveCropped = (croppedDataUrl: string) => {
    setUploading(true);
    try {
      const nextPicture = createResumePictureDefaults(picture, croppedDataUrl);
      updateBasics({ picture: nextPicture });
      success(
        "Resume photo updated",
        "Your custom photo is ready across all resume templates.",
      );
      setCropImageSrc(null);
    } catch (error: any) {
      toastError(
        "Photo upload failed",
        error?.message || "Try another image file.",
      );
    } finally {
      setUploading(false);
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

      {cropImageSrc && (
        <PhotoCropDialog
          open={true}
          onClose={() => setCropImageSrc(null)}
          imageSrc={cropImageSrc}
          onSave={handleSaveCropped}
        />
      )}
    </div>
  );
};
