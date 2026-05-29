import { useState } from 'react';

const MAX_SIZE = 5 * 1024 * 1024;

export function usePhotoCapture(onSizeError: () => void) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const applyPhotoFile = (file: File) => {
    if (file.size > MAX_SIZE) {
      onSizeError();
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  return { photoFile, photoPreview, applyPhotoFile, clearPhoto };
}
