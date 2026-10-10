import os
from pymongo import MongoClient

# MONGO_URI depends on environment (docker-compose sets it to mongodb://mongo-db:27017)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
client = MongoClient(MONGO_URI)
db = client["pujaz_catalogo"]
items_collection = db["articulos"]
