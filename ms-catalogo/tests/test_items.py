import pytest
from fastapi.testclient import TestClient
import mongomock
from unittest.mock import patch

mock_client = mongomock.MongoClient()
# Use the same database name as the application
mock_db = mock_client["pujaz_catalogo"]
mock_collection = mock_db["articulos"]

with patch('pymongo.MongoClient', return_value=mock_client):
    from src.main import app

client = TestClient(app)

def setup_function():
    mock_collection.delete_many({})

def test_create_item_valid():
    response = client.post("/items", json={"name": "Silla", "description": "Silla de madera"})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Silla"
    assert "id" in data

def test_create_item_invalid():
    response = client.post("/items", json={"name": "Silla"})
    assert response.status_code == 422

def test_list_items():
    client.post("/items", json={"name": "Mesa", "description": "Mesa de centro"})
    client.post("/items", json={"name": "Silla", "description": "Silla de madera"})
    
    response = client.get("/items")
    assert response.status_code == 200
    assert len(response.json()) == 2

def test_search_items_with_results():
    client.post("/items", json={"name": "Mesa", "description": "Mesa de centro"})
    client.post("/items", json={"name": "Silla", "description": "Silla de madera"})
    
    response = client.get("/items?search=madera")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Silla"

def test_search_items_without_results():
    client.post("/items", json={"name": "Silla", "description": "Silla de madera"})
    
    response = client.get("/items?search=vidrio")
    assert response.status_code == 200
    assert len(response.json()) == 0

def test_get_item_detail_existing():
    create_response = client.post("/items", json={"name": "Sofa", "description": "Sofa comodo"})
    item_id = create_response.json()["id"]
    
    response = client.get(f"/items/{item_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "Sofa"

def test_get_item_detail_not_found():
    response = client.get("/items/60d5ec49f05788f4b0000000")
    assert response.status_code == 404
