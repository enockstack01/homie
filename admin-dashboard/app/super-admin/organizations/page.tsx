import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import type { Organization } from "@/lib/types";
import { CreateOrganizationForm } from "./CreateOrganizationForm";
import { OrganizationsTable } from "./OrganizationsTable";

export default async function OrganizationsPage() {
  let orgs: Organization[];
  try {
    orgs = await callBackend<Organization[]>("/v1/super-admin/organizations");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Organizations</h1>
        <CreateOrganizationForm />
      </div>
      <p className="-mt-3 text-xs text-foreground/40">
        &quot;Credit pool&quot; is credits you&apos;ve given the org that it hasn&apos;t
        allocated to a member yet - allocating moves credits out of this pool and into a
        member&apos;s own balance, so a low pool with well-funded members is normal, not a
        discrepancy.
      </p>

      <OrganizationsTable orgs={orgs} />
    </div>
  );
}
