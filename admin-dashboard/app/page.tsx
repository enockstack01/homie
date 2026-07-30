import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import type { Me } from "@/lib/types";
import { LandingPage } from "./LandingPage";

const HOME_BY_ROLE: Record<Me["role"], string> = {
  super_admin: "/super-admin/organizations",
  platform_admin: "/super-admin/organizations",
  org_admin: "/org-admin",
  member: "/member",
};

export default async function Home() {
  // Signed-out visitors get the marketing page (see proxy.ts, which carves "/" out as
  // the one public route) - only a signed-in visit needs the backend at all, to figure
  // out which portal "/" should actually redirect into.
  const { userId } = await auth();
  if (!userId) {
    return <LandingPage />;
  }

  let me: Me;
  try {
    me = await callBackend<Me>("/v1/me");
  } catch (err) {
    if (err instanceof BackendError) {
      return <BackendErrorNotice error={err} />;
    }
    throw err;
  }

  // A plain member with no organization_id yet hasn't finished the mandatory
  // organization-registration step (see app/welcome/page.tsx) - there's no standing "no
  // organization" account type on this platform to send them to /member as instead (they
  // could land back here mid-onboarding via a bookmark or a closed-then-reopened tab).
  if (me.role === "member" && !me.organization_id) {
    redirect("/welcome");
  }

  redirect(HOME_BY_ROLE[me.role]);
}
