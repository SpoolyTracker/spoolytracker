from src.forecasting.depletion import DepletionForecaster


def test_depletion_forecast_with_usage() -> None:
    forecast = DepletionForecaster().forecast(
        filament_id=42,
        remaining_g=100,
        daily_usage_g=20,
    )

    assert forecast.days_remaining == 5
    assert forecast.status == "critical"


def test_depletion_forecast_without_usage() -> None:
    forecast = DepletionForecaster().forecast(
        filament_id=42,
        remaining_g=100,
        daily_usage_g=0,
    )

    assert forecast.days_remaining is None
    assert forecast.status == "insufficient_data"
