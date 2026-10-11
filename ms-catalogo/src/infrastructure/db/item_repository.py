from bson import ObjectId
from typing import List, Optional
from src.infrastructure.db.mongo import items_collection
from src.models.item import ItemCreate

class ItemRepository:
    def get_all(self, search: Optional[str] = None, ids: Optional[List[str]] = None) -> List[dict]:
        query = {}
        if ids:
            object_ids = []
            for id_str in ids:
                try:
                    object_ids.append(ObjectId(id_str.strip()))
                except Exception:
                    pass
            if object_ids:
                query["_id"] = {"$in": object_ids}
        elif search:
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
