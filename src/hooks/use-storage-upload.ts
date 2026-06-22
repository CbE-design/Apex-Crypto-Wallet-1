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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
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
      console.log('[useStorageUpload] Starting upload:', { path, fileSize: file.size, fileType: file.type, hasStorage: !!storage });
      if (!storage) {
        console.error('[useStorageUpload] Storage instance is null');
        setState({ uploading: false, progress: 0, error: 'Storage not available', url: null });
        return null;
      }
      setState({ uploading: true, progress: 0, error: null, url: null });
      try {
        const fileRef = ref(storage, path);
        console.log('[useStorageUpload] Calling uploadBytes...');
        await withTimeout(uploadBytes(fileRef, file), 30000, 'uploadBytes');
        console.log('[useStorageUpload] uploadBytes done, getting download URL...');
        const url = await withTimeout(getDownloadURL(fileRef), 15000, 'getDownloadURL');
        console.log('[useStorageUpload] Got URL:', url?.substring(0, 60) + '...');
        setState({ uploading: false, progress: 100, error: null, url });
        return url;
      } catch (err: any) {
        console.error('[useStorageUpload] Upload error:', err?.message || err);
        setState({ uploading: false, progress: 0, error: err.message || 'Upload failed', url: null });
        return null;
      }
    },
    [storage],
  );

  return { ...state, upload };
}
