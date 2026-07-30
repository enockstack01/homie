import { SignUp } from "@clerk/nextjs";
import { AuthPageShell } from "@/components/AuthPageShell";

/**
 * No account-type choice here - there is no standing "no organization" account type on
 * this platform (see backend/app/auth.py's role docstring), so every signup always lands
 * on /welcome next to register their organization (the mandatory step - see
 * app/welcome/page.tsx). forceRedirectUrl (not fallbackRedirectUrl) so that's guaranteed
 * regardless of any other redirect signal a protected-page bounce could attach here.
 *
 * No `routing`/`path` props - mounted under a `[[...sign-up]]` catch-all, Clerk infers
 * path-based routing from the URL automatically, letting its own multi-step flow (email
 * verification, the Google SSO round trip) push URLs like "/sign-up/verify-email-address"
 * or "/sign-up/sso-callback" under this same route without losing track of anything.
 * There's no type segment to lose anymore either, so unlike the previous chooser-based
 * version of this page, there's nothing here for Clerk's own internal navigation to race
 * against.
 */
export default function SignUpPage() {
  return (
    <AuthPageShell>
      <SignUp forceRedirectUrl="/welcome" />
    </AuthPageShell>
  );
}
