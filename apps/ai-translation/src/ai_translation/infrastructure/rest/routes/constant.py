
import asyncio

from fastapi import APIRouter, File, Form, Request, UploadFile

router = APIRouter(prefix="/v1", tags=["documents"])
