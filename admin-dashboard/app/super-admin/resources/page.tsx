import { BackendError, callBackend } from "@/lib/backend";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import type { AnthropicSpend, CreditRate, Me, ModelPricing } from "@/lib/types";
import { AnthropicKeyManager } from "./AnthropicKeyManager";
import { AnthropicSpendSummary } from "./AnthropicSpendSummary";
import { CreditRateCalculator } from "./CreditRateCalculator";
import { ModelPricingRow } from "./ModelPricingRow";

export default async function PlatformResourcesPage() {
  let me: Me;
  let models: ModelPricing[];
  let anthropicKey: string | null;
  let spend: AnthropicSpend;
  let creditRate: CreditRate;
  try {
    [me, models, { api_key: anthropicKey }, spend, creditRate] = await Promise.all([
      callBackend<Me>("/v1/me"),
      callBackend<ModelPricing[]>("/v1/super-admin/model-pricing"),
      callBackend<{ api_key: string | null }>("/v1/super-admin/anthropic-api-key"),
      callBackend<AnthropicSpend>("/v1/super-admin/anthropic-spend"),
      callBackend<CreditRate>("/v1/super-admin/credit-rate"),
    ]);
  } catch (err) {
    if (err instanceof BackendError) return <BackendErrorNotice error={err} />;
    throw err;
  }

  // platform_admin can see everything on this page - changing it is the one thing
  // that's actually restricted (backend: require_super_admin on the three mutating
  // routes; see docs/BLUEPRINT.md Section 2).
  const readOnly = me.role !== "super_admin";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Platform Resources</h1>
      {readOnly && (
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-xs text-foreground/60">
          You&apos;re viewing platform resources as a platform_admin - only a super_admin
          can change the rate card or the Anthropic API key.
        </p>
      )}

      <AnthropicKeyManager currentKey={anthropicKey} readOnly={readOnly} />
      <AnthropicSpendSummary spend={spend} />
      <CreditRateCalculator creditsPerUsd={creditRate.credits_per_usd} />

      <p className="text-sm text-foreground/50">
        The rate card every request is priced against. Only active tiers are usable from
        the Add-in/dashboard - keep at most one active tier per model_id (see
        scripts/flip_sonnet_rate.py for how a scheduled rate cutover switches tiers). The
        platform guarantees at least a <strong>{(creditRate.minimum_margin * 100).toFixed(0)}%
        margin</strong> (profit as a share of what the user is billed) on every request -
        that requires charging Anthropic&apos;s cost times at least{" "}
        <strong>{creditRate.minimum_markup_multiplier.toFixed(4)}×</strong> (equivalently, a{" "}
        {((creditRate.minimum_markup_multiplier - 1) * 100).toFixed(1)}% markup over cost - the
        same 40% margin, just expressed the other way). Anything below that multiplier is
        rejected.
      </p>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-foreground/60">
            <tr>
              <th className="px-4 py-2 font-medium">Model</th>
              <th className="px-4 py-2 font-medium">Pricing</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <ModelPricingRow
                key={m.id}
                model={m}
                minimumMarkupMultiplier={creditRate.minimum_markup_multiplier}
                readOnly={readOnly}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
