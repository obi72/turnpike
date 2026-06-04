import { Suspense } from "react";
import UsersClient from "@/components/UsersClient";

export default function UsersPage() {
  return (
    <Suspense fallback={<p style={{ color: "var(--text-3)" }}>Loading…</p>}>
      <UsersClient />
    </Suspense>
  );
}
