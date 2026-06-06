"use client";
import { useState } from "react";

// Fixed salt — same on every device for the same passkey (deterministic wallet)
async function getPrfSalt(): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode("turnpike-wallet-v1"), "HKDF", false, ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("prf-salt") },
    keyMaterial, 256
  );
}

async function prfOutputToAddress(prfOutput: ArrayBuffer): Promise<string> {
  const { privateKeyToAccount } = await import("viem/accounts");
  const hex = ("0x" + Array.from(new Uint8Array(prfOutput))
    .map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  return privateKeyToAccount(hex).address;
}

function bufToBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

export function usePasskeyWallet() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setupWallet(userEmail: string): Promise<{ address: string; credentialId: string } | null> {
    setLoading(true); setError(null);
    try {
      const salt = await getPrfSalt();
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId = new TextEncoder().encode(userEmail);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "Turnpike", id: window.location.hostname },
          user: { id: userId, name: userEmail, displayName: userEmail },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          extensions: { prf: { eval: { first: salt } } } as any,
        },
      }) as PublicKeyCredential | null;

      if (!credential) throw new Error("Passkey creation cancelled.");

      const prfResults = (credential.getClientExtensionResults() as any)?.prf?.results;
      if (!prfResults?.first) {
        throw new Error(
          "Your browser does not support WebAuthn PRF. Please use Chrome 116+, Safari 17+, Firefox 119+, or Edge 116+."
        );
      }

      const address = await prfOutputToAddress(prfResults.first as ArrayBuffer);
      const credentialId = bufToBase64Url(credential.rawId);
      return { address, credentialId };
    } catch (e: any) {
      setError(e.message ?? "Wallet setup failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function recoverWallet(credentialId: string): Promise<string | null> {
    setLoading(true); setError(null);
    try {
      const salt = await getPrfSalt();
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      const credential = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{ id: base64UrlToBuf(credentialId), type: "public-key" }],
          userVerification: "required",
          extensions: { prf: { eval: { first: salt } } } as any,
        },
      }) as PublicKeyCredential | null;

      if (!credential) throw new Error("Passkey authentication cancelled.");

      const prfResults = (credential.getClientExtensionResults() as any)?.prf?.results;
      if (!prfResults?.first) throw new Error("PRF output not available.");

      return await prfOutputToAddress(prfResults.first as ArrayBuffer);
    } catch (e: any) {
      setError(e.message ?? "Wallet recovery failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { setupWallet, recoverWallet, loading, error };
}
