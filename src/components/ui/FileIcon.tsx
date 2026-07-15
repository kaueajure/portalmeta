import React from "react";
import {
  FileText,
  Image as ImageIcon,
  File as FileIconLucide,
  FileArchive,
  FileCode,
  Film,
  Music,
  FileSpreadsheet,
  FileBox,
} from "lucide-react";

interface FileIconProps {
  mimeType: string;
  className?: string;
  size?: number;
}

export const FileIcon = ({ mimeType, className, size = 18 }: FileIconProps) => {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon size={size} className={className} />;
  }

  if (mimeType.includes("pdf")) {
    return <FileText size={size} className={className} />;
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv")
  ) {
    return <FileSpreadsheet size={size} className={className} />;
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("7z") ||
    mimeType.includes("compressed")
  ) {
    return <FileArchive size={size} className={className} />;
  }

  if (mimeType.includes("word") || mimeType.includes("office")) {
    return <FileText size={size} className={className} />;
  }

  if (mimeType.startsWith("video/")) {
    return <Film size={size} className={className} />;
  }

  if (mimeType.startsWith("audio/")) {
    return <Music size={size} className={className} />;
  }

  if (
    mimeType.includes("javascript") ||
    mimeType.includes("typescript") ||
    mimeType.includes("json") ||
    mimeType.includes("html")
  ) {
    return <FileCode size={size} className={className} />;
  }

  return <FileIconLucide size={size} className={className} />;
};
