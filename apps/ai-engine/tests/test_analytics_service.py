from datetime import date

from src.analytics.service import AnalyticsService
from src.domain.snapshots import (
    AppConsumptionSnapshot,
    AppFilamentSnapshot,
    AppOrganizationSettings,
)


def _filaments() -> list[AppFilamentSnapshot]:
    return [
        AppFilamentSnapshot(
            id="pla-1", organization_id="1", name="PLA noir", brand_name="Sunlu",
            material_name="PLA", color_name="noir", color_hex="#111111",
            weight_initial_g=1000, weight_remaining_g=400, price=20.0,
        ),
        AppFilamentSnapshot(
            id="petg-1", organization_id="1", name="PETG rouge", brand_name="Bambu",
            material_name="PETG", color_name="rouge", color_hex="#ef4444",
            weight_initial_g=1000, weight_remaining_g=900, price=30.0,
        ),
    ]


def _consumptions() -> list[AppConsumptionSnapshot]:
    return [
        AppConsumptionSnapshot(id="c1", organization_id="1", filament_id="pla-1",
                               amount_g=100, occurred_on=date(2026, 3, 18)),
        AppConsumptionSnapshot(id="c2", organization_id="1", filament_id="pla-1",
                               amount_g=50, occurred_on=date(2026, 3, 20)),
        AppConsumptionSnapshot(id="c3", organization_id="1", filament_id="petg-1",
                               amount_g=40, occurred_on=date(2026, 3, 20)),
        AppConsumptionSnapshot(id="c4", organization_id="1", filament_id="pla-1",
                               amount_g=30, occurred_on=date(2026, 3, 21), is_planned=True),
    ]


def _service(is_pro: bool = True) -> AnalyticsService:
    return AnalyticsService(
        filaments=_filaments(),
        consumptions=_consumptions(),
        settings=AppOrganizationSettings(organization_id="1", plan="pro" if is_pro else "free"),
        today=date(2026, 3, 22),
        is_pro=is_pro,
    )


def test_consumption_series_separates_actual_and_planned() -> None:
    result = _service().consumption(granularity="day")

    by_bucket = {p.bucket: p for p in result.series}
    assert by_bucket["2026-03-18"].value == 100
    assert by_bucket["2026-03-20"].value == 90      # 50 + 40 réels
    assert by_bucket["2026-03-21"].planned == 30    # planifié séparé
    assert by_bucket["2026-03-21"].value == 0


def test_consumption_breakdown_by_material_and_brand() -> None:
    result = _service().consumption(granularity="day")

    materials = {s.key: s.value for s in result.by_material}
    brands = {s.key: s.value for s in result.by_brand}
    assert materials["PLA"] == 150            # 100 + 50 réels
    assert materials["PETG"] == 40
    assert brands["Sunlu"] == 150
    assert brands["Bambu"] == 40


def test_cost_series_uses_price_per_gram() -> None:
    result = _service().cost(granularity="day")

    by_bucket = {p.bucket: p for p in result.series}
    # PLA price/g = 20/1000 = 0.02 ; PETG = 30/1000 = 0.03
    assert by_bucket["2026-03-18"].value == 2.0          # 100g * 0.02
    assert round(by_bucket["2026-03-20"].value, 2) == 2.2  # 50*0.02 + 40*0.03
    assert round(result.total_cost, 2) == 4.2
    assert by_bucket["2026-03-21"].planned == 0.6        # 30g planifié PLA * 0.02


def test_cost_suggested_budget_pro_only() -> None:
    assert _service(is_pro=True).cost().suggested_budget is not None
    assert _service(is_pro=False).cost().suggested_budget is None


def test_stock_runway_and_value() -> None:
    result = _service().stock()

    # Valeur dispo = 400g*0.02 + 900g*0.03 = 8 + 27 = 35
    assert round(result.total_value, 2) == 35.0
    assert result.runway_days is not None
    assert result.runway_days > 0


def test_stock_inventory_breakdown_uses_all_remaining_stock() -> None:
    result = _service().stock()

    materials = {s.key: s.value for s in result.by_material}
    brands = {s.key: s.value for s in result.by_brand}
    # Basé sur le stock restant (400g PLA/Sunlu, 900g PETG/Bambu), pas la conso.
    assert materials["PLA"] == 400
    assert materials["PETG"] == 900
    assert brands["Sunlu"] == 400
    assert brands["Bambu"] == 900


def test_stock_dormant_lists_unused_spools() -> None:
    svc = _service()
    svc.consumptions = [
        AppConsumptionSnapshot(id="old", organization_id="1", filament_id="pla-1",
                               amount_g=100, occurred_on=date(2025, 1, 1)),
    ]
    svc._refresh_index()
    dormant_ids = {d.item_id for d in svc.stock(dormant_after_days=60).dormant}
    assert "pla-1" in dormant_ids


def test_stock_depletion_pro_only() -> None:
    # En Free, pas de déplétion par bobine.
    assert _service(is_pro=False).stock().depletion == []
    # En Pro, la liste est présente (peut être vide si aucun risque calculable).
    assert isinstance(_service(is_pro=True).stock().depletion, list)


def test_overview_bundles_all_axes_and_flags_plan() -> None:
    result = _service(is_pro=True).overview(granularity="day")

    assert result.plan == "pro"
    assert result.granularity == "day"
    assert result.consumption.series
    assert result.cost.total_cost > 0
    assert result.stock.total_value > 0


def test_factory_builds_from_snapshot() -> None:
    from src.analytics.factory import AnalyticsServiceFactory
    from src.security.plan import Plan, PlanContext

    service = AnalyticsServiceFactory().build(context=None, plan=PlanContext(plan=Plan.FREE))
    overview = service.overview()
    assert overview.source  # provient du snapshot (mock_fallback en l'absence d'API)
    assert overview.stock.depletion == []  # Free -> pas de déplétion
