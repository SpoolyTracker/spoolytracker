from datetime import date

from src.domain.provider import MockAppDataProvider
from src.domain.snapshots import AppConsumptionSnapshot, AppDataSnapshot
from src.security.context import RequestContext


def test_mock_provider_builds_tenant_snapshot() -> None:
    snapshot = MockAppDataProvider().get_snapshot(
        RequestContext(workspace_id="org-123", user_id="user-456")
    )

    assert snapshot.organization_id == "org-123"
    assert snapshot.user_id == "user-456"
    assert snapshot.filaments
    assert snapshot.consumptions
    assert snapshot.projects


def test_snapshot_filters_failed_and_planned_consumptions() -> None:
    snapshot = MockAppDataProvider().get_snapshot()
    snapshot.consumptions.append(
        AppConsumptionSnapshot(
            id="failed",
            organization_id=snapshot.organization_id,
            filament_id="fil-pla-noir",
            amount_g=999,
            occurred_on=date(2026, 5, 30),
            print_status="FAILED",
        )
    )
    snapshot.consumptions.append(
        AppConsumptionSnapshot(
            id="planned",
            organization_id=snapshot.organization_id,
            filament_id="fil-pla-noir",
            amount_g=999,
            occurred_on=date(2026, 5, 30),
            is_planned=True,
        )
    )

    inputs = snapshot.to_forecasting_inputs()

    assert all(sample.amount_g != 999 for sample in inputs["history"])
