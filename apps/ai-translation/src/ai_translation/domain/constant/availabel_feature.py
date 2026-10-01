from dataclasses import dataclass, field
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
    features: list[Feature] = field(default_factory=list)

def list_available_features(translate: Callable[[str], str]) -> list[Feature]:
    return [
        Feature(
            group_id="documentAi",
            group_title=translate("feature.document_ai_title"),
            group_description=translate("feature.document_ai_description"),
            icon="translator",
            name=translate("feature.translation_name"),
            description=translate("feature.translation_description"),
            formats=["PDF", "DOCX"],
            limit=translate("feature.translation_limit"),
            output=translate("feature.translation_output"),
            isComingSoon=False,
        ),
        Feature(
            group_id="documentAi",
            group_title=translate("feature.document_ai_title"),
            group_description=translate("feature.document_ai_description"),
            icon="summarizer",
            name=translate("feature.summarizer_name"),
            description=translate("feature.summarizer_description"),
            formats=["PDF", "DOCX"],
            limit=translate("feature.summarizer_limit"),
            output=translate("feature.summarizer_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="documentAi",
            group_title=translate("feature.document_ai_title"),
            group_description=translate("feature.document_ai_description"),
            icon="extractor",
            name=translate("feature.extractor_name"),
            description=translate("feature.extractor_description"),
            formats=["PDF", "DOCX"],
            limit=translate("feature.extractor_limit"),
            output=translate("feature.extractor_output"),
            isComingSoon=True,
        ),

        # ─────────────────────────────────────────────
        # File Tools
        # ─────────────────────────────────────────────
        Feature(
            group_id="fileTools",
            group_title=translate("feature.file_tools_title"),
            group_description=translate("feature.file_tools_description"),
            icon="pdf",
            name=translate("feature.pdf_merge_split_name"),
            description=translate("feature.pdf_merge_split_description"),
            formats=["PDF"],
            limit=translate("feature.pdf_merge_split_limit"),
            output=translate("feature.pdf_merge_split_output"),
            isComingSoon=True,
        ),

        # ─────────────────────────────────────────────
        # Image Tools
        # ─────────────────────────────────────────────
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="resizer",
            name=translate("feature.resizer_name"),
            description=translate("feature.resizer_description"),
            formats=["JPG", "PNG", "WEBP"],
            limit=translate("feature.resizer_limit"),
            output=translate("feature.resizer_output"),
            isComingSoon=False,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="compressor",
            name=translate("feature.compressor_name"),
            description=translate("feature.compressor_description"),
            formats=["JPG", "PNG", "WEBP"],
            limit=translate("feature.compressor_limit"),
            output=translate("feature.compressor_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="converter",
            name=translate("feature.converter_name"),
            description=translate("feature.converter_description"),
            formats=["PNG", "JPG", "WEBP", "SVG"],
            limit=translate("feature.converter_limit"),
            output=translate("feature.converter_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="jpg-to-png",
            name=translate("feature.jpg_to_png_name"),
            description=translate("feature.jpg_to_png_description"),
            formats=["JPG", "PNG"],
            limit=translate("feature.jpg_to_png_limit"),
            output=translate("feature.jpg_to_png_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="jpg-to-webp",
            name=translate("feature.jpg_to_webp_name"),
            description=translate("feature.jpg_to_webp_description"),
            formats=["JPG", "WEBP"],
            limit=translate("feature.jpg_to_webp_limit"),
            output=translate("feature.jpg_to_webp_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="png-to-webp",
            name=translate("feature.png_to_webp_name"),
            description=translate("feature.png_to_webp_description"),
            formats=["PNG", "WEBP"],
            limit=translate("feature.png_to_webp_limit"),
            output=translate("feature.png_to_webp_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="jpg-to-svg",
            name=translate("feature.jpg_to_svg_name"),
            description=translate("feature.jpg_to_svg_description"),
            formats=["JPG", "SVG"],
            limit=translate("feature.jpg_to_svg_limit"),
            output=translate("feature.jpg_to_svg_output"),
            isComingSoon=True,
        ),
        Feature(
            group_id="imageTools",
            group_title=translate("feature.image_tools_title"),
            group_description=translate("feature.image_tools_description"),
            icon="png-to-svg",
            name=translate("feature.png_to_svg_name"),
            description=translate("feature.png_to_svg_description"),
            formats=["PNG", "SVG"],
            limit=translate("feature.png_to_svg_limit"),
            output=translate("feature.png_to_svg_output"),
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