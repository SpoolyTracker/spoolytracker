from src.tools.mock_data import MOCK_STOCK_ITEMS
from src.tools.models import (
    LowStockRequest,
    LowStockResponse,
    StockItem,
    StockItemRequest,
    StockItemResponse,
    StockSummaryRequest,
    StockSummaryResponse,
)


def _matches(item: StockItem, query: str) -> bool:
    normalized = query.lower()
    haystack = " ".join(
        [item.id, item.name, item.brand, item.material, item.color],
    ).lower()
    return all(token in haystack for token in normalized.split() if len(token) > 1)


def get_stock_summary(_: StockSummaryRequest | None = None) -> StockSummaryResponse:
    active_items = len([item for item in MOCK_STOCK_ITEMS if item.weight_remaining_g > 0])
    return StockSummaryResponse(
        active_items=active_items,
        total_remaining_g=round(sum(item.weight_remaining_g for item in MOCK_STOCK_ITEMS), 2),
        total_initial_g=round(sum(item.weight_initial_g for item in MOCK_STOCK_ITEMS), 2),
        items=MOCK_STOCK_ITEMS,
    )


def get_stock_item(request: StockItemRequest) -> StockItemResponse:
    for item in MOCK_STOCK_ITEMS:
        if _matches(item, request.query):
            return StockItemResponse(item=item)
    return StockItemResponse(item=None)


def list_low_stock_items(request: LowStockRequest) -> LowStockResponse:
    items = [
        item
        for item in MOCK_STOCK_ITEMS
        if item.weight_initial_g > 0
        and item.weight_remaining_g / item.weight_initial_g * 100 <= request.threshold_percent
    ]
    return LowStockResponse(items=sorted(items, key=lambda item: item.remaining_percent))
