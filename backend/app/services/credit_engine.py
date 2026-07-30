"""
Single source of truth for the margin/credit math. Every price the gateway ever charges
- shown to an admin, deducted after a call - flows through this module, and only this
module, so there is exactly one place that can get the 40% guarantee wrong.

Currency: 1 credit = $0.001 USD (1 USD = 1,000 credits) - fixed, per the blueprint.

The core fix over the original blueprint: that design checked `credit_balance > 0`
before calling Anthropic, then only checked whether the *actual* cost fit the balance
*after* the call already happened. A low-balance user whose response happened to be long
would cause the gateway to pay Anthropic in full and then fail to collect - a real margin
leak, not an edge case. Here, `plan_request_budget` is called BEFORE the Anthropic call:
it prices the (already-known) input tokens exactly, and caps the request's `max_tokens`
so the worst-case output cost can never exceed what's left of the user's balance. The
post-call deduction (see routes/chat.py) then only ever guards true concurrent-request
races, never this class of bug.
"""

from dataclasses import dataclass

CREDITS_PER_USD = 1000.0
MICRO = 1_000_000.0

# A request that couldn't even afford this many output tokens is rejected outright
# rather than sent to Anthropic for a response that would be truncated to near-nothing.
DEFAULT_MIN_OUTPUT_TOKENS = 50

# The platform's guaranteed minimum margin (see docs/BLUEPRINT.md Section 4/5) and the
# markup_multiplier that produces exactly it: margin = 1 - 1/multiplier, so
# multiplier = 1/(1-margin). Below this, a request is billed for less than it actually
# costs at Anthropic's own rate - a real loss, not just a thinner profit. This is the one
# place that number is derived, so seed_model_pricing.py and the live model-pricing edit
# endpoint (routes/super_admin.py's update_model_pricing) can't drift out of sync with
# each other about what "the guaranteed margin" actually is.
MINIMUM_MARGIN = 0.40
MINIMUM_MARKUP_MULTIPLIER = 1.0 / (1.0 - MINIMUM_MARGIN)


def usd_to_credits(usd: float) -> float:
    return usd * CREDITS_PER_USD


def credits_to_usd(credits: float) -> float:
    return credits / CREDITS_PER_USD


def margin_for_markup(markup_multiplier: float) -> float:
    """The fraction of billed revenue that's profit at this multiplier - the inverse of
    billed_rate_per_million's math. Used to validate an admin-supplied multiplier, not on
    the hot billing path (that only ever needs the multiplier itself)."""
    if markup_multiplier <= 0:
        raise ValueError("markup_multiplier must be positive")
    return 1.0 - (1.0 / markup_multiplier)


def assert_meets_minimum_margin(markup_multiplier: float) -> None:
    """Raises ValueError if this multiplier would charge users less than the platform's
    guaranteed minimum margin over Anthropic's own cost - the guardrail that keeps a
    super_admin (or a bad input) from silently turning a rate card into a loss. Call this
    on every path that lets a human set markup_multiplier; the billing math itself
    (billed_rate_per_million, plan_request_budget, compute_final_charge) trusts whatever
    is already stored, since it's meant to be validated once, at write time, not
    re-checked on every request."""
    margin = margin_for_markup(markup_multiplier)
    if margin < MINIMUM_MARGIN - 1e-9:
        raise ValueError(
            f"markup_multiplier {markup_multiplier:g} implies a {margin:.1%} margin, below "
            f"the platform's guaranteed minimum of {MINIMUM_MARGIN:.0%} "
            f"(requires markup_multiplier >= {MINIMUM_MARKUP_MULTIPLIER:.4f})"
        )


# An organization's own additional margin on top of Homie's already-marked-up price (see
# organizations.profit_margin_percent) - a THIRD layer, one level up from the
# Anthropic -> Homie markup above: Anthropic cost -> Homie's markup_multiplier (this
# module's MINIMUM_MARGIN-guaranteed platform margin) -> an org's own optional
# profit_margin_percent on what Homie already charges. Unlike the platform's own margin,
# there is no guaranteed minimum here - an organization can choose to earn nothing extra
# (0%) up to doubling what its members pay relative to Homie's own price (100%); it's the
# organization's own choice about its own credit pool, not a platform guarantee.
MIN_ORGANIZATION_MARGIN_PERCENT = 0.0
MAX_ORGANIZATION_MARGIN_PERCENT = 100.0


