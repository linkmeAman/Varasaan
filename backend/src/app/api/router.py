from fastapi import APIRouter

from app.api.routes import auth, documents, exports, heartbeats, inventory, legal, packets, payments, testing, trusted_contacts

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(documents.router)
api_router.include_router(exports.router)
api_router.include_router(heartbeats.router)
api_router.include_router(inventory.router)
api_router.include_router(legal.router)
api_router.include_router(packets.router)
api_router.include_router(payments.router)
api_router.include_router(trusted_contacts.router)
api_router.include_router(testing.router)
