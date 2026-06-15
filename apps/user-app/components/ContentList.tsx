"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { calcFee, MIN_PRICE_UNITS } from "@/lib/fee";
import Link from "next/link";

interface PayLink {
  slug: string;
  type: string;
  description: string;
  fileName?: string;
  price: string;
  providerGets: string;
  feeLabel: string;
  payUrl: string;
  secretUrl: string | null;
  priceUnits: number;
  daysUntilDelete: number | null;
}

export default function ContentList({ ownerId }: { ownerId: string }) {
  const [links, setLinks]     = useState<PayLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle]   = useState("");
  const [editPrice, setEditPrice]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [titleError, setTitleError] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { setLinks(await api.getPayLinks(ownerId)); }
    catch {}
    finally { setLoading(false); }
  }

  async function copyLink(url: string, slug: string) {
    await navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  }

  function startEdit(link: PayLink) {
    setEditing(link.slug);
    setEditTitle(link.description ?? "");
    setEditPrice((link.priceUnits / 1_000_000).toFixed(2));
    setTitleError(false);
  }

  function cancelEdit() {
    setEditing(null);
    setEditTitle("");
    setEditPrice("");
    setTitleError(false);
  }

  async function saveEdit(link: PayLink) {
    if (!editTitle.trim()) { setTitleError(true); return; }
    const priceUnits = Math.round(parseFloat(editPrice) * 1_000_000);
    if (isNaN(priceUnits) || priceUnits < MIN_PRICE_UNITS) return;

    setSaving(true);
    try {
      await api.updatePayLink(link.slug, ownerId, editTitle.trim(), priceUnits);
      const fee = calcFee(parseFloat(editPrice));
      setLinks(ls => ls.map(l =>
        l.slug === link.slug ? {
          ...l,
          description: editTitle.trim(),
          priceUnits,
          price: fee ? `$${parseFloat(editPrice)}` : l.price,
          providerGets: fee ? `$${fee.youGet.toFixed(4).replace(/\.?0+$/, "")}` : l.providerGets,
          feeLabel: fee ? fee.feeLabel : l.feeLabel,
        } : l
      ));
      setEditing(null);
    } catch {}
    finally { setSaving(false); }
  }

  async function deleteLink(slug: string) {
    if (!confirm("Delete this item? This cannot be undone.")) return;
    await api.deletePayLink(slug, ownerId);
    setLinks(l => l.filter(x => x.slug !== slug));
    setEditing(null);
  }

  const priceUsd   = parseFloat(editPrice);
  const feePreview = !isNaN(priceUsd) ? calcFee(priceUsd) : null;
  const priceError = !isNaN(priceUsd) && priceUsd > 0 && priceUsd < 0.02;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Inventory</h2>
        <Link href="/dashboard/publish">
          <button className="btn-primary" style={{ fontSize: 13, padding: "6px 14px" }}>+ New</button>
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading…</p>
      ) : links.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 14 }}>
          Nothing here yet.{" "}
          <Link href="/dashboard/publish" style={{ color: "var(--accent)" }}>Create your first</Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {links.map(link => (
            <div
              key={link.slug}
              style={{
                background: "var(--bg-2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "14px 16px",
              }}
            >
              {editing === link.slug ? (
                /* ── Edit mode ── */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Read-only info */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {link.secretUrl && (
                      <div>
                        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>Secret URL</p>
                        <p style={{
                          fontSize: 12, color: "var(--text-2)", fontFamily: "monospace",
                          background: "var(--bg-3)", padding: "6px 10px",
                          borderRadius: "var(--radius-sm)", wordBreak: "break-all",
                        }}>{link.secretUrl}</p>
                      </div>
                    )}
                    <div>
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>Pay link</p>
                      <p style={{
                        fontSize: 12, color: "var(--text-2)", fontFamily: "monospace",
                        background: "var(--bg-3)", padding: "6px 10px",
                        borderRadius: "var(--radius-sm)", wordBreak: "break-all",
                      }}>{link.payUrl}</p>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 3 }}>
                      Title
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={e => { setEditTitle(e.target.value); setTitleError(false); }}
                      placeholder="Give this link a title"
                      autoFocus
                      style={{ fontSize: 14, borderColor: titleError ? "var(--danger)" : undefined }}
                    />
                    {titleError && (
                      <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>Title is required</p>
                    )}
                  </div>

                  <div>
                    <label style={{ fontSize: 11, color: "var(--text-3)", display: "block", marginBottom: 3 }}>
                      Price (USD)
                    </label>
                    <input
                      type="number" min="0.02" step="0.01"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      style={{ fontSize: 14 }}
                    />
                    {feePreview && !priceError && (
                      <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>
                        You receive ${feePreview.youGet.toFixed(4).replace(/\.?0+$/, "")} · {feePreview.feeLabel}
                      </p>
                    )}
                    {priceError && (
                      <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 3 }}>Minimum price is $0.02</p>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => deleteLink(link.slug)}
                      style={{
                        fontSize: 12, padding: "5px 10px",
                        background: "transparent", border: "1px solid var(--danger)",
                        borderRadius: "var(--radius-sm)", color: "var(--danger)", cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: "5px 12px" }}
                        onClick={cancelEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        style={{ fontSize: 12, padding: "5px 12px" }}
                        onClick={() => saveEdit(link)}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Normal view ── */
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                        background: "transparent",
                        color: link.type === "file" ? "var(--accent)" : "var(--text-3)",
                        flexShrink: 0, textTransform: "uppercase",
                        display: "inline-block", textAlign: "left",
                      }}>
                        {link.type === "file" ? "Download" : "Link"}
                      </span>
                      {link.description || (
                        <span style={{ color: "var(--text-3)", fontStyle: "italic", fontWeight: 400 }}>
                          No title — click Edit
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-2)" }}>
                      {link.price} · you get {link.providerGets} ({link.feeLabel})
                    </p>
                    {link.daysUntilDelete !== null && link.daysUntilDelete <= 7 && (
                      <p style={{ fontSize: 11, color: "var(--warning)", marginTop: 2 }}>
                        ⚠ Expires in {link.daysUntilDelete}d — needs a download to stay active
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => copyLink(link.payUrl, link.slug)}
                      style={{
                        fontSize: 12, padding: "5px 10px",
                        background: "var(--bg-3)", border: "1px solid var(--border-2)",
                        borderRadius: "var(--radius-sm)", color: "var(--text-2)", cursor: "pointer",
                      }}
                    >
                      {copied === link.slug ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => startEdit(link)}
                      style={{
                        fontSize: 12, padding: "5px 10px",
                        background: "var(--bg-3)", border: "1px solid var(--border-2)",
                        borderRadius: "var(--radius-sm)", color: "var(--text-2)", cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
