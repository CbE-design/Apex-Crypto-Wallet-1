'use client';

import { useState, useCallback } from 'react';
import { useStorage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  url: string | null;
}

export function useStorageUpload() {
  const storage = useStorage();
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    url: null,
  });

  const upload = useCallback(
    async (file: File, path: string): Promise<string | null> => {
      if (!storage) return null;
      setState({ uploading: true, progress: 0, error: null, url: null });
      try {
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        const url = await getDownloadURL(fileRef);
        setState({ uploading: false, progress: 100, error: null, url });
        return url;
      } catch (err: any) {
        setState({ uploading: false, progress: 0, error: err.message || 'Upload failed', url: null });
        return null;
      }
    },
    [storage],
  );

  return { ...state, upload };
}
