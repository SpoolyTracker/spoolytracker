from dataclasses import dataclass
from math import ceil, sqrt
from urllib.parse import quote_plus

from src.replenishment.models import ColorCandidate, ReplenishmentResponse, ReplenishmentSuggestion
from src.tools.models import StockItem


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    countries: tuple[str, ...]
    search_url: str


PROVIDERS = (
    Provider(
        id="atome3d-fr",
        name="Atome3D",
        countries=("FR", "BE", "LU", "CH", "MC"),
        search_url="https://www.atome3d.com/search?q={query}",
    ),
    Provider(
        id="bambulab-eu",
        name="Bambu Lab EU",
        countries=("FR", "BE", "LU", "DE", "ES", "IT", "NL", "PT", "AT"),
        search_url="https://eu.store.bambulab.com/search?q={query}",
    ),
    Provider(
        id="amazon-fr",
        name="Amazon France",
        countries=("FR", "BE", "LU", "MC"),
        search_url="https://www.amazon.fr/s?k={query}",
    ),
    Provider(
        id="3djake-fr",
        name="3DJake France",
        countries=("FR", "BE", "LU", "CH", "MC"),
        search_url="https://www.3djake.fr/search?keyword={query}",
    ),
    Provider(
        id="amazon-us",
        name="Amazon US",
        countries=("US",),
        search_url="https://www.amazon.com/s?k={query}",
    ),
    Provider(
        id="matterhackers-us",
        name="MatterHackers",
        countries=("US",),
        search_url="https://www.matterhackers.com/store/c/3d-printer-filament?search={query}",
    ),
    Provider(
        id="bambulab-us",
        name="Bambu Lab US",
        countries=("US", "CA"),
        search_url="https://us.store.bambulab.com/search?q={query}",
    ),
)

DEFAULT_COUNTRY = "FR"
FALLBACK_COUNTRIES = {"FR", "US"}
COLOR_ALIASES: dict[str, tuple[str, ...]] = {
    "black": ("black", "noir", "jet black", "charcoal"),
    "blue": ("blue", "bleu", "cobalt", "navy"),
    "red": ("red", "rouge", "scarlet"),
    "white": ("white", "blanc", "natural"),
    "green": ("green", "vert"),
    "gray": ("gray", "grey", "gris", "silver"),
    "yellow": ("yellow", "jaune"),
    "orange": ("orange",),
    "purple": ("purple", "violet"),
}

COLOR_HEX = {
    "black": "#111111",
    "blue": "#1F4FFF",
    "red": "#D72638",
    "white": "#F4F4F4",
    "green": "#1E8F45",
    "gray": "#808080",
    "yellow": "#FFD23F",
    "orange": "#F97316",
    "purple": "#7C3AED",
}


