"""
Targeted coverage for _spend_totals (routes/super_admin.py) - the Anthropic-cost-vs-billed
tracking a super_admin uses to gauge runway against their real Anthropic Console balance
(which Anthropic has no API to fetch directly - see get_anthropic_spend's own docstring).
db.usage_logs.aggregate(...) returns a cursor synchronously in motor; only cursor.to_list
is async, so that's what's faked here rather than reusing the find_one/find_one_and_update
AsyncMock pattern from tests/conftest.py.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import Decimal128

from app.routes.super_admin import _spend_totals
from tests.conftest import make_fake_db


def _fake_aggregate_result(rows: list[dict]) -> MagicMock:
    usage_logs = MagicMock()
    cursor = MagicMock()
    cursor.to_list = AsyncMock(return_value=rows)
    usage_logs.aggregate = MagicMock(return_value=cursor)
    return usage_logs


async def test_spend_totals_computes_margin_from_raw_and_billed_cost():
    usage_logs = _fake_aggregate_result(
        [{"raw_cost_usd": Decimal128("10.00"), "billed_usd": Decimal128("16.67"), "request_count": 42}]
    )
    db = make_fake_db(usage_logs=usage_logs)

    result = await _spend_totals(db, {})

    assert result["anthropic_cost_usd"] == 10.0
    assert result["billed_to_users_usd"] == 16.67
    assert result["realized_margin_usd"] == pytest.approx(6.67, abs=1e-4)
    assert result["request_count"] == 42


async def test_spend_totals_defaults_to_zero_when_no_usage_yet():
    """A brand-new platform (or a 30-day window with no requests) has no matching
    $group document at all, not a zero-valued one - must not crash on an empty result."""
    usage_logs = _fake_aggregate_result([])
    db = make_fake_db(usage_logs=usage_logs)

    result = await _spend_totals(db, {})

    assert result == {
        "anthropic_cost_usd": 0.0,
        "billed_to_users_usd": 0.0,
        "realized_margin_usd": 0.0,
        "request_count": 0,
    }


async def test_spend_totals_passes_match_filter_through_to_aggregate():
    usage_logs = _fake_aggregate_result([])
    db = make_fake_db(usage_logs=usage_logs)
    match = {"timestamp": {"$gte": "some-cutoff"}}

    await _spend_totals(db, match)

    pipeline = usage_logs.aggregate.call_args.args[0]
    assert pipeline[0] == {"$match": match}
