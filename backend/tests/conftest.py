"""
Shared fake-Mongo plumbing for tests that exercise code written against
motor's async session/transaction API (`db.client.start_session()` /
`session.start_transaction()`) without a real MongoDB - see
app/services/credit_transfer.py and routes/chat.py for the pattern being faked.

Not mongomock: this install has no async (motor-compatible) variant, and the
functions under test only ever call a handful of specific methods
(find_one, find_one_and_update, insert_one, update_one) - a plain AsyncMock
per collection covers that surface without adding a new dependency.
"""

from unittest.mock import AsyncMock, MagicMock


class FakeTransaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False


class FakeSession:
    def start_transaction(self):
        return FakeTransaction()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False


class FakeClient:
    async def start_session(self):
        return FakeSession()


class FakeDb:
    """Mimics AsyncIOMotorDatabase just enough for tests: named collection
    attributes (each an AsyncMock) plus dict-style access for the
    `db[target_collection]` pattern credit_transfer.py uses, plus `.client`
    for the session/transaction pattern above."""

    def __init__(self, **collections: MagicMock):
        self.client = FakeClient()
        for name, mock in collections.items():
            setattr(self, name, mock)
        self._collections = collections

    def __getitem__(self, name: str):
        return self._collections[name]


def make_fake_db(**collections: MagicMock) -> FakeDb:
    return FakeDb(**collections)


class FakeCursor:
    """Mimics the chainable-then-iterable/awaitable shape of a Motor find() cursor:
    .sort()/.limit() return self, .to_list() is async, and it's also async-iterable - the
    two forms usage-log listing code uses (see routes/super_admin.py and
    routes/org_admin.py, which use .to_list(), vs. _batch_user_emails, which uses
    `async for`)."""

    def __init__(self, rows: list[dict]):
        self._rows = rows

    def sort(self, *args, **kwargs) -> "FakeCursor":
        return self

    def limit(self, *args, **kwargs) -> "FakeCursor":
        return self

    async def to_list(self, length: int | None = None) -> list[dict]:
        return self._rows

    def __aiter__(self):
        return self._aiter()

    async def _aiter(self):
        for row in self._rows:
            yield row


def make_fake_cursor(rows: list[dict]) -> FakeCursor:
    return FakeCursor(rows)
