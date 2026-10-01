
from typing import Literal
from fastapi import APIRouter, File, Form, Query, Request

from ai_translation.infrastructure.middleware import limiter
from ai_translation.domain.constant import  group_features
from ai_translation.infrastructure.core.i18n import (
    t, 
)
from ai_translation.infrastructure.rest.response_normalizer import (
    normalize_success_response,
)

router = APIRouter(prefix="/v1", tags=["constant"])


@router.get("/features")
@limiter.limit("100/minute")
async def get_features(
        request: Request, 
        lang: Literal["en", "id"] = Query("id", description="Response language"),
    ) -> dict:
    return normalize_success_response(
            data=group_features(lambda key: t(key, lang,)),
            message="Data fetched successfully",
            code=200,
    )
