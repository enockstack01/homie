from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth import ROLE_MEMBER, get_current_user
from app.db import get_db

router = APIRouter(prefix="/v1/my-invitation", tags=["invitations"])


@router.post("/accept")
async def accept_invitation(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    """
    Moves pending_organization_id -> organization_id - the only place that ever sets a
    user's real organization_id from an org invite (see org_admin.add_member, which
    deliberately never sets it directly). No account was created without the person
    having asked for one somewhere, but joining a *specific* org is a separate,
    explicit choice they make here, not something an org_admin can do to them
    unilaterally by inviting an email address.
    """
    org_id = user.get("pending_organization_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No pending invitation.")

    org = await db.organizations.find_one({"_id": org_id})
    if not org:
        # The org was deleted between invite and accept - clear the dangling invite
        # rather than leaving it forever un-acceptable.
        await db.users.update_one({"_id": user["_id"]}, {"$unset": {"pending_organization_id": ""}})
        raise HTTPException(status_code=404, detail="That organization no longer exists.")

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"organization_id": org_id, "role": ROLE_MEMBER},
            "$unset": {"pending_organization_id": ""},
        },
    )
    return {"organization_id": str(org_id), "organization_name": org["name"]}


@router.post("/decline")
async def decline_invitation(
    user: dict = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> dict:
    if not user.get("pending_organization_id"):
        raise HTTPException(status_code=400, detail="No pending invitation.")

    await db.users.update_one({"_id": user["_id"]}, {"$unset": {"pending_organization_id": ""}})
    return {"declined": True}
