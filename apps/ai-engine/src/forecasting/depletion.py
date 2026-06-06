from datetime import date, timedelta
from statistics import mean, pstdev

from src.forecasting.mock_history import TODAY, build_mock_consumption_history
from src.forecasting.models import (
    ConsumptionSample,
    MaterialRisk,
    NotificationProposal,
    ProjectRisk,
    RiskLevel,
    RisksResponse,
    StockForecast,
)
from src.tools.mock_data import MOCK_PROJECTS, MOCK_STOCK_ITEMS
from src.tools.models import ProjectItem, StockItem
from src.domain.snapshots import AppDataSnapshot


class ForecastingService:
    """Simple deterministic Pro forecasting service.

    The model is intentionally explainable:
    - average daily consumption = sum(consumption) / observed period in days
    - depletion date = today + remaining stock / average daily consumption
    - confidence grows with sample count and period length
    - anomalies are values above mean + 1.5 standard deviations
    """

    def __init__(
        self,
        stock_items: list[StockItem] | None = None,
        history: list[ConsumptionSample] | None = None,
        projects: list[ProjectItem] | None = None,
        today: date = TODAY,
    ) -> None:
        self.stock_items = MOCK_STOCK_ITEMS if stock_items is None else stock_items
        self.history = build_mock_consumption_history(today) if history is None else history
        self.projects = MOCK_PROJECTS if projects is None else projects
        self.today = today
        self.data_source = "mock_fallback"

    @classmethod
    def from_snapshot(cls, snapshot: AppDataSnapshot, today: date = TODAY) -> "ForecastingService":
        inputs = snapshot.to_forecasting_inputs()
        service = cls(
            stock_items=inputs["stock_items"],
            history=inputs["history"],
            projects=inputs["projects"],
            today=today,
        )
        service.data_source = snapshot.source
        return service

    def forecast_all(self, include_empty: bool = False) -> list[StockForecast]:
        return [self.forecast_item(item.id) for item in self._forecastable_items(include_empty)]

    def forecast_item(self, item_id: str) -> StockForecast:
        item = self._get_item(item_id)
        samples = self._samples_for(item_id)
        average_daily = self._average_daily_consumption(samples)
        confidence = self._confidence(samples)
        anomalies = self._anomalies(samples)

        if average_daily <= 0:
            return StockForecast(
                item_id=item.id,
                item_name=item.name,
                brand=item.brand,
                material=item.material,
                material_type=item.material_type,
                color=item.color,
                color_name=item.color_name,
                color_hex=item.color_hex,
                remaining_g=item.weight_remaining_g,
                average_daily_consumption_g=0,
                days_until_depletion=None,
                predicted_depletion_date=None,
                confidence_score=confidence,
                risk_level=RiskLevel.UNKNOWN,
                explanation="Aucun historique suffisant pour calculer une rupture.",
                anomalies=anomalies,
            )

        days = item.weight_remaining_g / average_daily
        depletion_date = self.today + timedelta(days=round(days))
        risk = self._risk_from_days(days)
        recommendation = self._purchase_recommendation(item, days, risk)

        return StockForecast(
            item_id=item.id,
            item_name=item.name,
            brand=item.brand,
            material=item.material,
            material_type=item.material_type,
            color=item.color,
            color_name=item.color_name,
            color_hex=item.color_hex,
            remaining_g=item.weight_remaining_g,
            average_daily_consumption_g=round(average_daily, 2),
            days_until_depletion=round(days, 1),
            predicted_depletion_date=depletion_date,
            confidence_score=confidence,
            risk_level=risk,
            explanation=(
                f"Consommation moyenne calculee sur {len(samples)} points: "
                f"{round(average_daily, 2)}g/jour. Rupture estimee par stock restant / moyenne."
            ),
            anomalies=anomalies,
            purchase_recommendation=recommendation,
        )

    def risks(self, include_empty: bool = False) -> RisksResponse:
        forecasts = self.forecast_all(include_empty=include_empty)
        material_risks = [
            MaterialRisk(
                material=forecast.material,
                material_type=forecast.material_type,
                color=forecast.color,
                color_name=forecast.color_name,
                color_hex=forecast.color_hex,
                brand=forecast.brand,
                item_name=forecast.item_name,
                risk_level=forecast.risk_level,
                reason=self._risk_reason(forecast),
                affected_items=[forecast.item_id],
                confidence_score=forecast.confidence_score,
            )
            for forecast in forecasts
            if forecast.risk_level in {RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.UNKNOWN}
        ]

        project_risks = [risk for project in self.projects if (risk := self._project_risk(project))]
        return RisksResponse(material_risks=material_risks, project_risks=project_risks)

    def _risk_reason(self, forecast: StockForecast) -> str:
        if forecast.days_until_depletion is not None:
            return (
                f"{self._display_item_name(forecast)}: rupture estimee dans "
                f"{forecast.days_until_depletion:g} jours."
            )
        return (
            f"{self._display_item_name(forecast)}: pas assez de consommations enregistrees "
            "pour predire une date de rupture. Le stock est affiche a surveiller, "
            "pas comme une rupture confirmee."
        )

    def _display_item_name(self, forecast: StockForecast) -> str:
        return forecast.item_name

    def notification_proposals(self, include_empty: bool = False) -> list[NotificationProposal]:
        proposals: list[NotificationProposal] = []
        for forecast in self.forecast_all(include_empty=include_empty):
            if forecast.risk_level in {RiskLevel.CRITICAL, RiskLevel.HIGH}:
                proposals.append(
                    NotificationProposal(
                        type="stock_depletion",
                        title=f"Risque de rupture: {forecast.item_name}",
                        message=(
                            f"{forecast.item_name} pourrait etre vide vers le "
                            f"{forecast.predicted_depletion_date}. "
                            f"Recommandation: {forecast.purchase_recommendation}"
                        ),
                        priority=forecast.risk_level,
                        related_item_id=forecast.item_id,
                        proposed_action={
                            "type": "propose_supplier_order",
                            "payload": {
                                "material": forecast.material,
                                "color": forecast.color,
                                "quantity": 1,
                            },
                        },
                        confidence_score=forecast.confidence_score,
                    )
                )
            if forecast.anomalies:
                proposals.append(
                    NotificationProposal(
                        type="anomaly",
                        title=f"Consommation anormale detectee: {forecast.item_name}",
                        message="; ".join(forecast.anomalies),
                        priority=RiskLevel.MEDIUM,
                        related_item_id=forecast.item_id,
                        confidence_score=forecast.confidence_score,
                    )
                )
        return proposals

    def _get_item(self, item_id: str) -> StockItem:
        for item in self.stock_items:
            if item.id == item_id:
                return item
        raise ValueError(f"Unknown stock item: {item_id}")

    def _forecastable_items(self, include_empty: bool) -> list[StockItem]:
        if include_empty:
            return self.stock_items
        return [item for item in self.stock_items if item.weight_remaining_g > 0]

    def _samples_for(self, item_id: str) -> list[ConsumptionSample]:
        return sorted(
            [sample for sample in self.history if sample.item_id == item_id],
            key=lambda sample: sample.occurred_on,
        )

    def _average_daily_consumption(self, samples: list[ConsumptionSample]) -> float:
        if len(samples) < 2:
            return 0
        first = min(sample.occurred_on for sample in samples)
        last = max(sample.occurred_on for sample in samples)
        days = max((last - first).days, 1)
        return sum(sample.amount_g for sample in samples) / days

    def _confidence(self, samples: list[ConsumptionSample]) -> float:
        if not samples:
            return 0
        first = min(sample.occurred_on for sample in samples)
        last = max(sample.occurred_on for sample in samples)
        period_days = max((last - first).days, 1)
        sample_score = min(len(samples) / 6, 1)
        period_score = min(period_days / 30, 1)
        return round((sample_score * 0.65) + (period_score * 0.35), 2)

    def _anomalies(self, samples: list[ConsumptionSample]) -> list[str]:
        if len(samples) < 4:
            return []
        amounts = [sample.amount_g for sample in samples]
        avg = mean(amounts)
        deviation = pstdev(amounts)
        if deviation == 0:
            return []
        threshold = avg + (1.5 * deviation)
        return [
            f"{sample.amount_g:g}g le {sample.occurred_on.isoformat()} depasse le seuil anormal de {round(threshold, 1)}g"
            for sample in samples
            if sample.amount_g > threshold
        ]

    def _risk_from_days(self, days: float) -> RiskLevel:
        if days <= 7:
            return RiskLevel.CRITICAL
        if days <= 14:
            return RiskLevel.HIGH
        if days <= 30:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _purchase_recommendation(
        self,
        item: StockItem,
        days_until_depletion: float,
        risk: RiskLevel,
    ) -> str | None:
        if risk not in {RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM}:
            return None
        urgency = "immediate" if days_until_depletion <= 7 else "prochaine"
        color_label = item.color_name or item.color
        return f"Prevoir une commande {urgency} de 1 bobine {item.material} {color_label}."

    def _project_risk(self, project: ProjectItem) -> ProjectRisk | None:
        missing_materials: list[str] = []
        for requirement in project.requirements:
            available = sum(
                item.weight_remaining_g
                for item in self.stock_items
                if item.material.lower() == requirement.material.lower()
                and item.color.lower() == requirement.color.lower()
            )
            if available < requirement.required_g:
                missing_materials.append(
                    f"{requirement.material} {requirement.color}: {requirement.required_g:g}g requis, {available:g}g disponibles"
                )

        if not missing_materials:
            return None
        return ProjectRisk(
            project_id=project.id,
            project_name=project.name,
            risk_level=RiskLevel.HIGH,
            reason="Stock insuffisant pour certains besoins du projet.",
            missing_materials=missing_materials,
            confidence_score=0.85,
        )


class DepletionForecaster:
    """Backward-compatible small forecaster used by existing tests."""

    def forecast(self, filament_id: int, remaining_g: float, daily_usage_g: float):
        from dataclasses import dataclass

        @dataclass(frozen=True)
        class DepletionForecast:
            filament_id: int
            days_remaining: float | None
            status: str

        if daily_usage_g <= 0:
            return DepletionForecast(filament_id, None, "insufficient_data")
        days_remaining = remaining_g / daily_usage_g
        return DepletionForecast(
            filament_id=filament_id,
            days_remaining=round(days_remaining, 2),
            status="critical" if days_remaining <= 7 else "ok",
        )


forecasting_service = ForecastingService()
