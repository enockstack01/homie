import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import type { PlatformUser } from "@/lib/types";
import { UsersTable } from "./UsersTable";

export default async function UsersPage() {
  let users: PlatformUser[];
  try {
    users = await callBackend<PlatformUser[]>("/v1/super-admin/users");
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="text-sm text-foreground/50">
        Every account on the platform, in or out of an organization.
      </p>
      <UsersTable users={users} />
    </div>
  );
}
