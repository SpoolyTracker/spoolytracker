from fastapi import APIRouter, Depends, Header

from src.agents.free_assistant import FreeAssistantAgent
from src.api.schemas import Capability, CapabilitiesResponse, ChatRequest, ChatResponse
from src.domain.snapshots import AppDataSnapshot
from src.forecasting.depletion import ForecastingService
from src.forecasting.factory import forecasting_factory
from src.llm.service import LLMService, llm_service
from src.memory.service import MemoryService, memory_service
from src.replenishment.service import ReplenishmentService
from src.security.context import RequestContext, get_optional_request_context
from src.security.plan import PlanContext, get_plan_context

router = APIRouter(tags=["assistant"])


def _build_forecast_service(
    request: ChatRequest, context: RequestContext | None
) -> ForecastingService:
    if request.snapshot:
        snapshot = AppDataSnapshot.model_validate(request.snapshot)
        return ForecastingService.from_snapshot(snapshot, source="main_api")
    return forecasting_factory.build(context)


def get_memory_service() -> MemoryService:
    return memory_service


def get_llm_service() -> LLMService:
    return llm_service


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    context: RequestContext | None = Depends(get_optional_request_context),
    plan: PlanContext = Depends(get_plan_context),
    service: MemoryService = Depends(get_memory_service),
    llm: LLMService = Depends(get_llm_service),
    country: str | None = Header(default=None, alias="x-country-code"),
) -> ChatResponse:
    if not isinstance(country, str):
        country = None
    if not hasattr(service, "capture_from_chat"):
        service = memory_service
    if not hasattr(llm, "enhance_answer"):
        llm = llm_service

    captured = service.capture_from_chat(request.message, context) if context else None
    if captured:
        return ChatResponse(
            intent="memory_saved",
            answer="C'est note. J'utiliserai cette information pour ameliorer mes prochaines reponses.",
            data={"captured_memory": captured.model_dump(), "memory": captured.model_dump()},
        )

    if request.snapshot and isinstance(request.snapshot.get("memories"), list):
        memories = request.snapshot["memories"]
    elif context:
        memories = [memory.model_dump() for memory in service.search(context, request.message)]
    else:
        memories = []

    if plan.is_pro and (
        _is_purchase_question(request.message) or _is_pro_forecast_question(request.message)
    ):
        forecast_service = _build_forecast_service(request, context)
        lower = request.message.lower()
        include_empty = "bobine vide" in lower or "bobines vides" in lower or "stock vide" in lower
        if _is_purchase_question(request.message):
            return _build_purchase_response(request, forecast_service, country)
        if "notification" in lower:
            proposals = forecast_service.notification_proposals(include_empty=include_empty)
            return ChatResponse(
                intent="pro_notification_proposals",
                answer=(
                    f"J'ai prepare {len(proposals)} proposition(s) de notification proactive."
                    f"\n\nSource des donnees: {forecast_service.data_source}."
                ),
                data={"proposals": [proposal.model_dump() for proposal in proposals]},
            )
        if _is_risk_follow_up(lower) or "risque" in lower or "risques" in lower:
            risk_response = forecast_service.risks(include_empty=include_empty)
            material_lines = [
                f"- {risk.material} {risk.color or ''}: {risk.reason} (confiance {risk.confidence_score:g})"
                for risk in risk_response.material_risks
            ]
            project_lines = [
                f"- {risk.project_name}: {risk.reason} {'; '.join(risk.missing_materials)} (confiance {risk.confidence_score:g})"
                for risk in risk_response.project_risks
            ]
            details = []
            if material_lines:
                details.append("Materiaux a risque:\n" + "\n".join(material_lines))
            if project_lines:
                details.append("Projets a risque:\n" + "\n".join(project_lines))
            return ChatResponse(
                intent="pro_risks",
                answer=(
                    f"J'ai detecte {len(risk_response.material_risks)} materiau(x) a risque "
                    f"et {len(risk_response.project_risks)} projet(s) a risque.\n\n"
                    + ("\n\n".join(details) if details else "Aucun detail de risque critique a afficher.")
                    + f"\n\nSource des donnees: {forecast_service.data_source}."
                ),
                data={**risk_response.model_dump(), "source": forecast_service.data_source},
            )

        forecasts = forecast_service.forecast_all(include_empty=include_empty)
        lines = [
            (
                f"- {forecast.item_name}: rupture estimee le "
                f"{forecast.predicted_depletion_date} "
                f"({forecast.average_daily_consumption_g:g}g/jour, confiance {forecast.confidence_score:g})"
            )
            for forecast in forecasts[:3]
        ]
        return ChatResponse(
            intent="pro_stock_forecast",
            answer=(
                "Voici la prevision Pro:\n"
                + "\n".join(lines)
                + f"\n\nSource des donnees: {forecast_service.data_source}."
            ),
            data={"forecasts": [forecast.model_dump() for forecast in forecasts], "source": forecast_service.data_source},
        )

    forecast_service = _build_forecast_service(request, context)
    result = await FreeAssistantAgent().run(
        prompt=request.message,
        context={
            "conversation_id": request.conversation_id,
            "memories": memories,
            "plan": plan.plan,
            "stock_items": forecast_service.stock_items,
            "projects": forecast_service.projects,
            "data_source": forecast_service.data_source,
        },
    )
    response = ChatResponse(**result.model_dump())
    response.data = {**(response.data or {}), "memories": memories}
    return _with_optional_llm_response(response, request.message, memories, llm)


