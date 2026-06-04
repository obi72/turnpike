"use client";

interface Props {
  title: string;
  description: string;
  targetEmail: string;
  confirmLabel?: string;
  severity: "danger" | "warning" | "success" | "blue";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const severityColor: Record<Props["severity"], string> = {
  danger:  "var(--danger)",
  warning: "var(--orange)",
  success: "var(--success)",
  blue:    "var(--accent)",
};

export default function ConfirmModal({
  title, description, targetEmail, confirmLabel = "Confirm",
  severity, onConfirm, onCancel, loading,
}: Props) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "var(--bg-2)", border: "1px solid var(--border-2)",
        borderRadius: "var(--radius)", padding: "28px 28px 24px",
        width: 420, maxWidth: "90vw",
      }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, marginBottom: 14 }}>{description}</p>
        <p style={{
          fontFamily: "monospace", fontSize: 13, background: "var(--bg-3)",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          padding: "6px 10px", marginBottom: 20, color: "var(--text)",
        }}>
          {targetEmail}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              background: severityColor[severity], color: "#fff",
              padding: "6px 18px", borderRadius: "var(--radius-sm)",
              fontSize: 13, fontWeight: 500,
            }}
          >
            {loading ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
