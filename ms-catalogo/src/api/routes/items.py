from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from src.models.item import ItemCreate, ItemResponse
from src.core.services.item_service import ItemService

router = APIRouter(prefix="/items", tags=["items"])

def get_item_service():
    return ItemService()

@router.get("", response_model=List[ItemResponse])
def get_items(search: Optional[str] = None, ids: Optional[str] = None, service: ItemService = Depends(get_item_service)):
    ids_list = ids.split(",") if ids else None
    return service.get_items(search, ids_list)

@router.get("/{item_id}", response_model=ItemResponse)
def get_item(item_id: str, service: ItemService = Depends(get_item_service)):
    item = service.get_item_by_id(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.post("", response_model=ItemResponse, status_code=201)
def create_item(item: ItemCreate, service: ItemService = Depends(get_item_service)):
    return service.create_item(item)
