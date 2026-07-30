"""
Targeted coverage for services/organizations.py - the human-readable org_id every
organization gets (see db.py's sparse unique index), generated fresh at creation and
backfilled lazily for any organization that predates the field.
"""

from unittest.mock import AsyncMock

from bson import Decimal128, ObjectId

from app.services.organizations import (
    _generate_unique_org_id,
    _slugify,
    create_organization_doc,
    ensure_org_id,
)
from tests.conftest import make_fake_db


def test_slugify_lowercases_and_replaces_non_alphanumerics():
    assert _slugify("Acme Surveys, LLC") == "acme_surveys_llc"


def test_slugify_collapses_repeated_separators_and_trims_edges():
    assert _slugify("  --Acme!!  Corp--  ") == "acme_corp"


def test_slugify_falls_back_to_org_when_name_has_no_alphanumerics():
    assert _slugify("!!!") == "org"


async def test_generate_unique_org_id_starts_with_the_slugified_name():
    organizations = AsyncMock()
    organizations.find_one.return_value = None  # no collision on the first attempt
    db = make_fake_db(organizations=organizations)

    org_id = await _generate_unique_org_id(db, "Acme Surveys")

    assert org_id.startswith("acme_surveys_")
    assert len(org_id) == len("acme_surveys_") + 6


async def test_generate_unique_org_id_retries_on_collision():
    """The random suffix collides once, then succeeds - all_ids-must-be-different is
    enforced by retrying with a fresh suffix, not by failing outright."""
    organizations = AsyncMock()
    organizations.find_one.side_effect = [{"org_id": "taken"}, None]
    db = make_fake_db(organizations=organizations)

    org_id = await _generate_unique_org_id(db, "Acme Surveys")

    assert org_id.startswith("acme_surveys_")
    assert organizations.find_one.await_count == 2


async def test_generate_unique_org_id_gives_up_after_max_attempts():
    organizations = AsyncMock()
    organizations.find_one.return_value = {"org_id": "always taken"}
    db = make_fake_db(organizations=organizations)

    try:
        await _generate_unique_org_id(db, "Acme Surveys")
        assert False, "expected RuntimeError"
    except RuntimeError:
        pass


async def test_create_organization_doc_returns_mongo_id_and_org_id():
    organizations = AsyncMock()
    organizations.find_one.return_value = None
    inserted = AsyncMock()
    inserted.inserted_id = ObjectId()
    organizations.insert_one.return_value = inserted
    db = make_fake_db(organizations=organizations)

    mongo_id, org_id = await create_organization_doc(db, "Acme Surveys")

    assert mongo_id == inserted.inserted_id
    assert org_id.startswith("acme_surveys_")
    doc = organizations.insert_one.call_args.args[0]
    assert doc["org_id"] == org_id
    assert doc["credit_balance"].to_decimal() == 0
    assert doc["profit_margin_percent"] == 0.0


async def test_ensure_org_id_returns_existing_value_without_touching_the_db():
    organizations = AsyncMock()
    db = make_fake_db(organizations=organizations)
    org = {"_id": ObjectId(), "name": "Acme", "org_id": "acme_abc123"}

    result = await ensure_org_id(db, org)

    assert result == "acme_abc123"
    organizations.find_one.assert_not_called()
    organizations.update_one.assert_not_called()


async def test_ensure_org_id_backfills_a_missing_value():
    org_id_val = ObjectId()
    organizations = AsyncMock()
    organizations.find_one.return_value = None  # no collision
    db = make_fake_db(organizations=organizations)
    org = {"_id": org_id_val, "name": "Legacy Org"}  # no org_id field at all

    result = await ensure_org_id(db, org)

    assert result.startswith("legacy_org_")
    update_call = organizations.update_one.call_args
    assert update_call.args[0] == {"_id": org_id_val}
    assert update_call.args[1]["$set"]["org_id"] == result
