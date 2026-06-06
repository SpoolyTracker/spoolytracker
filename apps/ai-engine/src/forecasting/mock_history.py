from datetime import date, timedelta

from src.forecasting.models import ConsumptionSample

TODAY = date(2026, 5, 30)


def build_mock_consumption_history(today: date = TODAY) -> list[ConsumptionSample]:
    return [
        ConsumptionSample(item_id="fil-pla-noir", amount_g=40, occurred_on=today - timedelta(days=24)),
        ConsumptionSample(item_id="fil-pla-noir", amount_g=55, occurred_on=today - timedelta(days=18)),
        ConsumptionSample(item_id="fil-pla-noir", amount_g=45, occurred_on=today - timedelta(days=12)),
        ConsumptionSample(item_id="fil-pla-noir", amount_g=60, occurred_on=today - timedelta(days=6)),
        ConsumptionSample(item_id="fil-petg-rouge", amount_g=95, occurred_on=today - timedelta(days=20)),
        ConsumptionSample(item_id="fil-petg-rouge", amount_g=110, occurred_on=today - timedelta(days=13)),
        ConsumptionSample(item_id="fil-petg-rouge", amount_g=105, occurred_on=today - timedelta(days=7)),
        ConsumptionSample(item_id="fil-petg-rouge", amount_g=260, occurred_on=today - timedelta(days=2)),
        ConsumptionSample(item_id="fil-pla-blanc", amount_g=25, occurred_on=today - timedelta(days=21)),
        ConsumptionSample(item_id="fil-pla-blanc", amount_g=35, occurred_on=today - timedelta(days=14)),
        ConsumptionSample(item_id="fil-pla-blanc", amount_g=30, occurred_on=today - timedelta(days=7)),
    ]
