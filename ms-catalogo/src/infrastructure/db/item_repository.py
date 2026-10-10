from bson import ObjectId
from typing import List, Optional
from src.infrastructure.db.mongo import items_collection
from src.models.item import ItemCreate

class ItemRepository:
    def get_all(self, search: Optional[str] = None) -> List[dict]:
        query = {}
        if search:
            # Búsqueda insensible a mayúsculas/minúsculas en nombre o descripción
            query = {
                "$or": [
                    {"name": {"$regex": search, "$options": "i"}},
                    {"description": {"$regex": search, "$options": "i"}}
                ]
            }
        
        cursor = items_collection.find(query)
        return list(cursor)
    
    def get_by_id(self, item_id: str) -> Optional[dict]:
        try:
            doc = items_collection.find_one({"_id": ObjectId(item_id)})
            return doc
        except Exception:
            return None
            
    def create(self, item: ItemCreate) -> dict:
        item_dict = item.model_dump()
        result = items_collection.insert_one(item_dict)
        item_dict["_id"] = result.inserted_id
        return item_dict
