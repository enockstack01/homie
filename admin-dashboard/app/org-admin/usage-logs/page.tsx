import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { UsageLogsTable } from "@/components/UsageLogsTable";
import type { UsageLog } from "@/lib/types";

export default async function OrgUsageLogsPage() {
  let logs: UsageLog[];
  try {
    logs = await callBackend<UsageLog[]>("/v1/org-admin/usage-logs");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Usage Logs</h1>
      <p className="text-sm text-foreground/50">Your organization&apos;s consumption - most recent 100 shown.</p>

      <CollapsibleSection title="Log entries" count={logs.length}>
        <UsageLogsTable logs={logs} userColumnLabel="Member" showOrgMarginColumn />
      </CollapsibleSection>
    </div>
  );
}
