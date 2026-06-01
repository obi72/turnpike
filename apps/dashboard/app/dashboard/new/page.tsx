"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { uploadFile, createRoute, getMe, getLimit, type PublisherProfile, type FileLimit } from "@/lib/api";
import { calculateFee, dollarToUnits, formatUsdc } from "@/lib/fee";

function NewContentInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const type         = (searchParams.get("type") ?? "file") as "file" | "url";

  const [profile, setProfile] = useState<PublisherProfile | null>(null);
  const [limit, setLimit]     = useState<FileLimit | null>(null);

  // File state
  const [file, setFile]       = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // URL state
  const [slug, setSlug]           = useState("");
  const [secretUrl, setSecretUrl] = useState("");
  const [desc, setDesc]           = useState("");

  // Shared
  const [price, setPrice]         = useState("0.10");
  const [progress, setProgress]   = useState(0);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ payUrl: string; display: any } | null>(null);
  const [error, setError]         = useState("");

  useEffect(() => {
    Promise.all([getMe(), getLimit()]).then(([p, l]) => { setProfile(p); setLimit(l); });
  }, []);

  // Live fee preview
  let fee: ReturnType<typeof calculateFee> | null = null;
  try {
    const units = dollarToUnits(price);
    if (units >= 50000) fee = calculateFee(units);
  } catch {}

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setError("");
    setLoading(true);
    setProgress(0);
    try {
      const priceUnits = dollarToUnits(price).toString();
      let res: any;

      if (type === "file") {
        if (!file) { setError("Please select a file"); setLoading(false); return; }
        res = await uploadFile({
          file, ownerId: profile.id, price: priceUnits,
          description: desc || file.name,
          providerWallet: profile.provider_wallet,
          onProgress: setProgress,
        });
      } else {
        if (!slug || !secretUrl) { setError("Slug and URL required"); setLoading(false); return; }
        res = await createRoute({
          slug, secretUrl, price: priceUnits,
          description: desc || slug,
          providerWallet: profile.provider_wallet,
        });
      }
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <DashboardLayout>
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>✓</p>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Paywall created!</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Share this link with your audience:</p>
            <div style={{
              background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)",
              padding: "12px 16px", fontFamily: "var(--mono)", fontSize: 13,
              wordBreak: "break-all", marginBottom: 16,
            }}>
              {result.payUrl}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(result.payUrl)} style={{ flex: 1 }}>
                Copy link
              </button>
              <button className="secondary" onClick={() => router.push("/dashboard")} style={{ flex: 1 }}>
                Dashboard
              </button>
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: "var(--text-2)" }}>
              <p>Buyer pays {result.display.price} · You receive {result.display.provider}</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>New Paywall</h2>
          <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", padding: 3 }}>
            {(["file", "url"] as const).map(t => (
              <button key={t} onClick={() => router.push(`/dashboard/new?type=${t}`)} style={{
                background: type === t ? "var(--bg)" : "transparent",
                color: type === t ? "var(--text)" : "var(--text-2)",
                boxShadow: type === t ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                padding: "6px 14px", fontSize: 13,
              }}>
                {t === "file" ? "Upload file" : "URL paywall"}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {type === "file" ? (
            <>
              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault(); setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) setFile(f);
                }}
                style={{
                  border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius)", padding: "40px 20px",
                  textAlign: "center", cursor: "pointer", marginBottom: 16,
                  background: dragOver ? "#f0f6ff" : "var(--bg)",
                }}
              >
                <input ref={fileRef} type="file" style={{ display: "none" }}
                  onChange={e => e.target.files?.[0] && setFile(e.target.files[0])} />
                {file ? (
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 500 }}>{file.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 4 }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {limit && (
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                        {limit.count}/{limit.max} slots used
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: 14, color: "var(--text-2)" }}>Drop file here or click to browse</p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Max 50 MB</p>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="label">Description (optional)</div>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={file?.name ?? "Describe your file"} />
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <div className="label">Pay link slug</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text-2)", whiteSpace: "nowrap" }}>pay.trnpk.net/</span>
                  <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="my-report" pattern="[a-z0-9-]+" required />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="label">Secret URL (hidden from buyers)</div>
                <input type="url" value={secretUrl} onChange={e => setSecretUrl(e.target.value)}
                  placeholder="https://your-site.com/secret-page" required />
                <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>
                  Rename your page to a random slug first so buyers can&apos;t guess it.
                </p>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div className="label">Description</div>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does the buyer get?" />
              </div>
            </>
          )}

          {/* Price */}
          <div style={{ marginBottom: 20 }}>
            <div className="label">Price (USD)</div>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              min="0.05" step="0.01" placeholder="0.10" required />
            {fee && (
              <div style={{
                marginTop: 10, background: "var(--bg-secondary)",
                borderRadius: "var(--radius-sm)", padding: "10px 12px",
                fontSize: 12, color: "var(--text-2)", display: "flex", justifyContent: "space-between",
              }}>
                <span>Platform fee: {fee.display.platformFee} ({fee.display.feeLabel})</span>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>
                  You receive: {fee.display.provider}
                </span>
              </div>
            )}
            {!fee && price && parseFloat(price) > 0 && (
              <p className="error-msg">Minimum price is $0.05</p>
            )}
          </div>

          {/* Progress */}
          {loading && type === "file" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: "var(--bg-secondary)", borderRadius: 4, height: 4, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "var(--accent)", transition: "width 0.2s" }} />
              </div>
              <p style={{ fontSize: 11, color: "var(--text-2)", marginTop: 4 }}>{progress}% uploaded</p>
            </div>
          )}

          {error && <p className="error-msg" style={{ marginBottom: 12 }}>{error}</p>}

          <button type="submit" disabled={loading || !fee} style={{ width: "100%" }}>
            {loading ? (type === "file" ? `Uploading… ${progress}%` : "Creating…") : "Create paywall"}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}

export default function NewContentPage() {
  return (
    <Suspense>
      <NewContentInner />
    </Suspense>
  );
}
