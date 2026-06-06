import pytest
from fastapi import HTTPException

from src.api.routes.replenishment import replenishment_suggestions
from src.replenishment.service import ReplenishmentService, country_from_headers
from src.security.plan import Plan, PlanContext
from src.tools.models import StockItem


def _stock() -> list[StockItem]:
    return [
        StockItem(
            id="pla-blue",
            name="Bambu Lab PLA Basic Blue",
            brand="Bambu Lab",
            material="PLA",
            material_type="Basic",
            color="Blue",
            color_name="Blue",
            color_hex="#2147FF",
            weight_initial_g=1000,
            weight_remaining_g=80,
        )
    ]


def test_replenishment_returns_ranked_provider_choices() -> None:
    response = ReplenishmentService(_stock()).suggest_for_item("pla-blue", country="FR")

    assert response.country == "FR"
    assert response.quantity_kg == 1
    assert len(response.suggestions) > 1
    assert response.suggestions[0].score >= response.suggestions[1].score
    assert response.suggestions[0].relevance == "exact"
    assert response.suggestions[0].query == "Bambu Lab PLA Basic Bleu Blue 1,75 mm 1 kg"
    assert response.suggestions[0].provider_id == "atome3d-fr"
    assert response.suggestions[0].url.startswith("https://www.atome3d.com/search?q=")
    assert "/recherche" not in response.suggestions[0].url
    assert '"' not in response.suggestions[0].query


def test_replenishment_adds_close_color_candidates_for_same_product_scope() -> None:
    response = ReplenishmentService(_stock()).suggest_for_item(
        "pla-blue",
        country="FR",
        max_results=12,
    )

    relevances = {suggestion.relevance for suggestion in response.suggestions}
    assert "exact" in relevances
    assert "close_color" in relevances
    assert all("Bambu Lab" in suggestion.query for suggestion in response.suggestions)
    assert all("PLA" in suggestion.query for suggestion in response.suggestions)
    assert any("Basic" in suggestion.query for suggestion in response.suggestions)


def test_atome3d_query_uses_localized_terms_to_avoid_cross_brand_basic_matches() -> None:
    stock = [
        StockItem(
            id="sunlu-black",
            name="Sunlu PLA Basic Black",
            brand="Sunlu",
            material="PLA",
            material_type="Basic",
            color="Black",
            color_name="Black",
            color_hex="#000000",
            weight_initial_g=1000,
            weight_remaining_g=80,
        )
    ]

    response = ReplenishmentService(stock).suggest_for_item("sunlu-black", country="FR")
    atome = next(suggestion for suggestion in response.suggestions if suggestion.provider_id == "atome3d-fr")

    assert atome.query == "Sunlu PLA Noir Black 1,75 mm 1 kg"
    assert atome.score == 94
    assert "Basic Black" not in atome.query
    assert "filament" not in atome.query
    assert "Type non force chez ce provider: Basic" in atome.reasons
    assert "bambulab-eu" not in {suggestion.provider_id for suggestion in response.suggestions}
    assert atome.url == "https://www.atome3d.com/search?q=Sunlu+PLA+Noir+Black+1%2C75+mm+1+kg"


def test_country_from_headers_supports_proxy_geo_headers() -> None:
    assert country_from_headers({"cf-ipcountry": "be"}) == "BE"
    assert country_from_headers({"x-vercel-ip-country": "US"}) == "US"
    assert country_from_headers({"cf-ipcountry": "unknown"}) is None


def test_replenishment_endpoint_refuses_free_plan() -> None:
    with pytest.raises(HTTPException) as exc:
        replenishment_suggestions(
            item_id="pla-blue",
            request=type("Request", (), {"headers": {}})(),
            plan=PlanContext(plan=Plan.FREE),
            context=None,
        )

    assert exc.value.status_code == 403
