import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { callBackend } from "@/lib/backend";
import { Footer } from "@/components/Footer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TopProgressBar } from "@/components/TopProgressBar";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { Me } from "@/lib/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Homie Online",
  description: "Homie credit and usage administration",
};

const SUPER_ADMIN_NAV = [
  { href: "/super-admin/organizations", label: "Organizations" },
  { href: "/super-admin/users", label: "Users" },
  { href: "/super-admin/usage-logs", label: "Usage Logs" },
  { href: "/super-admin/credit-transactions", label: "Credit Transactions" },
  { href: "/super-admin/resources", label: "Resources" },
  { href: "/super-admin/account", label: "My Account" },
];

const NAV_BY_ROLE: Record<Me["role"], { href: string; label: string }[]> = {
  super_admin: SUPER_ADMIN_NAV,
  // Same portal as super_admin, including the Resources page (viewing platform
  // resources is allowed - it's changing them platform_admin can't do, enforced by the
  // backend and reflected in that page's own UI, not by hiding the nav link).
  platform_admin: SUPER_ADMIN_NAV,
  org_admin: [
    { href: "/org-admin", label: "Members" },
    { href: "/org-admin/usage-logs", label: "Usage Logs" },
  ],
  member: [{ href: "/member", label: "My Account" }],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { userId } = await auth();

  // Read once, server-side, so the very first rendered byte already carries the user's
  // explicit choice (see components/ThemeToggle.tsx) - no client-side flash of the other
  // theme while JS catches up. Anything other than exactly "light"/"dark" (never set
  // yet, or a stray cookie) is left undefined, which omits the data-theme attribute
  // entirely - globals.css's prefers-color-scheme media query is what applies then.
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get("theme")?.value;
  const theme = rawTheme === "light" || rawTheme === "dark" ? rawTheme : undefined;

  // Best-effort: the nav is a convenience, not the source of truth for access control
  // (every route/page re-checks role server-side via its own backend call) - if the
  // gateway is briefly unreachable, degrade to no nav links rather than crash the shell.
  let me: Me | null = null;
  if (userId) {
    try {
      me = await callBackend<Me>("/v1/me");
    } catch {
      me = null;
    }
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#005c3d",
          borderRadius: "0.5rem",
        },
        options: {
          logoImageUrl: "/homie-icon.png",
          logoPlacement: "inside",
        },
      }}
    >
      <html
        lang="en"
        data-theme={theme}
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-surface-muted text-foreground">
          <Suspense fallback={null}>
            <TopProgressBar />
          </Suspense>
          {userId && (
            <header className="bg-primary text-white shadow-sm">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
                <div className="flex items-center gap-8">
                  <Link href="/" className="flex items-center gap-2">
                    <Image
                      src="/homie-icon.png"
                      alt="Homie"
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-md"
                      priority
                    />
                    <span className="text-base font-semibold tracking-tight">Homie Online</span>
                  </Link>
                  {me && (
                    <nav className="flex items-center gap-5 text-sm font-medium">
                      <Link
                        href="/"
                        title="Home"
                        aria-label="Home"
                        className="flex items-center gap-1.5 text-white/80 transition-colors hover:text-accent"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                          <path d="M12 3.172 2.343 12h2.829v8h5v-6h3.656v6h5v-8h2.829L12 3.172Z" />
                        </svg>
                        Home
                      </Link>
                      {NAV_BY_ROLE[me.role].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="text-white/80 transition-colors hover:text-accent"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </nav>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {me && (
                    <span className="hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium capitalize text-white/90 sm:inline-block">
                      {me.role.replace("_", " ")}
                    </span>
                  )}
                  <ThemeToggle variant="header" />
                  <UserButton
                    appearance={{
                      elements: { avatarBox: "h-8 w-8" },
                    }}
                  />
                </div>
              </div>
            </header>
          )}
          {!userId && <ThemeToggle variant="floating" />}
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
          {!userId && <Footer />}
          <WhatsAppButton />
        </body>
      </html>
    </ClerkProvider>
  );
}