class ReplenishmentService:
    def __init__(self, stock_items: list[StockItem]) -> None:
        self.stock_items = stock_items

    def suggest_for_item(
        self,
        item_id: str,
        country: str | None = None,
        max_results: int = 8,
    ) -> ReplenishmentResponse:
        item = self._find_item(item_id)
        normalized_country = _normalize_country(country) or DEFAULT_COUNTRY
        providers = _providers_for_country(normalized_country)
        colors = self._color_candidates(item)
        quantity_kg = max(1, ceil((item.weight_initial_g or 1000) / 1000))

        suggestions: list[ReplenishmentSuggestion] = []
        compatible_providers = [
            provider for provider in providers if _provider_supports_item(provider, item)
        ]
        for provider_index, provider in enumerate(compatible_providers):
            for color_index, color in enumerate(colors):
                score = max(
                    0,
                    round(
                        100
                        - provider_index * 3
                        - color_index * 4
                        - (100 - color.score)
                        - _provider_query_penalty(provider, item)
                    ),
                )
                relevance = (
                    "exact" if color.score >= 98 else "close_color" if color.score >= 72 else "fallback"
                )
                query = _build_query(item, color.name, quantity_kg, provider)
                suggestions.append(
                    ReplenishmentSuggestion(
                        provider_id=provider.id,
                        provider_name=provider.name,
                        country=normalized_country,
                        title=query,
                        url=provider.search_url.format(query=quote_plus(query)),
                        score=score,
                        relevance=relevance,
                        query=query,
                        matched_color=color,
                        reasons=_build_reasons(item, color, relevance, provider),
                    )
                )

        suggestions.sort(key=lambda suggestion: suggestion.score, reverse=True)
        return ReplenishmentResponse(
            item_id=item.id,
            country=normalized_country,
            quantity_kg=quantity_kg,
            suggestions=suggestions[: max(1, min(max_results, 20))],
        )

    def _find_item(self, item_id: str) -> StockItem:
        for item in self.stock_items:
            if item.id == item_id:
                return item
        raise ValueError("Stock item not found")

    def _color_candidates(self, item: StockItem) -> list[ColorCandidate]:
        requested_name = item.color_name or item.color
        requested_hex = _normalize_hex(item.color_hex)
        canonical = _canonical_color(requested_name)
        exact = ColorCandidate(
            name=requested_name,
            hex=requested_hex or COLOR_HEX.get(canonical or ""),
            distance=0,
            score=100,
        )

        alternatives: list[ColorCandidate] = []
        if canonical:
            for alias in COLOR_ALIASES[canonical]:
                if _normalize_text(alias) == _normalize_text(requested_name):
                    continue
                alternatives.append(
                    ColorCandidate(
                        name=alias.title(),
                        hex=COLOR_HEX.get(canonical),
                        distance=0 if requested_hex is None else None,
                        score=92,
                    )
                )

        if requested_hex:
            for name, hex_value in COLOR_HEX.items():
                if name == canonical:
                    continue
                distance = _color_distance(requested_hex, hex_value)
                alternatives.append(
                    ColorCandidate(
                        name=name.title(),
                        hex=hex_value,
                        distance=distance,
                        score=_score_distance(distance),
                    )
                )

        deduped: list[ColorCandidate] = []
        for candidate in [exact, *sorted(alternatives, key=lambda item: item.score, reverse=True)]:
            if not any(_normalize_text(existing.name) == _normalize_text(candidate.name) for existing in deduped):
                deduped.append(candidate)
        return deduped[:4]


def country_from_headers(headers: dict[str, str] | None) -> str | None:
    if not headers:
        return None
    for key in (
        "cf-ipcountry",
        "x-vercel-ip-country",
        "cloudfront-viewer-country",
        "x-country-code",
        "x-geo-country",
    ):
        value = headers.get(key)
        country = _normalize_country(value)
        if country:
            return country
    return None


def _providers_for_country(country: str) -> list[Provider]:
    providers = [provider for provider in PROVIDERS if country in provider.countries]
    if providers:
        return providers
    return [
        provider
        for provider in PROVIDERS
        if any(provider_country in FALLBACK_COUNTRIES for provider_country in provider.countries)
    ]


def _provider_supports_item(provider: Provider, item: StockItem) -> bool:
    brand = _normalize_text(item.brand)
    if provider.id.startswith("bambulab"):
        return brand == "bambu lab"
    return True


def _provider_query_penalty(provider: Provider, item: StockItem) -> int:
    if item.material_type and not _provider_uses_material_type(provider, item):
        return 6
    return 0


def _provider_uses_material_type(provider: Provider, item: StockItem) -> bool:
    if not item.material_type:
        return False
    if provider.id == "atome3d-fr":
        return _normalize_text(item.brand) == "bambu lab"
    return True


