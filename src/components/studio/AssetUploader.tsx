'use client';

import {useState, useRef} from 'react';
import {ref, uploadBytesResumable, getDownloadURL} from 'firebase/storage';
import {collection, addDoc, Timestamp} from 'firebase/firestore';
import {db, storage, auth} from '@/lib/firebaseClient';
import {useTranslations} from 'next-intl';
import {UploadProgress} from '@/types/studio';

export function AssetUploader() {
  const t = useTranslations('studio.assets.upload');
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const user = auth.currentUser;
    if (!user) {
      alert(t('error.notAuthenticated'));
      return;
    }

    setUploading(true);
    const uploadPromises: Promise<void>[] = [];

    Array.from(files).forEach((file) => {
      const uploadProgress: UploadProgress = {
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      };

      setProgress((prev) => [...prev, uploadProgress]);

      const promise = uploadFile(file, user.uid, uploadProgress);
      uploadPromises.push(promise);
    });

    try {
      await Promise.all(uploadPromises);
      setIsOpen(false);
      setProgress([]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const uploadFile = async (
    file: File,
    userId: string,
    uploadProgress: UploadProgress
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Create storage reference
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const storagePath = `studio/${userId}/assets/${fileName}`;
      const storageRef = ref(storage, storagePath);

      // Start upload
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress
          const progressPercent = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress((prev) =>
            prev.map((p) =>
              p.fileName === uploadProgress.fileName
                ? {...p, progress: Math.round(progressPercent)}
                : p
            )
          );
        },
        (error) => {
          // Error
          console.error('Upload error:', error);
          setProgress((prev) =>
            prev.map((p) =>
              p.fileName === uploadProgress.fileName
                ? {...p, status: 'error', error: error.message}
                : p
            )
          );
          reject(error);
        },
        async () => {
          // Success
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Determine file type
            let fileType: 'image' | 'video' | 'audio' = 'image';
            if (file.type.startsWith('video/')) fileType = 'video';
            else if (file.type.startsWith('audio/')) fileType = 'audio';

            // Create Firestore document
            await addDoc(collection(db, 'studio_assets'), {
              userId,
              fileName: file.name,
              fileType,
              fileSize: file.size,
              storagePath,
              storageUrl: downloadURL,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            });

            setProgress((prev) =>
              prev.map((p) =>
                p.fileName === uploadProgress.fileName ? {...p, status: 'complete'} : p
              )
            );

            resolve();
          } catch (error: any) {
            console.error('Firestore error:', error);
            setProgress((prev) =>
              prev.map((p) =>
                p.fileName === uploadProgress.fileName
                  ? {...p, status: 'error', error: error.message}
                  : p
              )
            );
            reject(error);
          }
        }
      );
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      {/* Upload Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        {t('button')}
      </button>

      {/* Upload Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
              <button
                onClick={() => setIsOpen(false)}
                disabled={uploading}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="rounded-lg border-2 border-dashed border-border bg-muted p-12 text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                onChange={(e) => handleUpload(e.target.files)}
                className="hidden"
              />

              <svg
                className="mx-auto h-12 w-12 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>

              <p className="mt-4 text-sm text-foreground">{t('dragDrop')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('or')}</p>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {t('browse')}
              </button>

              <p className="mt-4 text-xs text-muted-foreground">{t('supportedFormats')}</p>
            </div>

            {/* Upload Progress */}
            {progress.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-foreground">{t('uploading')}</h3>
                {progress.map((p) => (
                  <div key={p.fileName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-muted-foreground">{p.fileName}</span>
                      <span className="text-muted-foreground">
                        {p.status === 'complete' ? '✓' : `${p.progress}%`}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full transition-all ${
                          p.status === 'error' ? 'bg-red-500' : p.status === 'complete' ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{width: `${p.progress}%`}}
                      />
                    </div>
                    {p.error && <p className="text-xs text-red-500">{p.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
