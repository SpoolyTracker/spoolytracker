import unicodedata

from src.tools.mock_data import MOCK_PROJECTS
from src.tools.models import (
    ProjectEstimateRequest,
    ProjectEstimateResponse,
    ProjectItem,
    ProjectRequirementEstimate,
)
from src.tools.stock import get_stock_summary


def _find_project(query: str) -> ProjectItem | None:
    normalized = _normalize(query)
    for project in MOCK_PROJECTS:
        if _normalize(project.name) in normalized:
            return project
    for project in MOCK_PROJECTS:
        project_name = _normalize(project.name)
        if any(token in project_name for token in normalized.split() if len(token) > 2):
            return project
    return MOCK_PROJECTS[0] if MOCK_PROJECTS else None


def _normalize(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value.lower())
        if not unicodedata.combining(char)
    )


def estimate_project_materials(request: ProjectEstimateRequest) -> ProjectEstimateResponse:
    project = _find_project(request.query)
    if project is None:
        return ProjectEstimateResponse(project=None, estimates=[], overall_status="unknown")

    stock = get_stock_summary().items
    estimates: list[ProjectRequirementEstimate] = []

    for requirement in project.requirements:
        available_g = sum(
            item.weight_remaining_g
            for item in stock
            if item.material.lower() == requirement.material.lower()
            and item.color.lower() == requirement.color.lower()
        )
        status = "ok" if available_g >= requirement.required_g else "insufficient"
        estimates.append(
            ProjectRequirementEstimate(
                material=requirement.material,
                color=requirement.color,
                required_g=requirement.required_g,
                available_g=available_g,
                status=status,
            ),
        )

    overall_status = "ok" if all(item.status == "ok" for item in estimates) else "risk"
    return ProjectEstimateResponse(
        project=project,
        estimates=estimates,
        overall_status=overall_status,
    )
