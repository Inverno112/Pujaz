from pydantic import BaseModel, Field
from typing import Optional, List

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    category: Optional[str] = None
    images: List[str] = []
    documents: List[str] = []
    basePrice: float = 0.0

class ItemResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = ""
    category: Optional[str] = None
    images: List[str] = []
    documents: List[str] = []
    basePrice: float = 0.0
