from typing import Generic, TypeVar, List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType")
UpdateSchemaType = TypeVar("UpdateSchemaType")


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base repository with common CRUD operations."""

    def __init__(self, session: AsyncSession, model: type[ModelType]):
        self.session = session
        self.model = model

    async def create(self, obj_in: CreateSchemaType) -> ModelType:
        """Create a new record."""
        obj = self.model(**obj_in.model_dump())
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get_by_id(self, obj_id: int) -> Optional[ModelType]:
        """Get a record by ID."""
        return await self.session.get(self.model, obj_id)

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Get all records with pagination."""
        query = select(self.model).offset(skip).limit(limit)
        result = await self.session.execute(query)
        return result.scalars().all()

    async def update(
        self,
        obj_id: int,
        obj_in: UpdateSchemaType,
    ) -> Optional[ModelType]:
        """Update a record."""
        obj = await self.get_by_id(obj_id)
        if obj is None:
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(obj, field, value)

        self.session.add(obj)
        await self.session.flush()
        return obj

    async def delete(self, obj_id: int) -> bool:
        """Delete a record."""
        obj = await self.get_by_id(obj_id)
        if obj is None:
            return False

        await self.session.delete(obj)
        await self.session.flush()
        return True

    async def count(self) -> int:
        """Count total records."""
        query = select(func.count(self.model.id))
        result = await self.session.execute(query)
        return result.scalar() or 0
