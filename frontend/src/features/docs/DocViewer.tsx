import { ArrowLeft, Download, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchBlob } from "@/shared/api";
import { T } from "@/shared/text";
import type { FileInfo } from "@/shared/types";
import { Callout } from "@/shared/ui";

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "blob:"]);

/** Hujjat ichidagi havolalardan faqat xavfsizlarini qoldiradi (`javascript:` va h.k. olib tashlanadi). */
export function stripUnsafeLinks(root: HTMLElement) {
  root.querySelectorAll("[href]").forEach((el) => {
    const raw = el.getAttribute("href") ?? "";
    let protocol = "";
    try {
      protocol = new URL(raw, window.location.href).protocol;
    } catch {
      protocol = "";
    }
    if (!SAFE_PROTOCOLS.has(protocol)) el.removeAttribute("href");
  });
}

/** Modal sarlavhasi hujjat ko'rish rejimida: "← Orqaga" + fayl nomi (modal ustida modal ochilmaydi). */
export function DocTitle({ file, onBack }: { file: FileInfo; onBack: () => void }) {
  return (
    <span className="row">
      <button className="btn btn-sm" onClick={onBack}>
        <ArrowLeft /> {T.common.back}
      </button>
      <span className="ellipsis" style={{ fontSize: 16 }}>
        {file.name}
      </span>
    </span>
  );
}

/** Word (.docx), PDF va rasmni modal ichida ko'rsatadi. Fayl ruxsat tekshiruvi bilan olinadi. */
export function DocViewer({ file }: { file: FileInfo }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "unsupported">("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const kind = ext(file.name);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setState("loading");
    (async () => {
      try {
        if (!["docx", "pdf", "png", "jpg", "jpeg"].includes(kind)) {
          setState("unsupported");
          return;
        }
        const blob = await fetchBlob(file.url);
        if (!alive) return;
        if (kind === "docx") {
          const { renderAsync } = await import("docx-preview");
          if (!alive || !host.current) return;
          host.current.innerHTML = "";
          // renderAltChunks: docx ichidagi HTML'ni iframe'da ishga tushirmaslik uchun o'chirilgan (stored XSS).
          await renderAsync(blob, host.current, undefined, {
            inWrapper: true,
            ignoreLastRenderedPageBreak: true,
            renderAltChunks: false,
          });
          if (host.current) stripUnsafeLinks(host.current);
        } else {
          const typed = kind === "pdf" ? new Blob([blob], { type: "application/pdf" }) : blob;
          objectUrl = URL.createObjectURL(typed);
          setUrl(objectUrl);
        }
        if (alive) setState("ready");
      } catch {
        if (alive) setState("error");
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.url, kind]);

  return (
    <div className="stack" style={{ height: "100%" }}>
      <div className="row">
        {kind !== "pdf" && (
          <>
            <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))} aria-label={T.docs.zoomOut} title={T.docs.zoomOut}>
              <ZoomOut />
            </button>
            <span className="small muted" style={{ minWidth: 44, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} aria-label={T.docs.zoomIn} title={T.docs.zoomIn}>
              <ZoomIn />
            </button>
          </>
        )}
        <div className="spacer" />
        <a className="btn btn-sm" href={`${file.url}?download=1`}>
          <Download /> {T.common.download}
        </a>
      </div>
      {state === "loading" && (
        <div className="row muted" style={{ justifyContent: "center", padding: 40 }}>
          <Loader2 className="spin" /> {T.docs.loading}
        </div>
      )}
      {state === "error" && <Callout tone="danger">{T.docs.failed}</Callout>}
      {state === "unsupported" && <Callout tone="warning">{T.docs.unsupported}</Callout>}
      <div className="doc-stage" style={{ display: state === "ready" ? "block" : "none" }}>
        {kind === "docx" && <div ref={host} style={{ zoom }} />}
        {kind === "pdf" && url && <iframe src={url} title={file.name} />}
        {["png", "jpg", "jpeg"].includes(kind) && url && (
          <div style={{ padding: 20 }}>
            <img className="doc-img" src={url} alt={file.name} style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} />
          </div>
        )}
      </div>
    </div>
  );
}
