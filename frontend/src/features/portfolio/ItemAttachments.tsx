import { useMutation } from "@tanstack/react-query";
import { Clock, Download, FileText, Trash2, Upload } from "lucide-react";
import { useState } from "react";

import { usePagedList, useRefresh } from "@/app/queries";
import { api } from "@/shared/api";
import { fileSize, fmtDate, fmtDateTime, timeAgo } from "@/shared/format";
import { T } from "@/shared/text";
import type { PortfolioAttachment, PortfolioHistoryEntry, PortfolioItemDetail } from "@/shared/types";
import { Button, ConfirmButton, Empty, ErrorBox, FilePicker, SkeletonRows, useToast } from "@/shared/ui";
import { Pagination } from "@/shared/ui/Pagination";

const ACCEPT = ".png,.jpg,.jpeg,.webp,.docx,.pdf";

/** Loyihaga biriktirilgan rasm va fayllar: hamma ko'radi, yuklash va o'chirish faqat egasida. */
export function AttachmentsSection({ item }: { item: PortfolioItemDetail }) {
  const toast = useToast();
  const refresh = useRefresh(["portfolio"]);
  const [files, setFiles] = useState<File[]>([]);
  const canEdit = item.actions.upload;
  const images = item.attachments.filter((a) => a.kind === "image");
  const documents = item.attachments.filter((a) => a.kind === "file");

  const upload = useMutation({
    mutationFn: async (list: File[]) => {
      for (const [index, file] of list.entries()) {
        const body = new FormData();
        body.append("file", file);
        try {
          await api.post<PortfolioAttachment>(`/portfolio/items/${item.id}/attachments/`, body);
        } catch (error) {
          setFiles(list.slice(index)); // yuklanganlari qayta yuklanmasin — faqat xato bergani va qolganlari qoladi
          void refresh();
          throw error;
        }
      }
    },
    onSuccess: () => {
      toast(T.portfolio.attachmentUploadedToast);
      setFiles([]);
      void refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/portfolio/items/${item.id}/attachments/${id}/`),
    onSuccess: () => {
      toast(T.portfolio.attachmentDeletedToast);
      void refresh();
    },
    onError: (e) => toast(e.message, "error"),
  });
  const deleteButton = (a: PortfolioAttachment) =>
    canEdit && (
      <ConfirmButton onConfirm={() => remove.mutate(a.id)} loading={remove.isPending && remove.variables === a.id}>
        <Trash2 size={15} /> {T.portfolio.attachmentDelete}
      </ConfirmButton>
    );

  return (
    <div className="stack">
      {!item.attachments.length && !canEdit && <p className="small muted">{T.portfolio.attachmentsEmpty}</p>}

      {images.length > 0 && (
        <ul className="portfolio-gallery">
          {images.map((a) => (
            <li key={a.id} className="portfolio-gallery-item">
              <a href={a.url} target="_blank" rel="noopener noreferrer" aria-label={T.portfolio.attachmentOpen(a.name)}>
                <img src={a.url} alt={a.name} loading="lazy" />
              </a>
              <div className="row-wrap small muted" style={{ justifyContent: "space-between" }}>
                <span className="ellipsis" title={a.name}>{a.name}</span>
                <span title={fmtDateTime(a.created_at)}>{fmtDate(a.created_at)}</span>
              </div>
              {deleteButton(a)}
            </li>
          ))}
        </ul>
      )}

      {documents.length > 0 && (
        <div className="card">
          {documents.map((a) => (
            <div key={a.id} className="list-row">
              <FileText size={20} aria-hidden />
              <div className="grow stack-sm" style={{ gap: 2, minWidth: 0 }}>
                <b className="ellipsis" title={a.name}>{a.name}</b>
                <span className="small muted">{fileSize(a.size)} · {fmtDate(a.created_at)}</span>
              </div>
              <a className="btn btn-sm" href={a.url} download={a.name}>
                <Download size={15} /> {T.portfolio.attachmentDownload}
              </a>
              {deleteButton(a)}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="stack-sm">
          <FilePicker files={files} onChange={(next) => (setFiles(next), upload.reset())} accept={ACCEPT}
            label={T.portfolio.attachmentPick} hint={T.portfolio.attachmentHint} />
          {upload.error && <ErrorBox error={upload.error} />}
          {files.length > 0 && (
            <div>
              <Button variant="primary" icon={<Upload size={16} />} loading={upload.isPending} onClick={() => upload.mutate(files)}>
                {T.portfolio.attachmentUpload}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Rasm, video va fayl qachon va kim tomonidan qo'shilgani/o'chirilgani (eng yangisi tepada). */
export function HistorySection({ itemId }: { itemId: number }) {
  const history = usePagedList<PortfolioHistoryEntry>(["portfolio", "history", itemId], `/portfolio/items/${itemId}/history/`, {});
  return (
    <div className="stack-sm">
      {history.error && <ErrorBox error={history.error} onRetry={() => history.refetch()} />}
      {history.isLoading && <div className="card"><SkeletonRows rows={2} /></div>}
      {history.data && !history.data.length && <div className="card"><Empty icon={<Clock />} title={T.portfolio.historyEmpty} /></div>}
      {history.data && history.data.length > 0 && (
        <div className="card">
          {history.data.map((entry) => (
            <div key={entry.id} className="list-row">
              <Clock size={16} className="muted" aria-hidden />
              <span className="grow" style={{ minWidth: 0 }}>{entry.message}</span>
              <span className="small muted nowrap" title={fmtDateTime(entry.created_at)}>{timeAgo(entry.created_at)}</span>
            </div>
          ))}
        </div>
      )}
      <Pagination data={history.pagination} page={history.page} onPageChange={history.onPageChange} />
    </div>
  );
}
