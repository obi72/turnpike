"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet }           from "@/hooks/useWallet";
import { createPaymentClient } from "@/lib/x402-payment-client";

const PAY_BASE = "https://pay.trnpk.net";

type State = "idle" | "paying" | "success" | "error" | "needsLogin" | "needsFunds";

export default function PayPage() {
  const { slug } = useParams<{ slug: string }>();
  const { isLoggedIn, address, getUsdcBalance } = useWallet();

  const [state, setState]     = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");

  useEffect(() => {
    if (!isLoggedIn) { setState("needsLogin"); return; }
    triggerPayment();
  }, [isLoggedIn, address]);

  async function triggerPayment() {
    if (!address) return;
    setState("paying");

    // Pre-flight balance check
    const balance = await getUsdcBalance();
    if (balance < 0.01) {
      setState("needsFunds");
      setMessage("Your balance is too low. Please top up your wallet first.");
      return;
    }

    try {
      const client   = await createPaymentClient(address);
      const response = await client.pay(`${PAY_BASE}/${slug}`);

      if (response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("html") || response.redirected) {
          // URL paywall — open the content
          setState("success");
          setRedirectUrl(response.url);
          window.location.href = response.url;
        } else {
          // File download
          setState("success");
          const blob = await response.blob();
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href     = url;
          a.download = slug;
          a.click();
          URL.revokeObjectURL(url);
          setMessage("Your download has started.");
        }
      } else if (response.status === 402) {
        setState("error");
        setMessage("Payment could not be processed. Please try again.");
      } else {
        setState("error");
        setMessage(`Error ${response.status} — please contact the publisher.`);
      }
    } catch (e: any) {
      setState("error");
      setMessage(e.message ?? "Payment failed. Please try again.");
    }
  }

  const UI: Record<State, React.ReactNode> = {
    idle: <p style={{ color: "var(--text-2)" }}>Initializing…</p>,
    paying: (
      <div style={{ textAlign: "center" }}>
        <Spinner />
        <p style={{ marginTop: 16, color: "var(--text-2)" }}>Processing payment…</p>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>This takes about 2-3 seconds.</p>
      </div>
    ),
    success: (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>✓</p>
        <p style={{ fontSize: 16, fontWeight: 500 }}>Payment successful</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6 }}>
          {message || (redirectUrl ? "Redirecting…" : "Content unlocked.")}
        </p>
      </div>
    ),
    error: (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 40, marginBottom: 12 }}>✗</p>
        <p style={{ fontSize: 16, fontWeight: 500, color: "var(--danger)" }}>Payment failed</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 6 }}>{message}</p>
        <button onClick={triggerPayment} style={{ marginTop: 20 }}>Try again</button>
      </div>
    ),
    needsLogin: (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Sign in to pay</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>
          You need a Turnpike wallet to access this content.
        </p>
        <a href={`https://trnpk.net?redirect=pay.trnpk.net/${slug}`}>
          <button>Create wallet / Sign in</button>
        </a>
      </div>
    ),
    needsFunds: (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Low balance</p>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>{message}</p>
        <a href="https://trnpk.net"><button>Top up wallet</button></a>
      </div>
    ),
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex",
      alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      <div style={{ maxWidth: 360, width: "100%" }}>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20, textAlign: "center" }}>
          pay.trnpk.net/{slug}
        </p>
        {UI[state]}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 40, height: 40, margin: "0 auto",
      border: "3px solid var(--bg-3)",
      borderTopColor: "var(--accent)",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
