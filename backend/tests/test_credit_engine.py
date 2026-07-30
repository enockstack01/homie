import pytest

from app.services.credit_engine import (
    MINIMUM_MARGIN,
    MINIMUM_MARKUP_MULTIPLIER,
    assert_meets_minimum_margin,
    compute_final_charge,
    margin_for_markup,
    plan_request_budget,
    usd_to_credits,
    credits_to_usd,
    billed_rate_per_million,
    token_cost_usd,
)

# Claude Sonnet 5 (Standard) rates from the blueprint's Section 4.
INPUT_RATE = 3.00
OUTPUT_RATE = 15.00
MARKUP = 1.0 / 0.60  # exact 40% margin multiplier, ~1.6667


def test_usd_credits_roundtrip():
    assert usd_to_credits(1.0) == 1000.0
    assert credits_to_usd(1000.0) == 1.0


def test_billed_rate_bakes_in_margin():
    rate = billed_rate_per_million(INPUT_RATE, MARKUP)
    # (P - C) / P should be exactly 0.40
    margin = (rate - INPUT_RATE) / rate
    assert margin == pytest.approx(0.40, abs=1e-9)


def test_token_cost_usd_basic():
    # 1M tokens at $3/M = $3
    assert token_cost_usd(1_000_000, INPUT_RATE) == pytest.approx(3.00)


class TestPlanRequestBudget:
    def test_ample_balance_is_not_capped_below_requested(self):
        budget = plan_request_budget(
            input_tokens=1000,
            current_balance_credits=100_000,  # $100 worth
            anthropic_input_per_m=INPUT_RATE,
            anthropic_output_per_m=OUTPUT_RATE,
            markup_multiplier=MARKUP,
            requested_max_tokens=4096,
        )
        assert budget.affordable
        assert budget.capped_max_tokens == 4096

    def test_low_balance_caps_max_tokens_instead_of_letting_it_through(self):
        """
        The exact bug this module exists to prevent: a low-balance user requesting a
        large max_tokens must have it capped BEFORE the Anthropic call, not discovered
        as an uncollectible overage after.
        """
        # Enough for input plus a little output, nowhere near 4096 output tokens.
        low_balance = 10.0  # 10 credits = $0.01
        budget = plan_request_budget(
            input_tokens=100,
            current_balance_credits=low_balance,
            anthropic_input_per_m=INPUT_RATE,
            anthropic_output_per_m=OUTPUT_RATE,
            markup_multiplier=MARKUP,
            requested_max_tokens=4096,
        )
        assert budget.capped_max_tokens < 4096

        # And the cap must actually be affordable: recompute the real worst-case cost
        # of the capped response and confirm it does not exceed what was available.
        worst_case_output_cost_credits = usd_to_credits(
            token_cost_usd(
                budget.capped_max_tokens,
                billed_rate_per_million(OUTPUT_RATE, MARKUP),
            )
        )
        assert worst_case_output_cost_credits <= budget.remaining_after_input_credits + 1e-6

    def test_balance_too_low_for_even_the_floor_is_rejected_before_calling_anthropic(self):
        budget = plan_request_budget(
            input_tokens=100,
            current_balance_credits=0.05,  # essentially nothing
            anthropic_input_per_m=INPUT_RATE,
            anthropic_output_per_m=OUTPUT_RATE,
            markup_multiplier=MARKUP,
            requested_max_tokens=4096,
        )
        assert not budget.affordable

    def test_zero_or_negative_balance_after_input_is_rejected(self):
        # Input alone costs more than the user has.
        budget = plan_request_budget(
            input_tokens=10_000_000,
            current_balance_credits=5.0,
            anthropic_input_per_m=INPUT_RATE,
            anthropic_output_per_m=OUTPUT_RATE,
            markup_multiplier=MARKUP,
            requested_max_tokens=4096,
        )
        assert not budget.affordable
        assert budget.capped_max_tokens == 0


class TestMinimumMarginGuardrail:
    """Covers the guardrail super_admin's PATCH /model-pricing/{id} relies on
    (assert_meets_minimum_margin) to keep an admin edit from silently turning the rate
    card into a break-even or a loss."""

    def test_minimum_markup_multiplier_produces_exactly_the_minimum_margin(self):
        assert margin_for_markup(MINIMUM_MARKUP_MULTIPLIER) == pytest.approx(MINIMUM_MARGIN, abs=1e-9)

    def test_markup_of_one_means_zero_margin(self):
        # Billing at exactly Anthropic's own rate - break-even, not a loss, but still
        # below any positive guaranteed margin.
        assert margin_for_markup(1.0) == pytest.approx(0.0, abs=1e-9)

    def test_markup_below_one_means_a_real_loss_not_just_a_thinner_margin(self):
        assert margin_for_markup(0.5) < 0

    def test_assert_meets_minimum_margin_accepts_the_standard_rate(self):
        assert_meets_minimum_margin(MINIMUM_MARKUP_MULTIPLIER)  # must not raise

    def test_assert_meets_minimum_margin_accepts_a_higher_margin(self):
        assert_meets_minimum_margin(MINIMUM_MARKUP_MULTIPLIER * 2)  # must not raise

    @pytest.mark.parametrize("bad_multiplier", [1.0, 1.5, 0.9, 0.0001])
    def test_assert_meets_minimum_margin_rejects_anything_below_the_floor(self, bad_multiplier):
        with pytest.raises(ValueError, match="guaranteed minimum"):
            assert_meets_minimum_margin(bad_multiplier)

    def test_assert_meets_minimum_margin_rejects_non_positive_multiplier(self):
        with pytest.raises(ValueError, match="positive"):
            assert_meets_minimum_margin(0)


class TestComputeFinalCharge:
    def test_matches_worked_example_shape(self):
        charge = compute_final_charge(
            input_tokens=1820,
            output_tokens=640,
            anthropic_input_per_m=INPUT_RATE,
            anthropic_output_per_m=OUTPUT_RATE,
            markup_multiplier=MARKUP,
        )
        # Raw cost uses Anthropic's rate directly (no markup).
        expected_raw = token_cost_usd(1820, INPUT_RATE) + token_cost_usd(640, OUTPUT_RATE)
        assert charge.raw_cost_usd == pytest.approx(expected_raw)

        # Billed cost must be exactly 1/(1-0.40) times the raw cost (uniform markup).
        assert charge.billed_usd == pytest.approx(expected_raw * MARKUP)

        # 40% margin holds on the final charge too.
        margin = (charge.billed_usd - charge.raw_cost_usd) / charge.billed_usd
        assert margin == pytest.approx(0.40, abs=1e-9)
