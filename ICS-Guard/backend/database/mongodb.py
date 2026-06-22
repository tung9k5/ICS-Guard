from motor.motor_asyncio import AsyncIOMotorClient
from config.settings import settings

class MongoDB:
    client: AsyncIOMotorClient = None

db = MongoDB()

def get_database():
    return db.client[settings.MONGO_DB]

async def connect_to_mongo():
    db.client = AsyncIOMotorClient(settings.MONGO_URI)
    print("Connected to MongoDB!")

async def close_mongo_connection():
    if db.client:
        db.client.close()
        print("Closed MongoDB connection.")
