export type Role = "super_admin" | "platform_admin" | "org_admin" | "member";
export type UserStatus = "pending" | "active" | "banned" | "deleted";

export interface Me {
  id: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  organization_id: string | null;
  organization_name: string | null;
  pending_organization_name: string | null;
  has_api_key: boolean;
  credit_balance: number;
  preferred_model_id: string | null;
}

export interface AvailableModel {
  model_id: string;
  display_name: string;
  billed_input_credits_per_m: number;
  billed_output_credits_per_m: number;
}

export interface PlatformUser {
  id: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  organization_id: string | null;
  organization_name: string | null;
  /** Set only for someone invited by email who hasn't accepted yet (see
   * org_admin.add_member) - lets the super-admin org detail page show a complete member
   * list, not just confirmed members. */
  pending_organization_id: string | null;
  has_api_key: boolean;
  credit_balance: number;
}

export interface Organization {
  id: string;
  name: string;
  /** The organization's own human-readable id (e.g. "acme_surveys_ab12cd") - what a
   * prospective member types into the "Join an organization" form on /welcome to request
   * joining. Generated once at creation (or lazily backfilled for one that predates this
   * field) and never changes. */
  org_id: string;
  credit_balance: number;
  member_count: number;
  created_at: string;
  /** The organization's own additional margin on top of Homie's already-marked-up price
   * (0-100), read-only here - set self-service via org-admin's ProfitMarginForm, not
   * from the super-admin dashboard. See MyOrganization for the org_admin-facing type. */
  profit_margin_percent: number;
}

export interface MyOrganization {
  id: string;
  name: string;
  org_id: string;
  credit_balance: number;
  /** The organization's own additional margin on top of Homie's already-marked-up price
   * (0-100) - see backend/app/services/credit_engine.py's apply_organization_margin. 0
   * until an org_admin sets one. */
  profit_margin_percent: number;
}

export interface OrgMember {
  id: string;
  email: string | null;
  role: Role;
  status: UserStatus;
  has_api_key: boolean;
  credit_balance: number;
  invite_accepted: boolean;
}

export interface UsageLog {
  user_id?: string;
  /** null if the user account was hard-deleted after this log was written (usage_logs is
   * kept as audit/billing history and is never cleaned up on delete - see
   * super_admin.py's _hard_delete_user). */
  user_email?: string | null;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  credits_deducted: number;
  /** This organization's own retained profit within credits_deducted above (see
   * MyOrganization.profit_margin_percent) - only present on the org-admin and
   * super-admin usage-log views, not a member's own ("my-usage-logs" never includes
   * it). */
  org_margin_credits?: number;
  timestamp: string;
}

export interface CreditTransaction {
  target_collection: "users" | "organizations";
  target_id: string;
  granted_by_email: string | null;
  amount_usd_received: number;
  credits_granted: number;
  payment_note: string;
  created_at: string;
}

export interface ModelPricing {
  id: string;
  model_id: string;
  display_name: string;
  anthropic_input_per_m: number;
  anthropic_output_per_m: number;
  markup_multiplier: number;
  is_active: boolean;
}

export interface SpendTotals {
  anthropic_cost_usd: number;
  billed_to_users_usd: number;
  realized_margin_usd: number;
  request_count: number;
}

export interface AnthropicSpend {
  all_time: SpendTotals;
  last_30_days: SpendTotals;
  console_url: string;
}

export interface CreditRate {
  credits_per_usd: number;
  minimum_markup_multiplier: number;
  minimum_margin: number;
}
