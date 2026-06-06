from datetime import date, timedelta
from typing import Protocol

from src.domain.snapshots import (
    AppConsumptionSnapshot,
    AppDataSnapshot,
    AppFilamentSnapshot,
    AppOrganizationSettings,
    AppProjectSnapshot,
)
from src.forecasting.mock_history import TODAY
from src.security.context import RequestContext
from src.tools.mock_data import MOCK_PROJECTS, MOCK_STOCK_ITEMS


class AppDataProvider(Protocol):
    def get_snapshot(self, context: RequestContext | None = None) -> AppDataSnapshot:
        ...


class MockAppDataProvider:
    """Local provider shaped like the future NestJS API payload."""

    def get_snapshot(self, context: RequestContext | None = None) -> AppDataSnapshot:
        organization_id = context.workspace_id if context else "mock-org"
        user_id = context.user_id if context else None
        filaments = [
            AppFilamentSnapshot(
                id=item.id,
                organization_id=organization_id,
                name=item.name,
                brand_name=item.brand,
                material_name=item.material,
                color_name=item.color,
                weight_initial_g=item.weight_initial_g,
                weight_remaining_g=item.weight_remaining_g,
                planned_weight_g=25 if item.id == "fil-petg-rouge" else 0,
                virtual_weight_remaining_g=None,
                low_stock_threshold=item.low_stock_threshold_percent,
                low_stock_threshold_type="PERCENTAGE",
            )
            for item in MOCK_STOCK_ITEMS
        ]
        consumptions = [
            AppConsumptionSnapshot(
                id=f"hist-{index}",
                organization_id=organization_id,
                filament_id=item_id,
                amount_g=amount,
                occurred_on=TODAY - timedelta(days=days_ago),
                type="PRINT",
                print_status="SUCCESS",
            )
            for index, (item_id, amount, days_ago) in enumerate(
                [
                    ("fil-pla-noir", 40, 24),
                    ("fil-pla-noir", 55, 18),
                    ("fil-pla-noir", 45, 12),
                    ("fil-pla-noir", 60, 6),
                    ("fil-petg-rouge", 95, 20),
                    ("fil-petg-rouge", 110, 13),
                    ("fil-petg-rouge", 105, 7),
                    ("fil-petg-rouge", 260, 2),
                    ("fil-pla-blanc", 25, 21),
                    ("fil-pla-blanc", 35, 14),
                    ("fil-pla-blanc", 30, 7),
                ],
                start=1,
            )
        ]
        projects = [
            AppProjectSnapshot(
                id=project.id,
                organization_id=organization_id,
                name=project.name,
                status=project.status,
                requirements=project.requirements,
            )
            for project in MOCK_PROJECTS
        ]
        return AppDataSnapshot(
            organization_id=organization_id,
            user_id=user_id,
            settings=AppOrganizationSettings(
                organization_id=organization_id,
                plan="pro",
                low_stock_threshold=20,
                low_stock_threshold_type="PERCENTAGE",
            ),
            filaments=filaments,
            consumptions=consumptions,
            projects=projects,
        )
