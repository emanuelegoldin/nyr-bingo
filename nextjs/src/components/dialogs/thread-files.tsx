"use client";

import { ReviewFile } from "@/lib/db/types";
import { useRef } from "react";
import { Button } from "../ui/button";

interface ThreadFilesProps {
  files: ReviewFile[] | undefined;
  /** True when the user may upload and delete files (owner of an open thread). */
  canManage: boolean;
  isSubmitting: boolean;
  selectedFile: File | null;
  onSelectFile: (file: File | null) => void;
  onUpload: () => void;
  onDelete: (fileId: string) => void;
}

/**
 * Files section of the review thread dialog: the file list and, for the
 * owner of an open thread, the delete, choose and upload controls.
 */
export const ThreadFiles = ({
  files,
  canManage,
  isSubmitting,
  selectedFile,
  onSelectFile,
  onUpload,
  onDelete
}: ThreadFilesProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUploadClick = () => {
    if (isSubmitting) return;
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0] || null;
    onSelectFile(file);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Files</p>
      {files?.length ? (
        <div className="space-y-1">
          {files.map((f: ReviewFile) => (
            <div key={f.id} className="flex items-center justify-between gap-2">
              <a
                href={f.filePath}
                target="_blank"
                rel="noreferrer"
                className="block text-sm underline truncate"
              >
                {f.fileName}
              </a>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void onDelete(f.id);
                  }}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No files yet</p>
      )}

      {canManage && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf,video/*"
            onChange={handleFileChange}
            disabled={isSubmitting}
          />

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={handleUploadClick} disabled={isSubmitting}>
              Choose File
            </Button>
            {selectedFile ? (
              <p className="text-xs text-muted-foreground truncate">{selectedFile.name}</p>
            ) : (
              <p className="text-xs text-muted-foreground">No file selected</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onUpload}
            disabled={isSubmitting || !selectedFile}
          >
            Upload
          </Button>
        </>
      )}
    </div>
  );
};
