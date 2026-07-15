import React, { useRef, useState } from "react";
import {
  Paperclip,
  X,
  AlertCircle,
} from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../lib/utils";
import { FileIcon } from "./FileIcon";

interface FileUploadProps {
  onFilesChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  className?: string;
  compact?: boolean;
}

export const FileUpload = ({
  onFilesChange,
  maxFiles = 5,
  maxSizeMB = 10,
  className,
  compact = false,
}: FileUploadProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addFiles = (newFiles: File[]) => {
    setError(null);

    // Validate max files
    if (selectedFiles.length + newFiles.length > maxFiles) {
      setError(`Limite de ${maxFiles} arquivos atingido.`);
      return;
    }

    // Validate size and blocked extensions
    const blockedExtensions = [
      ".exe",
      ".bat",
      ".cmd",
      ".sh",
      ".js",
      ".ts",
      ".php",
      ".html",
      ".svg",
      ".htm",
    ];
    const validatedFiles: File[] = [];

    for (const file of newFiles) {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if (blockedExtensions.includes(ext) || !ext) {
        setError(`O arquivo ${file.name} tem um formato não permitido.`);
        return;
      }

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`O arquivo ${file.name} excede o limite de ${maxSizeMB}MB.`);
        return;
      }
      validatedFiles.push(file);
    }

    const updatedFiles = [...selectedFiles, ...validatedFiles];
    setSelectedFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const removeFile = (index: number) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          className="text-slate-600 gap-1.5 font-semibold h-8 rounded-lg bg-white"
          disabled={selectedFiles.length >= maxFiles}
        >
          <Paperclip size={14} /> Anexar
        </Button>
        <span className="text-[10px] text-slate-500 font-medium">
          Limite: {maxFiles} / Até {maxSizeMB}MB
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 p-1.5 bg-red-50 text-red-600 rounded text-xs font-medium border border-red-100 animate-in fade-in slide-in-from-top-1">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white border border-slate-200 group"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-7 h-7 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                  <FileIcon mimeType={file.type} size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-700 truncate leading-tight">
                    {file.name}
                  </p>
                  <p className="text-[9px] font-medium text-slate-500 leading-none mt-0.5">
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
