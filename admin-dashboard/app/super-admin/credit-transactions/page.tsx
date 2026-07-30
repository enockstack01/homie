import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import type { CreditTransaction } from "@/lib/types";
import { CreditTransactionsTable } from "./CreditTransactionsTable";

export default async function CreditTransactionsPage() {
  let txns: CreditTransaction[];
  try {
    txns = await callBackend<CreditTransaction[]>("/v1/super-admin/credit-transactions");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Credit Transactions</h1>
      <p className="text-sm text-foreground/50">
        Every credit movement platform-wide: external grants (to an organization&apos;s
        pool, or directly to a user as a support override) and internal org-to-member
        allocations alike. Most recent 100 shown.
      </p>

      <CollapsibleSection title="Transactions" count={txns.length}>
        <CreditTransactionsTable txns={txns} />
      </CollapsibleSection>
    </div>
  );
}
