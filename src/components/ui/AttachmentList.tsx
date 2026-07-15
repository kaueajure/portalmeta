import React from "react";
import { TicketAttachment } from "../../types";
import { FileIcon } from "./FileIcon";
import { Download, X, ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";

interface AttachmentListProps {
  attachments: TicketAttachment[];
  onRemove?: (id: number) => void;
  className?: string;
  compact?: boolean;
}

export const AttachmentList = ({
  attachments,
  onRemove,
  className,
  compact = false,
}: AttachmentListProps) => {
  if (attachments.length === 0) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isImage = (mimeType?: string) => /^image\//i.test(mimeType || "");
  const inlineUrl = (url?: string) => {
    if (!url) return "";
    return `${url}${url.includes("?") ? "&" : "?"}inline=1`;
  };

  return (
    <div
      className={cn(
        "grid gap-2",
        compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
        className,
      )}
    >
      {attachments.map((file) => {
        const imageAttachment = isImage(file.mime_type);

        return (
        <div
          key={file.id}
          className={cn(
            "overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-sm",
            file.interno && "bg-amber-50/60 border-amber-200",
          )}
        >
          {imageAttachment && file.url && (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border-b border-slate-100 bg-slate-50"
              title="Abrir imagem"
            >
              <img
                src={inlineUrl(file.url)}
                alt={file.nome_original}
                loading="lazy"
                className="max-h-72 w-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
              />
            </a>
          )}

          <div className="flex items-center justify-between gap-3 p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                  file.interno
                    ? "border-amber-200 bg-amber-100 text-amber-700"
                    : imageAttachment
                      ? "border-blue-100 bg-blue-50 text-blue-600"
                      : "border-slate-200 bg-slate-50 text-slate-500",
                )}
              >
                <FileIcon mimeType={file.mime_type} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-semibold text-slate-700"
                  title={file.nome_original}
                >
                  {file.nome_original}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-slate-500">
                  <span>{imageAttachment ? "Imagem" : file.tipo || file.mime_type || "Arquivo"}</span>
                  <span className="text-slate-300">/</span>
                  <span>{formatSize(file.tamanho_bytes)}</span>
                  {Number(file.interno) === 1 && (
                    <span className="font-bold uppercase tracking-wider text-amber-700">
                      Interno
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                download={file.nome_original}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                title="Baixar arquivo"
              >
                <Download size={14} />
              </a>
              {file.url && (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  title="Abrir arquivo"
                >
                  <ExternalLink size={14} />
                </a>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(file.id)}
                  className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="Remover anexo"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )})}
    </div>
  );
};