def assert_valid_organization_margin(margin_percent: float) -> None:
    """Raises ValueError outside [0, 100] - see MIN/MAX_ORGANIZATION_MARGIN_PERCENT above."""
    if not (MIN_ORGANIZATION_MARGIN_PERCENT <= margin_percent <= MAX_ORGANIZATION_MARGIN_PERCENT):
        raise ValueError(
            f"margin_percent must be between {MIN_ORGANIZATION_MARGIN_PERCENT:g} and "
            f"{MAX_ORGANIZATION_MARGIN_PERCENT:g}"
        )


def apply_organization_margin(credits: float, margin_percent: float) -> float:
    """The credits actually deducted from an organization member's own balance, once that
    organization's own margin is layered on top of `credits` (Homie's own already-priced
    cost for the request, from compute_final_charge/plan_request_budget below).
    margin_percent=0 (the default for every organization until an org_admin sets one)
    leaves credits unchanged - identical to a platform account with no organization at
    all."""
    return credits * (1.0 + margin_percent / 100.0)


def billed_rate_per_million(anthropic_rate_per_million: float, markup_multiplier: float) -> float:
    """The rate actually charged to the user, i.e. Anthropic's rate with the margin baked in."""
    return anthropic_rate_per_million * markup_multiplier


def token_cost_usd(tokens: int, rate_per_million: float) -> float:
    return (tokens * rate_per_million) / MICRO


@dataclass(frozen=True)
class RequestBudget:
    """Computed before the Anthropic call is made - never after."""

    input_cost_credits: float
    remaining_after_input_credits: float
    capped_max_tokens: int
    affordable: bool  # False => reject with 402 before calling Anthropic at all


def plan_request_budget(
    *,
    input_tokens: int,
    current_balance_credits: float,
    anthropic_input_per_m: float,
    anthropic_output_per_m: float,
    markup_multiplier: float,
    requested_max_tokens: int,
    min_output_tokens: int = DEFAULT_MIN_OUTPUT_TOKENS,
) -> RequestBudget:
    """
    Exact input cost is known up front (input_tokens comes from Anthropic's count_tokens
    endpoint, not an estimate), so it's charged first; whatever balance remains caps the
    request's max_tokens so the worst-case output cost is always coverable.
    """
    billed_input_rate = billed_rate_per_million(anthropic_input_per_m, markup_multiplier)
    billed_output_rate = billed_rate_per_million(anthropic_output_per_m, markup_multiplier)

    input_cost_usd = token_cost_usd(input_tokens, billed_input_rate)
    input_cost_credits = usd_to_credits(input_cost_usd)
    remaining_after_input_credits = current_balance_credits - input_cost_credits

    if remaining_after_input_credits <= 0 or billed_output_rate <= 0:
        return RequestBudget(
            input_cost_credits=input_cost_credits,
            remaining_after_input_credits=remaining_after_input_credits,
            capped_max_tokens=0,
            affordable=False,
        )

    remaining_after_input_usd = credits_to_usd(remaining_after_input_credits)
    affordable_output_tokens = int((remaining_after_input_usd / billed_output_rate) * MICRO)
    capped_max_tokens = min(requested_max_tokens, affordable_output_tokens)

    return RequestBudget(
        input_cost_credits=input_cost_credits,
        remaining_after_input_credits=remaining_after_input_credits,
        capped_max_tokens=capped_max_tokens,
        affordable=capped_max_tokens >= min_output_tokens,
    )


@dataclass(frozen=True)
class FinalCharge:
    raw_cost_usd: float
    billed_usd: float
    credits_to_deduct: float


def compute_final_charge(
    *,
    input_tokens: int,
    output_tokens: int,
    anthropic_input_per_m: float,
    anthropic_output_per_m: float,
    markup_multiplier: float,
) -> FinalCharge:
    """The actual post-call charge, once real output_tokens is known from the response."""
    raw_cost_usd = (
        token_cost_usd(input_tokens, anthropic_input_per_m)
        + token_cost_usd(output_tokens, anthropic_output_per_m)
    )

    billed_input_rate = billed_rate_per_million(anthropic_input_per_m, markup_multiplier)
    billed_output_rate = billed_rate_per_million(anthropic_output_per_m, markup_multiplier)
    billed_usd = token_cost_usd(input_tokens, billed_input_rate) + token_cost_usd(
        output_tokens, billed_output_rate
    )

    return FinalCharge(
        raw_cost_usd=raw_cost_usd,
        billed_usd=billed_usd,
        credits_to_deduct=usd_to_credits(billed_usd),
    )
