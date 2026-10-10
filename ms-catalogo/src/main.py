from fastapi import FastAPI
from src.api.routes import items

app = FastAPI(
    title="Microservicio de Catálogo - Pujaz",
    description="Maneja las fichas de los artículos, fotos y categorías",
    version="1.0.0"
)

app.include_router(items.router)

@app.get("/")
def read_root():
    return {"mensaje": "Microservicio de Catálogo funcionando 🚀"}

@app.get("/api/articulos")
def obtener_articulos():
    # Retaining old endpoint for backward compatibility just in case
    return [
        {"id": "a101", "titulo": "Mazda 3 2018", "categoria": "vehiculos"},
        {"id": "a102", "titulo": "Óleo paisaje andino", "categoria": "arte"}
    ]
