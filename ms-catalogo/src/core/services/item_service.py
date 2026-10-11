from typing import List, Optional
from src.infrastructure.db.item_repository import ItemRepository
from src.models.item import ItemCreate, ItemResponse

class ItemService:
    def __init__(self):
        self.repository = ItemRepository()

    def _map_to_response(self, doc: dict) -> ItemResponse:
        return ItemResponse(
            id=str(doc["_id"]),
            name=doc.get("name", ""),
            description=doc.get("description", ""),
            category=doc.get("category"),
            images=doc.get("images", []),
            documents=doc.get("documents", []),
            basePrice=doc.get("basePrice", 0.0)
        )

    def get_items(self, search: Optional[str] = None, ids: Optional[List[str]] = None) -> List[ItemResponse]:
        docs = self.repository.get_all(search, ids)
        return [self._map_to_response(doc) for doc in docs]

    def get_item_by_id(self, item_id: str) -> Optional[ItemResponse]:
        doc = self.repository.get_by_id(item_id)
        if doc:
            return self._map_to_response(doc)
        return None

    def create_item(self, item: ItemCreate) -> ItemResponse:
        doc = self.repository.create(item)
        return self._map_to_response(doc)
