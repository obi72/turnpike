"use client";

import {
  useCurrentUser,
  useSignInWithEmail,
  useVerifyEmailOTP,
  useSignOut,
  useEvmAddress,
} from "@coinbase/cdp-hooks";
import { useState } from "react";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // USDC on Base

export function useWallet() {
  const { user }            = useCurrentUser();
  const { evmAddress }      = useEvmAddress();
  const { signInWithEmail } = useSignInWithEmail();
  const { verifyEmailOTP }  = useVerifyEmailOTP();
  const { signOut }         = useSignOut();

  const [flowId, setFlowId]   = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Step 1 — send OTP
  async function login(email: string) {
    setLoading(true); setError(null);
    try {
      const { flowId } = await signInWithEmail({ email });
      setFlowId(flowId);
      setOtpSent(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Step 2 — verify OTP (wallet auto-created on first login)
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

  async function getUsdcBalance(): Promise<number> {
    if (!evmAddress) return 0;
    try {
      const res  = await fetch(
        `https://api.basescan.org/api?module=account&action=tokenbalance` +
        `&contractaddress=${USDC_ADDRESS}&address=${evmAddress}&tag=latest`,
      );
      const data = await res.json();
      return parseFloat(data.result ?? "0") / 1e6;
    } catch {
      return 0;
    }
  }

  async function checkAndTopup(thresholdUsd: number): Promise<{ needsTopup: boolean; balance: number }> {
    const balance = await getUsdcBalance();
    return { needsTopup: balance < thresholdUsd, balance };
  }

  return {
    user,
    address:    evmAddress,
    isLoggedIn: !!user,
    otpSent,
    loading,
    error,
    login,
    verifyOtp,
    logout:       signOut,
    getUsdcBalance,
    checkAndTopup,
  };
}