def _build_query(item: StockItem, color_name: str, quantity_kg: int, provider: Provider) -> str:
    brand = _clean_search_term(item.brand)
    material = _clean_search_term(item.material)
    material_type = _clean_search_term(item.material_type)
    color = _provider_color_name(color_name, provider)
    diameter = "1,75 mm" if provider.id.endswith("-fr") or provider.id == "atome3d-fr" else "1.75mm"
    weight = f"{quantity_kg} kg" if provider.id.endswith("-fr") or provider.id == "atome3d-fr" else f"{quantity_kg}kg"

    if provider.id == "atome3d-fr":
        atome_material_type = material_type if _provider_uses_material_type(provider, item) else None
        parts = [brand, material, atome_material_type, color, diameter, weight]
    elif provider.id == "3djake-fr":
        parts = [brand, material, material_type, color, diameter, "1000 g"]
    else:
        parts = [brand, material, material_type, color, diameter, weight, "filament"]

    if provider.id.startswith("amazon"):
        excluded_brands = ["elegoo", "sunlu", "esun", "anycubic", "raise3d", "rosa3d"]
        current_brand_tokens = set((_normalize_text(brand or "")).split())
        for excluded_brand in excluded_brands:
            if excluded_brand not in current_brand_tokens:
                parts.append(f"-{excluded_brand}")

    return " ".join(part for part in parts if part)


def _clean_search_term(value: str | None) -> str | None:
    cleaned = (value or "").replace('"', " ").replace("'", " ").strip()
    cleaned = " ".join(cleaned.split())
    return cleaned or None


def _provider_color_name(color_name: str, provider: Provider) -> str | None:
    color = _clean_search_term(color_name)
    if not color:
        return None
    if provider.id == "atome3d-fr":
        canonical = _canonical_color(color)
        bilingual = {
            "black": "Noir Black",
            "blue": "Bleu Blue",
            "red": "Rouge Red",
            "white": "Blanc White",
            "green": "Vert Green",
            "gray": "Gris Gray",
            "yellow": "Jaune Yellow",
            "orange": "Orange",
            "purple": "Violet Purple",
        }
        return bilingual.get(canonical or "", color)
    if provider.id.endswith("-fr"):
        canonical = _canonical_color(color)
        french = {
            "black": "Noir",
            "blue": "Bleu",
            "red": "Rouge",
            "white": "Blanc",
            "green": "Vert",
            "gray": "Gris",
            "yellow": "Jaune",
            "orange": "Orange",
            "purple": "Violet",
        }
        return french.get(canonical or "", color)
    return color


def _build_reasons(
    item: StockItem,
    color: ColorCandidate,
    relevance: str,
    provider: Provider,
) -> list[str]:
    reasons = [
        f"Marque conservee: {item.brand}",
        f"Matiere conservee: {item.material}",
    ]
    if _provider_uses_material_type(provider, item):
        reasons.append(f"Type conserve: {item.material_type}")
    elif item.material_type:
        reasons.append(f"Type non force chez ce provider: {item.material_type}")
    if relevance == "exact":
        reasons.append(f"Couleur exacte: {color.name}")
    elif relevance == "close_color":
        reasons.append(f"Couleur proche: {color.name}")
    else:
        reasons.append(f"Couleur de secours: {color.name}")
    return reasons


def _canonical_color(name: str | None) -> str | None:
    normalized = _normalize_text(name or "")
    for canonical, aliases in COLOR_ALIASES.items():
        if normalized in {_normalize_text(alias) for alias in aliases}:
            return canonical
    return None


def _normalize_country(country: str | None) -> str | None:
    normalized = (country or "").strip().upper()
    return normalized if len(normalized) == 2 and normalized.isalpha() else None


def _normalize_hex(value: str | None) -> str | None:
    normalized = (value or "").strip().lstrip("#")
    if len(normalized) == 6 and all(char in "0123456789abcdefABCDEF" for char in normalized):
        return f"#{normalized.upper()}"
    return None


def _color_distance(hex_a: str, hex_b: str) -> float:
    a = _rgb(hex_a)
    b = _rgb(hex_b)
    return sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)


def _rgb(hex_value: str) -> tuple[int, int, int]:
    normalized = _normalize_hex(hex_value)
    if normalized is None:
        return (0, 0, 0)
    value = normalized.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def _score_distance(distance: float) -> int:
    return max(55, round(100 - min(distance, 220) * 0.2))


def _normalize_text(value: str) -> str:
    return value.strip().lower()
