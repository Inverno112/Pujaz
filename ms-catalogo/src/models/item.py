from pydantic import BaseModel, Field
from typing import Optional

class ItemCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)

class ItemResponse(BaseModel):
    id: str
    name: str
    description: str
