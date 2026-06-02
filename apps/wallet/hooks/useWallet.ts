"use client";

import {
  useCurrentUser,
  useSignInWithEmail,
  useVerifyEmailOTP,
  useSignOut,
} from "@coinbase/cdp-hooks";
import { useState } from "react";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export function useWallet() {
  const { currentUser }       = useCurrentUser() as { currentUser: any };
  const { signInWithEmail }   = useSignInWithEmail() as { signInWithEmail: Function };
  const { verifyEmailOTP }    = useVerifyEmailOTP() as { verifyEmailOTP: Function };
  const { signOut }           = useSignOut() as { signOut: Function };

  const [flowId, setFlowId]   = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Derive EVM address from user's accounts
  const address: string | null =
    currentUser?.evmAccounts?.[0]?.address ??
    currentUser?.evmAccountObjects?.[0]?.address ??
    null;

  async function login(email: string) {
    setLoading(true); setError(null);
    try {
      const result = await signInWithEmail({ email });
      setFlowId(result.flowId);
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
    user:       currentUser,
    address,
    isLoggedIn: !!currentUser,
    otpSent,
    loading,
    error,
    login,
    verifyOtp,
    cancelOtp,
    logout:     signOut,
    getUsdcBalance,
  };
}
