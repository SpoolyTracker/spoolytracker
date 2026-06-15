from src.api.routes.analytics import analytics_overview
from src.security.plan import Plan, PlanContext


class _StaticFactory:
    def __init__(self, captured: dict):
        self._captured = captured

    def build(self, context=None, plan=None):
        from datetime import date
        from src.analytics.service import AnalyticsService
        from src.domain.snapshots import AppOrganizationSettings
        self._captured["is_pro"] = bool(plan and plan.is_pro)
        return AnalyticsService(
            filaments=[], consumptions=[],
            settings=AppOrganizationSettings(organization_id="1"),
            today=date(2026, 3, 22), is_pro=bool(plan and plan.is_pro),
        )


def test_overview_endpoint_passes_plan_to_factory() -> None:
    captured: dict = {}
    result = analytics_overview(
        granularity="day", plan=PlanContext(plan=Plan.PRO),
        context=None, factory=_StaticFactory(captured),
    )
    assert captured["is_pro"] is True
    assert result.plan == "pro"


def test_overview_endpoint_defaults_free() -> None:
    captured: dict = {}
    result = analytics_overview(
        granularity="day", plan=PlanContext(plan=Plan.FREE),
        context=None, factory=_StaticFactory(captured),
    )
    assert captured["is_pro"] is False
    assert result.stock.depletion == []
