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
    onFileSelect(file);
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
