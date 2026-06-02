"use client";

import {
  signInWithEmail,
  verifyEmailOTP,
  signOut,
  getCurrentUserSync,
  onAuthStateChange,
} from "@coinbase/cdp-core";
import { useState, useEffect, useCallback } from "react";
import type { User } from "@coinbase/cdp-core";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function useWallet() {
  const [user, setUser]       = useState<User | null>(null);
  const [flowId, setFlowId]   = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    // Read initial user only client-side after SDK has initialized
    try { setUser(getCurrentUserSync()); } catch {}
    // Subscribe to auth state changes
    onAuthStateChange((u: User | null | undefined) => setUser(u ?? null));
  }, []);

  const address = user?.evmAccountObjects?.[0]?.address ?? null;

  async function login(email: string) {
    setLoading(true); setError(null);
    try {
      const { flowId: id } = await signInWithEmail({ email });
      setFlowId(id);
      setOtpSent(true);
    } catch (e: any) {
      setError(e.message ?? "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(otp: string) {
    if (!flowId) return;
    setLoading(true); setError(null);
    try {
      await verifyEmailOTP({ flowId, otp });
      setOtpSent(false);
      setFlowId(null);
    } catch {
      setError("Incorrect code — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function cancelOtp() {
    setOtpSent(false);
    setFlowId(null);
    setError(null);
  }

  async function logout() {
    await signOut();
  }

  async function getUsdcBalance(): Promise<number> {
    if (!address) return 0;
    try {
      const res  = await fetch(
        `https://api.basescan.org/api?module=account&action=tokenbalance` +
        `&contractaddress=${USDC_ADDRESS}&address=${address}&tag=latest`,
      );
      const data = await res.json();
      return parseFloat(data.result ?? "0") / 1e6;
    } catch {
      return 0;
    }
  }

  return {
    user,
    address,
    isLoggedIn: !!user,
    otpSent,
    loading,
    error,
    login,
    verifyOtp,
    cancelOtp,
    logout,
    getUsdcBalance,
  };
}
