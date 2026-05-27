'use client';

import * as React from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DocumentUploadFieldProps {
  label: string;
  sublabel?: string;
  accept?: string;
  previewUrl: string | null;
  uploading: boolean;
  error?: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
}

function compressImage(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
      if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      }, 'image/jpeg', quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function DocumentUploadField({
  label,
  sublabel,
  accept = 'image/*',
  previewUrl,
  uploading,
  error,
  onFileSelect,
  onClear,
}: DocumentUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // If image, compress before passing up
    if (file.type.startsWith('image/')) {
      try {
        const compressed = await compressImage(file);
        const compressedFile = new File([compressed], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
        onFileSelect(compressedFile);
      } catch {
        onFileSelect(file); // fallback to original
      }
    } else {
      onFileSelect(file);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {previewUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-border/40 bg-muted/20">
          <img src={previewUrl} alt={label} className="w-full h-48 object-cover" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            type="button"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/40 bg-muted/20 py-8 transition-colors hover:bg-muted/30',
            error && 'border-destructive/50 bg-destructive/5',
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {uploading ? 'Uploading...' : 'Click to upload image'}
          </span>
          {sublabel && <span className="text-[10px] text-muted-foreground/60">{sublabel}</span>}
        </button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
