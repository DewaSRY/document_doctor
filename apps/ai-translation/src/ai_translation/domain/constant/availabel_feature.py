from dataclasses import dataclass
from typing import Callable


@dataclass
class Feature:
    group_id: str
    group_title: str
    group_description: str
    icon: str
    name: str
    description: str
    formats: list[str]
    limit: str
    output: str
    isComingSoon: bool = False

@dataclass
class FeatureGroup:
    id: str
    title: str
    description: str
    icon: str
    features: list[Feature] = []

def list_available_features(translate: Callable[[str], str]) -> list[Feature]:
    return [
        Feature(
            group_id="documentAi",
            group_title=translate("document_ai_title"),
            group_description=translate("document_ai_description"),
            icon="translator",
            name=translate("translation_name"),
            description=translate("translation_description"),
            formats=["PDF", "DOCX"],
            limit=translate("translation_limit"),
            output=translate("translation_output"),
            isComingSoon=False,
        ),
        Feature(
            group_id="documentAi",
            group_title=translate("document_ai_title"),
            group_description=translate("document_ai_description"),
            icon="summarizer",
            name=translate("summarizer_name"),
            description=translate("summarizer_description"),
            formats=["PDF", "DOCX"],
            limit=translate("summarizer_limit"),
            output=translate("summarizer_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="documentAi",
            group_title=translate("document_ai_title"),
            group_description=translate("document_ai_description"),
            icon="extractor",
            name=translate("extractor_name"),
            description=translate("extractor_description"),
            formats=["PDF", "DOCX"],
            limit=translate("extractor_limit"),
            output=translate("extractor_output"),
            isComingSoon=True,
        ),

        # ─────────────────────────────────────────────
        # File Tools
        # ─────────────────────────────────────────────
        Feature(
            group_id="fileTools",
            group_title=translate("file_tools_title"),
            group_description=translate("file_tools_description"),
            icon="pdf",
            name=translate("pdf_merge_split_name"),
            description=translate("pdf_merge_split_description"),
            formats=["PDF"],
            limit=translate("pdf_merge_split_limit"),
            output=translate("pdf_merge_split_output"),
            isComingSoon=True,
        ),

        # ─────────────────────────────────────────────
        # Image Tools
        # ─────────────────────────────────────────────
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="resizer",
            name=translate("resizer_name"),
            description=translate("resizer_description"),
            formats=["JPG", "PNG", "WEBP"],
            limit=translate("resizer_limit"),
            output=translate("resizer_output"),
            isComingSoon=False,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="compressor",
            name=translate("compressor_name"),
            description=translate("compressor_description"),
            formats=["JPG", "PNG", "WEBP"],
            limit=translate("compressor_limit"),
            output=translate("compressor_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="converter",
            name=translate("converter_name"),
            description=translate("converter_description"),
            formats=["PNG", "JPG", "WEBP", "SVG"],
            limit=translate("converter_limit"),
            output=translate("converter_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="jpg-to-png",
            name=translate("jpg_to_png_name"),
            description=translate("jpg_to_png_description"),
            formats=["JPG", "PNG"],
            limit=translate("jpg_to_png_limit"),
            output=translate("jpg_to_png_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="jpg-to-webp",
            name=translate("jpg_to_webp_name"),
            description=translate("jpg_to_webp_description"),
            formats=["JPG", "WEBP"],
            limit=translate("jpg_to_webp_limit"),
            output=translate("jpg_to_webp_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="png-to-webp",
            name=translate("png_to_webp_name"),
            description=translate("png_to_webp_description"),
            formats=["PNG", "WEBP"],
            limit=translate("png_to_webp_limit"),
            output=translate("png_to_webp_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="jpg-to-svg",
            name=translate("jpg_to_svg_name"),
            description=translate("jpg_to_svg_description"),
            formats=["JPG", "SVG"],
            limit=translate("jpg_to_svg_limit"),
            output=translate("jpg_to_svg_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("image_tools_title"),
            group_description=translate("image_tools_description"),
            icon="png-to-svg",
            name=translate("png_to_svg_name"),
            description=translate("png_to_svg_description"),
            formats=["PNG", "SVG"],
            limit=translate("png_to_svg_limit"),
            output=translate("png_to_svg_output"),
            isComingSoon=True,
        ),
    ]

def group_features(translate: Callable[[str], str]) -> list[FeatureGroup]:
    features= list_available_features(translate)
    groups: dict[str, FeatureGroup] = {}

    for feature in features:
        group = groups.get(feature.group_id)

        if group is None:
            group = FeatureGroup(
                id=feature.group_id,
                title=feature.group_title,
                description=feature.group_description,
                icon=feature.icon,
                features=[]
            )
            groups[feature.group_id] = group

        group.features.append(feature)

    return list(groups.values())