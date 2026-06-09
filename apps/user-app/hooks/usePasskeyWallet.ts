"use client";
import { useState } from "react";

const USDC_ADDRESS   = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const SESSION_KEY    = "trnpk_session";
const SESSION_TTL    = 24 * 60 * 60 * 1000; // 24 h
const DAILY_LIMIT    = 10_000_000;           // $10 in USDC units (6 decimals)

interface SessionData {
  privateKey:    `0x${string}`;
  walletAddress: string;
  expiresAt:     number;
  spentUsdc:     number;
  spentDate:     string; // YYYY-MM-DD
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: SessionData = JSON.parse(raw);
    if (Date.now() > s.expiresAt) { sessionStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

function saveSession(s: SessionData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

// Fixed salt — same on every device for the same passkey
async function getPrfSalt(): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const km  = await crypto.subtle.importKey("raw", enc.encode("turnpike-wallet-v1"), "HKDF", false, ["deriveBits"]);
  return crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("prf-salt") },
    km, 256
  );
}

function bufToBase64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, c => c.charCodeAt(0)).buffer;
}

async function prfToPrivateKey(prfOutput: ArrayBuffer): Promise<`0x${string}`> {
  return ("0x" + Array.from(new Uint8Array(prfOutput))
    .map(b => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}

async function webAuthnGet(credentialId: string): Promise<`0x${string}` | null> {
  const salt       = await getPrfSalt();
  const challenge  = crypto.getRandomValues(new Uint8Array(32));
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: [{ id: base64UrlToBuf(credentialId), type: "public-key" }],
      userVerification: "required",
      extensions: { prf: { eval: { first: salt } } } as any,
    },
  }) as PublicKeyCredential | null;
  if (!credential) return null;
  const prf = (credential.getClientExtensionResults() as any)?.prf?.results;
  if (!prf?.first) return null;
  return prfToPrivateKey(prf.first as ArrayBuffer);
}

export function usePasskeyWallet() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Setup (first time) ────────────────────────────────────────
  async function setupWallet(userEmail: string): Promise<{ address: string; credentialId: string } | null> {
    setLoading(true); setError(null);
    try {
      const salt      = await getPrfSalt();
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const userId    = new TextEncoder().encode(userEmail);

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
      if (!prfResults?.first) throw new Error(
        "Your browser does not support WebAuthn PRF. Please use Chrome 116+, Safari 17+, Firefox 119+, or Edge 116+."
      );

      const privateKey   = await prfToPrivateKey(prfResults.first as ArrayBuffer);
      const { privateKeyToAccount } = await import("viem/accounts");
      const account      = privateKeyToAccount(privateKey);
      const credentialId = bufToBase64Url(credential.rawId);

      // Start a session automatically after setup
      saveSession({
        privateKey, walletAddress: account.address,
        expiresAt: Date.now() + SESSION_TTL,
        spentUsdc: 0, spentDate: new Date().toISOString().slice(0, 10),
      });

      return { address: account.address, credentialId };
    } catch (e: any) {
      setError(e.message ?? "Wallet setup failed.");
      return null;
    } finally { setLoading(false); }
  }

  // ── Recover on new device ─────────────────────────────────────
  async function recoverWallet(credentialId: string): Promise<string | null> {
    setLoading(true); setError(null);
    try {
      const privateKey = await webAuthnGet(credentialId);
      if (!privateKey) throw new Error("Passkey authentication cancelled.");
      const { privateKeyToAccount } = await import("viem/accounts");
      const account = privateKeyToAccount(privateKey);
      saveSession({
        privateKey, walletAddress: account.address,
        expiresAt: Date.now() + SESSION_TTL,
        spentUsdc: 0, spentDate: new Date().toISOString().slice(0, 10),
      });
      return account.address;
    } catch (e: any) {
      setError(e.message ?? "Wallet recovery failed.");
      return null;
    } finally { setLoading(false); }
  }

  // ── Start session (PIN once → auto-pay for 24h up to $10) ─────
  async function startSession(credentialId: string): Promise<boolean> {
    setLoading(true); setError(null);
    try {
      const privateKey = await webAuthnGet(credentialId);
      if (!privateKey) throw new Error("Authentication cancelled.");
      const { privateKeyToAccount } = await import("viem/accounts");
      const account = privateKeyToAccount(privateKey);
      saveSession({
        privateKey, walletAddress: account.address,
        expiresAt: Date.now() + SESSION_TTL,
        spentUsdc: 0, spentDate: new Date().toISOString().slice(0, 10),
      });
      return true;
    } catch (e: any) {
      setError(e.message ?? "Authentication failed.");
      return false;
    } finally { setLoading(false); }
  }

  // ── Check if valid session exists for a wallet ────────────────
  function hasSession(walletAddress: string): boolean {
    const s = loadSession();
    return s !== null && s.walletAddress.toLowerCase() === walletAddress.toLowerCase();
  }

  // ── Sign x402 payment (uses session key, or asks for PIN) ─────
  async function signPayment({
    splitterAddress,
    price,
    credentialId,
  }: {
    splitterAddress: string;
    price: number;         // USDC units (6 decimals)
    credentialId: string;
  }): Promise<string | null> {
    setLoading(true); setError(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      let session = loadSession();

      // Reset daily counter if new day
      if (session && session.spentDate !== today) {
        session.spentUsdc = 0;
        session.spentDate = today;
        saveSession(session);
      }

      // Start new session if missing or daily limit would be exceeded
      if (!session || (session.spentUsdc + price) > DAILY_LIMIT) {
        const ok = await startSession(credentialId);
        if (!ok) return null;
        session = loadSession()!;
      }

      const { privateKeyToAccount } = await import("viem/accounts");
      const account      = privateKeyToAccount(session.privateKey);
      const nonce        = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2,"0")).join("")}` as `0x${string}`;
      const validBefore  = BigInt(Math.floor(Date.now() / 1000) + 300);

      const signature = await account.signTypedData({
        domain: {
          name: "USD Coin", version: "2",
          chainId: 8453,
          verifyingContract: USDC_ADDRESS,
        },
        types: {
          TransferWithAuthorization: [
            { name: "from",        type: "address" },
            { name: "to",          type: "address" },
            { name: "value",       type: "uint256" },
            { name: "validAfter",  type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce",       type: "bytes32"  },
          ],
        },
        primaryType: "TransferWithAuthorization",
        message: {
          from:        account.address,
          to:          splitterAddress as `0x${string}`,
          value:       BigInt(price),
          validAfter:  0n,
          validBefore,
          nonce,
        },
      });

      // Build x402 payment header
      const payment = {
        x402Version: 1,
        scheme: "exact",
        network: "base-mainnet",
        payload: {
          signature,
          authorization: {
            from:        account.address,
            to:          splitterAddress,
            value:       String(price),
            validAfter:  "0",
            validBefore: String(validBefore),
            nonce,
          },
        },
      };

      // Track spending
      session.spentUsdc += price;
      saveSession(session);

      return btoa(JSON.stringify(payment));
    } catch (e: any) {
      setError(e.message ?? "Payment signing failed.");
      return null;
    } finally { setLoading(false); }
  }

  return { setupWallet, recoverWallet, startSession, signPayment, hasSession, loading, error };
}
