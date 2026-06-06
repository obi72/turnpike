"use client";
import { useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

async function getPrfSalt(): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode("turnpike-wallet-v1"), "HKDF", false, ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("prf-salt") },
    keyMaterial, 256
  );
  return new Uint8Array(bits);
}

async function prfOutputToAddress(prfOutput: ArrayBuffer): Promise<string> {
  const { privateKeyToAccount } = await import("viem/accounts");
  const hex = ("0x" + Array.from(new Uint8Array(prfOutput))
    .map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  return privateKeyToAccount(hex).address;
}

function toBase64Url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function usePasskeyWallet() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setupWallet(userEmail: string): Promise<{ address: string; credentialId: string } | null> {
    setLoading(true); setError(null);
    try {
      const salt = await getPrfSalt();
      const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

      const registration = await startRegistration({
        optionsJSON: {
          challenge,
          rp: { name: "Turnpike", id: window.location.hostname },
          user: {
            id: toBase64Url(new TextEncoder().encode(userEmail)),
            name: userEmail,
            displayName: userEmail,
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: { residentKey: "required", userVerification: "required" },
          extensions: { prf: { eval: { first: toBase64Url(salt) } } } as any,
        },
      });

      const prfResult = (registration as any).clientExtensionResults?.prf?.results?.first;
      if (!prfResult) {
        throw new Error(
          "Your browser does not support WebAuthn PRF. Please use Chrome 116+, Safari 17+, Firefox 119+, or Edge 116+."
        );
      }

      const prfBytes = Uint8Array.from(atob(prfResult.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      const address = await prfOutputToAddress(prfBytes.buffer);
      return { address, credentialId: registration.id };
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
      const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));

      const authentication = await startAuthentication({
        optionsJSON: {
          challenge,
          rpId: window.location.hostname,
          allowCredentials: [{ id: credentialId, type: "public-key" }],
          userVerification: "required",
          extensions: { prf: { eval: { first: toBase64Url(salt) } } } as any,
        },
      });

      const prfResult = (authentication as any).clientExtensionResults?.prf?.results?.first;
      if (!prfResult) throw new Error("PRF output not available.");

      const prfBytes = Uint8Array.from(atob(prfResult.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
      return await prfOutputToAddress(prfBytes.buffer);
    } catch (e: any) {
      setError(e.message ?? "Wallet recovery failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { setupWallet, recoverWallet, loading, error };
}
