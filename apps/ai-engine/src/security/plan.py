from enum import StrEnum

from fastapi import Header, HTTPException, status
from pydantic import BaseModel


class Plan(StrEnum):
    FREE = "free"
    PRO = "pro"


class PlanContext(BaseModel):
    plan: Plan = Plan.FREE

    @property
    def is_pro(self) -> bool:
        return self.plan == Plan.PRO


def get_plan_context(plan: str | None = Header(default=None, alias="x-plan")) -> PlanContext:
    if not plan:
        return PlanContext(plan=Plan.FREE)
    try:
        return PlanContext(plan=Plan(plan.lower()))
    except ValueError:
        return PlanContext(plan=Plan.FREE)


def require_pro(plan_context: PlanContext) -> None:
    if not plan_context.is_pro:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "pro_required",
                "message": "Cette fonctionnalite est reservee au mode Pro.",
                "free_alternative": "Le mode Free peut repondre sur le stock actuel et le stock faible.",
            },
        )
