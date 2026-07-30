import { BackendError } from "@/lib/backend";

export function BackendErrorNotice({ error }: { error: BackendError }) {
  if (error.status === 403) {
    return (
      <div className="rounded-md border border-accent/40 bg-accent-soft/60 p-4 text-black/80">
        <p className="font-medium">Access denied</p>
        <p className="text-sm">
          You don&apos;t have access to this page. Please contact your organization admin
          or the system admin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      <p className="font-medium">Request failed ({error.status})</p>
      <p className="text-sm">{error.message}</p>
    </div>
  );
}
