import type { BadgeVariant } from "./Badge";
import type { Role, UserStatus } from "@/lib/types";

export const STATUS_VARIANT: Record<UserStatus, BadgeVariant> = {
  active: "success",
  pending: "warning",
  banned: "danger",
  deleted: "danger",
};

export const ROLE_VARIANT: Record<Role, BadgeVariant> = {
  super_admin: "info",
  // Same tier as super_admin (identical dashboard access, minus platform-resource
  // mutations) - same badge color is intentional, the role label text itself is what
  // tells the two apart.
  platform_admin: "info",
  org_admin: "success",
  member: "neutral",
};
