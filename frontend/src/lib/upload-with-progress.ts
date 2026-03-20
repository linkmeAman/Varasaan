'use client';

type UploadWithProgressInput = {
  url: string;
  file: File;
  contentType: string;
  onProgress?: (percent: number) => void;
};

export function uploadWithProgress({ url, file, contentType, onProgress }: UploadWithProgressInput): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const percent = Math.round((event.loaded / event.total) * 100);
      onProgress?.(percent);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(new Error(`upload_failed_${xhr.status}`));
    });

    xhr.addEventListener('error', () => {
      reject(new Error('upload_failed_network'));
    });

    xhr.send(file);
  });
}
