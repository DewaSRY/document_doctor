import { AuthBackdrop } from "@/components/auth/auth-backdrop";

export default async function ProtectedLayout({
  children,
}: LayoutProps<"/[locale]">) {
  return (
    <AuthBackdrop>
      <main>{children}</main>
    </AuthBackdrop>
  );
}
