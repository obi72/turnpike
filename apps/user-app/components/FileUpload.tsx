"use client";

import { useState, useRef, useEffect } from "react";
import { calcFee, MIN_PRICE_UNITS } from "@/lib/fee";
import { api } from "@/lib/api";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.trnpk.net";

interface Props { userId: string; walletAddress: string | null; }

export default function FileUpload({ userId, walletAddress }: Props) {
  const [file, setFile]           = useState<File | null>(null);
  const [slots, setSlots]         = useState<{ count: number; max: number } | null>(null);
  const [price, setPrice]         = useState("0.10");
  const [description, setDesc]    = useState("");
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState<any>(null);
  const [error, setError]         = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [titleError, setTitleError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getSlots(userId)
      .then(d => setSlots({ count: d.count, max: d.max }))
      .catch(() => {});
  }, [userId]);

  const priceNum   = parseFloat(price) || 0;
  const priceUnits = Math.round(priceNum * 1_000_000);
  const feeInfo    = calcFee(priceNum);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim()) { setTitleError(true); return; }
    if (!file) { setError("Please select a file."); return; }
    if (!walletAddress) { setError("Wallet not ready. Refresh and try again."); return; }
    if (file.size > 50 * 1024 * 1024) { setError("File too large. Maximum 50 MB."); return; }
    if (priceUnits < MIN_PRICE_UNITS) { setError("Minimum price is $0.02"); return; }

    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("file",           file);
    formData.append("ownerId",        userId);
    formData.append("price",          String(priceUnits));
    formData.append("description",    description || file.name);
    formData.append("providerWallet", walletAddress);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", ev => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      const body = JSON.parse(xhr.responseText);
      if (xhr.status === 200) { setResult(body); }
      else { setError(body?.error ?? "Upload failed"); }
    });
    xhr.addEventListener("error", () => { setUploading(false); setError("Network error"); });

    xhr.open("POST", `${BACKEND_URL}/api/files/upload`);
    xhr.send(formData);
  }

  if (result) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <p style={{ fontSize: 14, color: "var(--success)", marginBottom: 12 }}>✓ File uploaded!</p>
        <div style={{
          background: "var(--bg-3)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)", padding: "10px 14px",
          fontFamily: "monospace", fontSize: 13, marginBottom: 8, wordBreak: "break-all",
        }}>
          {result.payUrl}
        </div>
        <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 20 }}>
          You receive {result.display.provider} per download · {result.display.feeLabel} fee ·
          auto-deleted after 30 days without downloads
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn-primary" onClick={() => navigator.clipboard.writeText(result.payUrl)}>
            Copy link
          </button>
          <button className="btn-ghost" onClick={() => { setResult(null); setFile(null); }}>
            Upload another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {slots && (
        <p style={{ fontSize: 12, color: slots.count >= slots.max ? "var(--danger)" : "var(--text-3)", textAlign: "right" }}>
          {slots.count} / {slots.max} uploads used
        </p>
      )}
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0] ?? null); }}
        style={{
          border: `2px dashed ${file ? "var(--accent)" : "var(--border-2)"}`,
          borderRadius: "var(--radius)", padding: "32px 24px",
          textAlign: "center", cursor: "pointer", transition: "border-color 0.15s",
        }}
      >
        <input
          ref={inputRef} type="file" style={{ display: "none" }}
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{file.name}</p>
            <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: "var(--text-2)" }}>Click or drag a file here</p>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>Max 50 MB</p>
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Price (USD)</label>
        <input
          type="number" value={price} required min="0.02" step="0.01"
          onChange={e => setPrice(e.target.value)}
        />
        {feeInfo && (
          <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
            You receive ${feeInfo.youGet.toFixed(4).replace(/\.?0+$/, "")} · {feeInfo.feeLabel}
          </p>
        )}
      </div>

      <div>
        <label style={{ fontSize: 12, color: "var(--text-2)", display: "block", marginBottom: 6 }}>Title</label>
        <input
          type="text" value={description}
          placeholder={file?.name ?? "My report, dataset…"}
          onChange={e => { setDesc(e.target.value); setTitleError(false); }}
          style={{ borderColor: titleError ? "var(--danger)" : undefined }}
        />
        {titleError && (
          <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>Title is required</p>
        )}
      </div>

      {uploading && (
        <div>
          <div style={{ height: 4, background: "var(--bg-3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "var(--accent)", transition: "width 0.2s",
            }} />
          </div>
          <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 6, textAlign: "center" }}>{progress}%</p>
        </div>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

      <button type="submit" className="btn-primary" disabled={uploading || !file || priceUnits < MIN_PRICE_UNITS}>
        {uploading ? "Uploading…" : "Upload and create pay link"}
      </button>
    </form>
  );
}