def _is_pro_forecast_question(message: str) -> bool:
    lower = message.lower()
    return any(
        token in lower
        for token in [
            "date de rupture",
            "rupture estimee",
            "rupture estimée",
            "prevision",
            "prévision",
            "consommation moyenne",
            "anormale",
            "materiaux a risque",
            "matériaux à risque",
            "notification proactive",
            "risque",
            "indiquer",
            "les indiquer",
            "detail",
            "détail",
        ]
    )


def _is_risk_follow_up(message: str) -> bool:
    return any(token in message for token in ["les indiquer", "me les indiquer", "detail", "détail"])


def _is_purchase_question(message: str) -> bool:
    lower = message.lower()
    return any(
        token in lower
        for token in [
            "commande",
            "commander",
            "acheter",
            "a acheter",
            "à acheter",
            "achat",
            "racheter",
            "approvision",
            "ravitail",
            "liste de courses",
            "a prevoir",
            "à prévoir",
            "quoi prendre",
        ]
    )


def _build_purchase_response(
    request: ChatRequest,
    forecast_service: ForecastingService,
    country: str | None,
) -> ChatResponse:
    lower = request.message.lower()
    include_empty = "bobine vide" in lower or "bobines vides" in lower or "stock vide" in lower
    recommendations = forecast_service.purchase_recommendations(include_empty=include_empty)

    replenishment = ReplenishmentService(forecast_service.stock_items)

    enriched: list[dict] = []
    for recommendation in recommendations:
        data = recommendation.model_dump()
        try:
            suggestion = replenishment.suggest_for_item(
                recommendation.item_id, country=country, max_results=8
            )
        except ValueError:
            suggestion = None

        providers: list[dict] = []
        if suggestion:
            seen_providers: set[str] = set()
            for option in suggestion.suggestions:
                if option.provider_id in seen_providers:
                    continue
                seen_providers.add(option.provider_id)
                providers.append(
                    {
                        "provider_id": option.provider_id,
                        "provider_name": option.provider_name,
                        "url": option.url,
                    }
                )
                if len(providers) >= 3:
                    break

        data["providers"] = providers
        if providers:
            # Keep single-provider fields for backward compatibility.
            data["provider_name"] = providers[0]["provider_name"]
            data["provider_url"] = providers[0]["url"]
        enriched.append(data)

    if not enriched:
        answer = (
            "Rien d'urgent a commander pour l'instant: aucune bobine en rupture proche "
            "ni en stock faible."
            f"\n\nSource des donnees: {forecast_service.data_source}."
        )
    else:
        lines = []
        for data in enriched:
            tag = "URGENT" if data["urgency"] == "immediate" else "a prevoir"
            lines.append(
                f"- [{tag}] {data['item_name']}: {data['reason']} "
                f"Suggere: {data['suggested_quantity_kg']} kg."
            )
        answer = (
            f"Voici les commandes a prevoir ({len(enriched)}):\n"
            + "\n".join(lines)
            + f"\n\nSource des donnees: {forecast_service.data_source}."
        )

    return ChatResponse(
        intent="pro_purchase_recommendations",
        answer=answer,
        data={
            "recommendations": enriched,
            "country": country,
            "source": forecast_service.data_source,
        },
    )


def _with_optional_llm_response(
    response: ChatResponse,
    user_message: str,
    memories: list[dict],
    llm: LLMService,
) -> ChatResponse:
    llm_response = llm.enhance_answer(
        user_message=user_message,
        deterministic_answer=response.answer,
        memories=memories,
    )
    if not llm_response or not llm_response.content:
        return response

    data = response.data or {}
    data["llm"] = {
        "provider": llm_response.provider,
        "model": llm_response.model,
        "used_fallback": llm_response.used_fallback,
    }
    response.data = data
    response.answer = llm_response.content
    return response


@router.get("/capabilities", response_model=CapabilitiesResponse)
def capabilities() -> CapabilitiesResponse:
    provider = llm_service.provider
    return CapabilitiesResponse(
        tier="free",
        language="fr",
        intents=[
            Capability(name="stock_summary", description="Question sur le stock ou l'inventaire."),
            Capability(name="low_stock", description="Liste des bobines en stock faible."),
            Capability(
                name="consumption_entry",
                description="Preparation d'une proposition de saisie de consommation.",
            ),
            Capability(
                name="project_question",
                description="Estimation des besoins matiere d'un projet.",
            ),
            Capability(name="general_question", description="Question generale sur l'assistant."),
        ],
        tools=[
            Capability(name="get_stock_summary", description="Resume le stock disponible."),
            Capability(name="get_stock_item", description="Retrouve une bobine."),
            Capability(name="list_low_stock_items", description="Liste les bobines sous seuil."),
            Capability(
                name="create_consumption_proposal",
                description="Prepare une action de consommation sans l'executer.",
            ),
            Capability(
                name="estimate_project_materials",
                description="Estime les besoins matiere d'un projet.",
            ),
            Capability(
                name="pro_forecasting",
                description="Mode Pro: previsions de rupture, risques, anomalies et notifications.",
            ),
        ],
        limitations=[
            "Aucun vrai LLM n'est branche.",
            "Les donnees viennent de l'API Spooly quand elle est disponible, sinon du mode demo/offline.",
            "Aucune donnee n'est modifiee par le moteur Free.",
            "Les previsions, anomalies, achats recommandes et notifications proactives exigent x-plan: pro.",
        ],
        llm={
            "provider": provider.name,
            "available": provider.is_available(),
            "required": False,
        },
    )
