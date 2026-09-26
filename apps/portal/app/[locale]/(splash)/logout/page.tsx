import type { Metadata } from "next";
import { LogoutBanner } from "@/components/auth/logout-banner";

// Transient redirect-through page — never worth indexing.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LogoutPage() {
  return <LogoutBanner />;
}
