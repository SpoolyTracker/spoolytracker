import re
from enum import StrEnum

from pydantic import BaseModel, Field

from src.agents.base import AgentResult, BaseAgent
from src.tools.consumption import create_consumption_proposal
from src.tools.models import (
    ConsumptionProposalRequest,
    ConsumptionProposalResponse,
    LowStockRequest,
    LowStockResponse,
    ProjectEstimateRequest,
    ProjectEstimateResponse,
    ProjectItem,
    ProjectRequirementEstimate,
    ProposedAction,
    StockItemRequest,
    StockItem,
    StockItemResponse,
    StockSummaryResponse,
)
from src.tools.projects import estimate_project_materials
from src.tools.stock import get_stock_item, get_stock_summary, list_low_stock_items


class Intent(StrEnum):
    STOCK_SUMMARY = "stock_summary"
    LOW_STOCK = "low_stock"
    CONSUMPTION_ENTRY = "consumption_entry"
    PROJECT_QUESTION = "project_question"
    CALIBRATION = "calibration"
    PURCHASE_QUESTION = "purchase_question"
    GENERAL_QUESTION = "general_question"
    PRO_FEATURE = "pro_feature"


class IntentDetection(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0, le=1)


class FreeAssistantAgent(BaseAgent):
    name = "free_assistant"
    color_aliases = {
        "black": {"black", "noir", "noire"},
        "white": {"white", "blanc", "blanche"},
        "red": {"red", "rouge"},
        "blue": {"blue", "bleu", "bleue"},
        "green": {"green", "vert", "verte"},
        "yellow": {"yellow", "jaune"},
        "orange": {"orange"},
        "gray": {"gray", "grey", "gris", "grise"},
        "silver": {"silver", "argent"},
        "transparent": {"transparent", "translucide"},
    }

    async def run(self, prompt: str, context: dict | None = None) -> AgentResult:
        context = context or {}
        detection = self.detect_intent(prompt)
        active_context = context.get("active_context") or {}
        if self._is_context_selection_message(prompt):
            if active_context.get("mode") == "calibration":
                return self._answer_context_ack(context, expected_use="calibration")
            detection = IntentDetection(intent=Intent.GENERAL_QUESTION, confidence=0.9)
        if (
            detection.intent == Intent.GENERAL_QUESTION
            and active_context.get("mode") == "calibration"
            and self._has_any(prompt.lower(), ["depart", "max", "pas", "hauteur", "propre", "pression", "pressure", "flow"])
        ):
            detection = IntentDetection(intent=Intent.CALIBRATION, confidence=0.9)

        if detection.intent == Intent.PURCHASE_QUESTION:
            return self._answer_purchase(context)

        if detection.intent == Intent.PRO_FEATURE and context.get("plan") != "pro":
            return self._answer_pro_restricted()

        if detection.intent == Intent.LOW_STOCK:
            return self._answer_low_stock(context)

        if detection.intent == Intent.CONSUMPTION_ENTRY:
            return self._answer_consumption(prompt, context)

        if detection.intent == Intent.PROJECT_QUESTION:
            return self._answer_project(prompt, context)

        if detection.intent == Intent.CALIBRATION:
            return self._answer_calibration(prompt, context)

        if detection.intent == Intent.STOCK_SUMMARY:
            return self._answer_stock(prompt, context)

        return self._answer_general(context)

    def detect_intent(self, prompt: str) -> IntentDetection:
        text = prompt.lower()

        if self._has_any(
            text,
            [
                "commande",
                "commander",
                "acheter",
                "achat",
                "racheter",
                "approvision",
                "ravitail",
                "liste de courses",
                "a prevoir",
                "à prévoir",
                "quoi prendre",
            ],
        ):
            return IntentDetection(intent=Intent.PURCHASE_QUESTION, confidence=0.9)

        if self._has_any(
            text,
            [
                "date de rupture",
                "rupture estimee",
                "rupture estimée",
                "prevision",
                "prévision",
                "consommation moyenne",
                "anormale",
                "materiaux a risque",
                "matériaux à risque",
                "recommande un achat",
                "recommander un achat",
                "notification proactive",
                "les indiquer",
                "me les indiquer",
                "detail",
                "détail",
            ],
        ):
            return IntentDetection(intent=Intent.PRO_FEATURE, confidence=0.92)

        if self._has_any(
            text,
            [
                "stock faible",
                "stock bas",
                "presque vide",
                "rupture",
                "manque",
                "faible",
                "bientot vide",
                "bientôt vide",
            ],
        ):
            return IntentDetection(intent=Intent.LOW_STOCK, confidence=0.95)

        if self._has_any(
            text,
            [
                "calibration",
                "calibrer",
                "calibre",
                "debit volumetrique",
                "volumetric",
                "flow tower",
                "hauteur propre",
                "depart ",
                "pas ",
                "temperature tower",
                "tour de temperature",
                "tour de température",
                "sur extrusion",
                "sous extrusion",
                "under extrusion",
                "over extrusion",
                "k-factor",
                "kfactor",
                "pressure advance",
                "retraction",
                "rétraction",
                "flow ratio",
                "flow rate",
                "vfa",
                "encoche",
                "largeur cible",
                "largeur mesuree",
                "largeur mesurée",
            ],
        ):
            return IntentDetection(intent=Intent.CALIBRATION, confidence=0.9)

        if self._looks_like_volumetric_flow_follow_up(text):
            return IntentDetection(intent=Intent.CALIBRATION, confidence=0.88)

        if self._has_any(
            text,
            [
                "consomm",
                "utilise",
                "utilisé",
                "retire",
                "retiré",
                "deduis",
                "déduis",
                "imprime",
                "imprimé",
                "saisir",
                "saisie",
            ],
        ):
            return IntentDetection(intent=Intent.CONSUMPTION_ENTRY, confidence=0.9)

        if self._has_any(text, ["projet", "faisable", "materiaux", "matériaux", "besoin"]):
            return IntentDetection(intent=Intent.PROJECT_QUESTION, confidence=0.88)

        if self._has_any(text, ["stock", "inventaire", "bobine", "filament", "reste"]):
            return IntentDetection(intent=Intent.STOCK_SUMMARY, confidence=0.84)

        return IntentDetection(intent=Intent.GENERAL_QUESTION, confidence=0.45)

    def _answer_pro_restricted(self) -> AgentResult:
        return AgentResult(
            intent=Intent.PRO_FEATURE,
            answer=(
                "Cette demande correspond a une fonctionnalite Pro. "
                "En mode Free, je peux seulement repondre sur le stock actuel, le stock faible, "
                "preparer une saisie de consommation et estimer simplement un projet."
            ),
            data={"required_plan": "pro", "current_plan": "free"},
        )

    def _answer_stock(self, prompt: str, context: dict) -> AgentResult:
        item_query = self._extract_stock_query(prompt)
        if item_query:
            item_response = self._get_stock_item(StockItemRequest(query=item_query), context)
            if item_response.item:
                item = item_response.item
                memory_note = self._memory_note(context)
                item_label = self._display_stock_item(item)
                return AgentResult(
                    intent=Intent.STOCK_SUMMARY,
                    answer=(
                        f"La bobine {item_label} contient {item.weight_remaining_g:g}g restants "
                        f"sur {item.weight_initial_g:g}g, soit environ {item.remaining_percent:g}%."
                        f"{self._source_note(context)}"
                        f"{memory_note}"
                    ),
                    data={
                        "item": item.model_dump(),
                        "source": context.get("data_source", "mock_fallback"),
                        "memories": context.get("memories", []),
                    },
                )

        summary = self._get_stock_summary(context)
        memory_note = self._memory_note(context)
        if self._wants_stock_breakdown(prompt):
            answer, breakdown = self._format_stock_breakdown(summary)
            return AgentResult(
                intent=Intent.STOCK_SUMMARY,
                answer=answer + self._source_note(context) + memory_note,
                data={
                    **summary.model_dump(),
                    "breakdown": breakdown,
                    "source": context.get("data_source", "mock_fallback"),
                    "memories": context.get("memories", []),
                },
            )
        return AgentResult(
            intent=Intent.STOCK_SUMMARY,
            answer=(
                f"Votre inventaire contient {summary.active_items} bobines actives, "
                f"pour un total de {summary.total_remaining_g:g}g disponibles."
                f"{self._source_note(context)}"
                f"{memory_note}"
            ),
            data={
                **summary.model_dump(),
                "source": context.get("data_source", "mock_fallback"),
                "memories": context.get("memories", []),
            },
        )

    def _wants_stock_breakdown(self, prompt: str) -> bool:
        text = prompt.lower()
        return self._has_any(
            text,
            [
                "par matiere",
                "par matière",
                "par materiau",
                "par matériau",
                "par couleur",
                "matiere et couleur",
                "matière et couleur",
                "couleur et matiere",
                "couleur et matière",
                "resume-moi mon stock",
                "résume-moi mon stock",
                "repartition",
                "répartition",
            ],
        )

    def _format_stock_breakdown(
        self,
        summary: StockSummaryResponse,
    ) -> tuple[str, list[dict]]:
        active_items = [item for item in summary.items if item.weight_remaining_g > 0]
        material_groups: dict[str, dict] = {}
        for item in active_items:
            material = item.material or "Matiere inconnue"
            color = self._normalize_display_color(item.color_name or item.color)
            group = material_groups.setdefault(
                material,
                {"material": material, "count": 0, "weight": 0.0, "colors": {}},
            )
            group["count"] += 1
            group["weight"] += item.weight_remaining_g
            color_group = group["colors"].setdefault(
                color,
                {"color": color, "count": 0, "weight": 0.0},
            )
            color_group["count"] += 1
            color_group["weight"] += item.weight_remaining_g

        breakdown = []
        lines = [
            (
                f"Votre stock actif contient {len(active_items)} bobine(s), "
                f"pour un total de {summary.total_remaining_g:g}g disponibles."
            ),
            "",
            "Repartition par matiere et couleur:",
        ]
        for group in sorted(material_groups.values(), key=lambda item: item["weight"], reverse=True):
            colors = sorted(group["colors"].values(), key=lambda item: item["weight"], reverse=True)
            breakdown.append(
                {
                    "material": group["material"],
                    "count": group["count"],
                    "weight": round(group["weight"], 2),
                    "colors": [
                        {
                            "color": color_group["color"],
                            "count": color_group["count"],
                            "weight": round(color_group["weight"], 2),
                        }
                        for color_group in colors
                    ],
                }
            )
            lines.append(
                f"- **{group['material']}**: {group['count']} bobine(s), {round(group['weight'])}g"
            )
            for color_group in colors:
                lines.append(
                    f"  - {color_group['color']}: {color_group['count']} bobine(s), {round(color_group['weight'])}g"
                )
            lines.append("")

        return "\n".join(lines).rstrip(), breakdown

    def _normalize_display_color(self, color: str | None) -> str:
        if not color:
            return "Couleur non renseignee"
        cleaned = color.strip()
        if cleaned in {"-", "_", "—", "–"}:
            return "Couleur non renseignee"
        return cleaned

    def _answer_low_stock(self, context: dict) -> AgentResult:
        low_stock = self._list_low_stock_items(LowStockRequest(threshold_percent=20), context)
        if not low_stock.items:
            return AgentResult(
                intent=Intent.LOW_STOCK,
                answer=(
                    "Aucune bobine n'est sous le seuil de 20%."
                    + self._source_note(context)
                    + self._memory_note(context)
                ),
                data={
                    **low_stock.model_dump(),
                    "source": context.get("data_source", "mock_fallback"),
                    "memories": context.get("memories", []),
                },
            )

        lines = [
            f"- {self._display_stock_item(item)}: {item.weight_remaining_g:g}g restants ({item.remaining_percent:g}%)"
            for item in low_stock.items
        ]
        return AgentResult(
            intent=Intent.LOW_STOCK,
            answer="Voici les bobines en stock faible:\n"
            + "\n".join(lines)
            + self._source_note(context)
            + self._memory_note(context),
            data={
                **low_stock.model_dump(),
                "source": context.get("data_source", "mock_fallback"),
                "memories": context.get("memories", []),
            },
        )

    def _answer_consumption(self, prompt: str, context: dict | None = None) -> AgentResult:
        context = context or {}
        proposal = self._create_consumption_proposal(
            ConsumptionProposalRequest(user_message=prompt),
            context,
        )
        actions = [proposal.action.model_dump()] if proposal.action else []
        actions.extend(action.model_dump() for action in proposal.extra_actions)
        return AgentResult(
            intent=Intent.CONSUMPTION_ENTRY,
            answer=proposal.message,
            requires_confirmation=proposal.action is not None,
            proposed_actions=actions,
            data=proposal.model_dump(),
        )

    def _answer_project(self, prompt: str, context: dict) -> AgentResult:
        estimate = self._estimate_project_materials(ProjectEstimateRequest(query=prompt), context)
        if estimate.project is None:
            return AgentResult(
                intent=Intent.PROJECT_QUESTION,
                answer=(
                    "Je n'ai pas trouve de projet correspondant."
                    + self._source_note(context)
                    + self._memory_note(context)
                ),
                data={
                    **estimate.model_dump(),
                    "source": context.get("data_source", "mock_fallback"),
                    "memories": context.get("memories", []),
                },
            )

        status = "faisable" if estimate.overall_status == "ok" else "a risque"
        details = [
            (
                f"- {item.material} {item.color}: {item.required_g:g}g requis, "
                f"{item.available_g:g}g disponibles ({item.status})"
            )
            for item in estimate.estimates
        ]
        return AgentResult(
            intent=Intent.PROJECT_QUESTION,
            answer=(
                f"Pour le projet {estimate.project.name}, l'estimation est {status}.\n"
                + "\n".join(details)
                + self._source_note(context)
                + self._memory_note(context)
            ),
            data={
                **estimate.model_dump(),
                "source": context.get("data_source", "mock_fallback"),
                "memories": context.get("memories", []),
            },
        )

    def _answer_purchase(self, context: dict) -> AgentResult:
        is_pro = context.get("plan") == "pro"
        low_stock = self._list_low_stock_items(LowStockRequest(threshold_percent=20), context)
        if not low_stock.items:
            base = (
                "Aucune bobine n'est sous le seuil de 20% pour le moment, "
                "rien d'urgent a commander."
            )
        else:
            lines = [
                f"- {self._display_stock_item(item)}: "
                f"{item.weight_remaining_g:g}g restants ({item.remaining_percent:g}%)"
                for item in low_stock.items
            ]
            base = "Bobines a surveiller pour une commande (stock faible):\n" + "\n".join(lines)

        if not is_pro:
            base += (
                "\n\nPour des recommandations d'achat anticipees (dates de rupture estimees), "
                "des quantites suggerees et des liens fournisseurs adaptes a votre pays, "
                "passez en Pro."
            )

        return AgentResult(
            intent=Intent.PURCHASE_QUESTION,
            answer=base + self._source_note(context) + self._memory_note(context),
            data={
                **low_stock.model_dump(),
                "source": context.get("data_source", "mock_fallback"),
                "memories": context.get("memories", []),
                "plan": context.get("plan", "free"),
                "upsell": not is_pro,
            },
        )

    def _answer_calibration(self, prompt: str, context: dict) -> AgentResult:
        text = prompt.lower().replace(",", ".")
        kind = self._detect_calibration_kind(text)
        if kind == "flow_ratio":
            return self._answer_flow_ratio_calibration(prompt, context)
        if kind == "pressure_advance":
            return self._answer_pressure_advance_calibration(prompt, context)
        if kind == "temp_tower":
            return self._answer_temp_tower_calibration(prompt, context)
        if kind == "retraction":
            return self._answer_retraction_calibration(prompt, context)
        if kind == "vfa":
            return self._answer_vfa_calibration(prompt, context)

        flow = self._extract_volumetric_flow_calibration(prompt)
        if flow:
            start, maximum, step, clean_height, safety_percent = flow
            observed = min(start + clean_height * step, maximum)
            recommended = observed * safety_percent / 100
            tower_height = (maximum - start) / step if step > 0 else 0
            active_items = self._active_stock_items(context)
            candidates = self._find_consumption_candidates(prompt, active_items) if active_items else []
            if not candidates:
                candidates = active_items or self._find_consumption_candidates(prompt, self._stock_items(context) or [])
            item = candidates[0] if len(candidates) == 1 else None
            proposed_actions = []
            action_note = ""
            if item:
                proposed_actions.append(
                    ProposedAction(
                        type="update_filament_calibration",
                        label=(
                            f"Appliquer {recommended:.2f} mm3/s comme debit volumetrique max "
                            f"sur {self._display_stock_item(item)}"
                        ),
                        payload={
                            "filament_id": item.id,
                            "max_volumetric_speed_mm3_s": round(recommended, 2),
                            "calibration_type": "max_volumetric_speed",
                        },
                    ).model_dump()
                )
                action_note = (
                    f"\n\nJ'ai identifie la bobine **{self._display_stock_item(item)}**. "
                    "Je peux proposer l'application de cette valeur apres validation."
                )
            elif len(candidates) > 1:
                action_note = (
                    "\n\nPlusieurs bobines sont dans le contexte actif. Garde une seule bobine "
                    "selectionnee, ou precise la marque, la matiere ou la couleur."
                )
            elif self._stock_items(context):
                action_note = (
                    "\n\nJe n'ai pas identifie la bobine cible. Ajoute son nom, sa marque, "
                    "sa matiere ou sa couleur pour que je propose la modification automatiquement."
                )
            warning = ""
            if clean_height > tower_height:
                warning = (
                    "\n\nAttention: la hauteur mesuree depasse la hauteur utile de la tour. "
                    "J'ai donc borne le resultat a la valeur max du test."
                )
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Calcul de debit volumetrique max:\n"
                    f"- depart: {start:g} mm3/s\n"
                    f"- maximum du test: {maximum:g} mm3/s\n"
                    f"- pas: {step:g} mm3/s par mm\n"
                    f"- hauteur propre mesuree: {clean_height:g} mm\n\n"
                    f"Debit observe: **{observed:.2f} mm3/s**.\n"
                    f"Valeur recommandee avec marge {safety_percent:g}%: "
                    f"**{recommended:.2f} mm3/s**.\n\n"
                    "Formule: depart + hauteur propre x pas. "
                    f"La tour couvre environ {tower_height:.2f} mm de hauteur utile."
                    f"{warning}"
                    f"{action_note}"
                ),
                requires_confirmation=bool(proposed_actions),
                proposed_actions=proposed_actions,
                data={
                    "calibration_type": "max_volumetric_speed",
                    "start_mm3_s": start,
                    "max_mm3_s": maximum,
                    "step_mm3_s_per_mm": step,
                    "clean_height_mm": clean_height,
                    "observed_mm3_s": round(observed, 2),
                    "recommended_mm3_s": round(recommended, 2),
                    "safety_percent": safety_percent,
                    "tower_height_mm": round(tower_height, 2),
                    "source": context.get("data_source", "mock_fallback"),
                },
            )

        if self._has_any(prompt.lower(), ["photo", "image", "upload", "vision"]):
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Je peux deja aider a interpreter une calibration, mais ce chat ne recoit pas encore "
                    "la photo directement. Pour l'analyse image, il faut brancher un endpoint vision dedie: "
                    "type de tour, plage de temperature, et zone observee. Ensuite je pourrai renvoyer "
                    "une hypothese comme temperature optimale, sur/sous extrusion, stringing ou refroidissement."
                ),
                data={
                    "calibration_type": "vision_planned",
                    "supported_future_observations": [
                        "temperature_tower",
                        "max_volumetric_speed",
                        "flow_rate",
                        "pressure_advance",
                        "retraction",
                        "over_under_extrusion",
                    ],
                },
            )

        return AgentResult(
            intent=Intent.CALIBRATION,
            answer=(
                "Je peux t'aider pour plusieurs calibrations filament. Decris ton test, par exemple:\n"
                "- Debit volumetrique: depart 5, max 20, pas 0.5, hauteur propre 22 mm\n"
                "- Flow ratio: largeur cible 0.45, mesuree 0.47\n"
                "- Pressure advance: depart 0, pas 0.002, meilleure ligne 35\n"
                "- Tour de temperature: depart 230, pas 5, meilleure section 3\n"
                "- Retraction: depart 0.2, pas 0.1, meilleure section 4\n"
                "- VFA: depart 160, pas 20, encoche 11, temperature 220\n\n"
                "Avec une seule bobine selectionnee, je propose d'appliquer la valeur (apres confirmation)."
            ),
            data={
                "supported_calibrations": [
                    "max_volumetric_speed",
                    "flow_ratio",
                    "pressure_advance",
                    "temperature_tower",
                    "retraction",
                    "vfa_max_speed",
                ],
            },
        )

    def _answer_context_ack(self, context: dict, expected_use: str | None = None) -> AgentResult:
        active_items = self._active_stock_items(context)
        project = self._active_project(context)
        parts = []
        if active_items:
            labels = ", ".join(self._display_stock_item(item) for item in active_items[:3])
            if len(active_items) > 3:
                labels += f", +{len(active_items) - 3}"
            parts.append(f"bobine(s): {labels}")
        if project:
            parts.append(f"projet: {project.name}")
        if not parts:
            return AgentResult(
                intent=Intent.GENERAL_QUESTION,
                answer=(
                    "Je n'ai pas encore de bobine ou projet dans le contexte actif. "
                    "Selectionne une bobine ou un projet dans l'encart de la fenetre IA, puis renvoie ta demande."
                ),
                data={"active_context": context.get("active_context")},
            )
        usage = (
            " Pour une calibration deja calculee, renvoie simplement la ligne de mesure ou dis "
            "`applique ce calcul`, et je proposerai la modification si une seule bobine est ciblee."
            if expected_use == "calibration"
            else ""
        )
        return AgentResult(
            intent=Intent.GENERAL_QUESTION,
            answer=f"Contexte actif pris en compte: {'; '.join(parts)}.{usage}",
            data={"active_context": context.get("active_context")},
        )

    def _detect_calibration_kind(self, text: str) -> str | None:
        if self._has_any(text, ["vfa", "encoche"]):
            return "vfa"
        if self._has_any(text, ["pressure advance", "pressure_advance", "k-factor", "kfactor", "k factor"]):
            return "pressure_advance"
        if self._has_any(text, ["tour de temperature", "tour de température", "temperature tower", "temp tower", "tour temp"]):
            return "temp_tower"
        if self._has_any(text, ["retraction", "rétraction", "retract"]):
            return "retraction"
        if self._has_any(text, ["flow ratio", "flow rate", "ratio de debit", "ratio de débit", "largeur cible", "largeur mesuree", "largeur mesurée"]):
            return "flow_ratio"
        return None

    def _find_labeled_value(self, text: str, labels: list[str]) -> float | None:
        joined = "|".join(re.escape(label) for label in labels)
        match = re.search(
            rf"(?:{joined})\s*(?:=|:|a|de)?\s*(-?\d+(?:\.\d+)?)",
            text,
            flags=re.IGNORECASE,
        )
        return float(match.group(1)) if match else None

    def _calibration_numbers(self, text: str) -> list[float]:
        return [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", text)]

    def _resolve_calibration_target(
        self, prompt: str, context: dict
    ) -> tuple[StockItem | None, list[StockItem]]:
        active_items = self._active_stock_items(context)
        candidates = self._find_consumption_candidates(prompt, active_items) if active_items else []
        if not candidates:
            candidates = active_items or self._find_consumption_candidates(prompt, self._stock_items(context) or [])
        item = candidates[0] if len(candidates) == 1 else None
        return item, candidates

    def _calibration_target_note(
        self, item: StockItem | None, candidates: list[StockItem], context: dict
    ) -> str:
        if item:
            return (
                f"\n\nJ'ai identifie la bobine **{self._display_stock_item(item)}**. "
                "Je peux proposer l'application de cette valeur apres validation."
            )
        if len(candidates) > 1:
            return (
                "\n\nPlusieurs bobines sont dans le contexte actif. Garde une seule bobine "
                "selectionnee, ou precise la marque, la matiere ou la couleur."
            )
        if self._stock_items(context):
            return (
                "\n\nJe n'ai pas identifie la bobine cible. Ajoute son nom, sa marque, "
                "sa matiere ou sa couleur pour que je propose la modification automatiquement."
            )
        return ""

    def _calibration_action(
        self, item: StockItem, label: str, extra_payload: dict
    ) -> list[dict]:
        payload = {"filament_id": item.id, **extra_payload}
        return [
            ProposedAction(
                type="update_filament_calibration",
                label=label,
                payload=payload,
            ).model_dump()
        ]

    def _answer_flow_ratio_calibration(self, prompt: str, context: dict) -> AgentResult:
        text = prompt.lower().replace(",", ".")
        expected = self._find_labeled_value(text, ["largeur cible", "cible", "largeur attendue", "attendu", "expected"])
        measured = self._find_labeled_value(text, ["largeur mesuree", "largeur mesurée", "mesuree", "mesurée", "mesure", "measured"])
        if expected is None or measured is None:
            nums = self._calibration_numbers(text)
            if len(nums) >= 2:
                expected, measured = nums[0], nums[1]
        if expected is None:
            expected = 0.45
        item, candidates = self._resolve_calibration_target(prompt, context)
        current = item.flow_ratio if item and item.flow_ratio else 1.0
        if measured is None or measured <= 0 or expected <= 0:
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Pour le flow ratio, donne-moi la largeur cible (defaut 0.45 mm) et la largeur mesuree. "
                    "Ex: flow ratio, largeur cible 0.45, mesuree 0.47."
                ),
                data={"calibration_type": "flow_ratio"},
            )
        result = round(current * expected / measured, 3)
        note = self._calibration_target_note(item, candidates, context)
        proposed_actions = (
            self._calibration_action(
                item,
                f"Appliquer flow ratio {result} sur {self._display_stock_item(item)}",
                {"flow_ratio": result, "calibration_type": "flow_ratio"},
            )
            if item
            else []
        )
        return AgentResult(
            intent=Intent.CALIBRATION,
            answer=(
                f"Flow ratio calcule: **{result}**.\n"
                f"- flow ratio actuel: {current:g}\n"
                f"- largeur cible: {expected:g} mm\n"
                f"- largeur mesuree: {measured:g} mm\n\n"
                "Formule: flow actuel x cible / mesuree."
                f"{note}"
            ),
            requires_confirmation=bool(proposed_actions),
            proposed_actions=proposed_actions,
            data={
                "calibration_type": "flow_ratio",
                "flow_ratio": result,
                "current_flow_ratio": current,
                "expected_width_mm": expected,
                "measured_width_mm": measured,
            },
        )

    def _answer_pressure_advance_calibration(self, prompt: str, context: dict) -> AgentResult:
        text = prompt.lower().replace(",", ".")
        start = self._find_labeled_value(text, ["depart", "départ", "start"])
        step = self._find_labeled_value(text, ["pas", "step", "increment"])
        line = self._find_labeled_value(text, ["meilleure ligne", "ligne", "best line", "line"])
        if start is None or step is None or line is None:
            nums = self._calibration_numbers(text)
            if len(nums) >= 3:
                start, step, line = nums[0], nums[1], nums[2]
        if start is None:
            start = 0.0
        if step is None or line is None or step <= 0 or line < 1:
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Pour le pressure advance, donne-moi depart, pas et la meilleure ligne. "
                    "Ex: pressure advance depart 0, pas 0.002, meilleure ligne 35."
                ),
                data={"calibration_type": "pressure_advance"},
            )
        result = round(start + (line - 1) * step, 4)
        item, candidates = self._resolve_calibration_target(prompt, context)
        note = self._calibration_target_note(item, candidates, context)
        proposed_actions = (
            self._calibration_action(
                item,
                f"Appliquer K-factor {result} sur {self._display_stock_item(item)}",
                {"k_factor": result, "calibration_type": "pressure_advance"},
            )
            if item
            else []
        )
        return AgentResult(
            intent=Intent.CALIBRATION,
            answer=(
                f"Pressure advance (K-factor) calcule: **{result}**.\n"
                f"- depart: {start:g}\n- pas: {step:g}\n- meilleure ligne: {line:g}\n\n"
                "Formule: depart + (ligne - 1) x pas."
                f"{note}"
            ),
            requires_confirmation=bool(proposed_actions),
            proposed_actions=proposed_actions,
            data={
                "calibration_type": "pressure_advance",
                "k_factor": result,
                "start": start,
                "step": step,
                "best_line": line,
            },
        )

    def _answer_temp_tower_calibration(self, prompt: str, context: dict) -> AgentResult:
        text = prompt.lower().replace(",", ".")
        start = self._find_labeled_value(text, ["temp depart", "temperature depart", "température depart", "depart", "départ", "start"])
        step = self._find_labeled_value(text, ["pas", "step", "increment"])
        index = self._find_labeled_value(text, ["meilleure section", "section", "best section", "meilleure", "best"])
        if start is None or step is None or index is None:
            nums = self._calibration_numbers(text)
            if len(nums) >= 3:
                start, step, index = nums[0], nums[1], nums[2]
        if start is None or step is None or index is None or step <= 0:
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Pour la tour de temperature, donne-moi la temperature de depart, le pas et la meilleure section. "
                    "Ex: tour de temperature depart 230, pas 5, meilleure section 3."
                ),
                data={"calibration_type": "temperature_tower"},
            )
        result = round(start - index * step)
        item, candidates = self._resolve_calibration_target(prompt, context)
        note = self._calibration_target_note(item, candidates, context)
        proposed_actions = (
            self._calibration_action(
                item,
                f"Appliquer temperature {result} C sur {self._display_stock_item(item)}",
                {"nozzle_temp_min_c": result, "nozzle_temp_max_c": result, "calibration_type": "temperature_tower"},
            )
            if item
            else []
        )
        return AgentResult(
            intent=Intent.CALIBRATION,
            answer=(
                f"Temperature optimale: **{result} C**.\n"
                f"- temperature de depart: {start:g} C\n- pas: {step:g} C\n- meilleure section: {index:g}\n\n"
                "Formule: depart - section x pas (la tour imprime du chaud vers le froid)."
                f"{note}"
            ),
            requires_confirmation=bool(proposed_actions),
            proposed_actions=proposed_actions,
            data={
                "calibration_type": "temperature_tower",
                "optimal_temp_c": result,
                "start": start,
                "step": step,
                "best_section": index,
            },
        )

    def _answer_retraction_calibration(self, prompt: str, context: dict) -> AgentResult:
        text = prompt.lower().replace(",", ".")
        start = self._find_labeled_value(text, ["depart", "départ", "start"])
        step = self._find_labeled_value(text, ["pas", "step", "increment"])
        index = self._find_labeled_value(text, ["meilleure section", "section", "best section", "meilleure", "best"])
        if start is None or step is None or index is None:
            nums = self._calibration_numbers(text)
            if len(nums) >= 3:
                start, step, index = nums[0], nums[1], nums[2]
        if start is None or step is None or index is None or step <= 0:
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Pour la retraction, donne-moi depart, pas et la meilleure section. "
                    "Ex: retraction depart 0.2, pas 0.1, meilleure section 4."
                ),
                data={"calibration_type": "retraction"},
            )
        result = round(start + index * step, 2)
        item, candidates = self._resolve_calibration_target(prompt, context)
        note = self._calibration_target_note(item, candidates, context)
        proposed_actions = (
            self._calibration_action(
                item,
                f"Appliquer retraction {result} mm sur {self._display_stock_item(item)}",
                {"retraction_distance_mm": result, "calibration_type": "retraction"},
            )
            if item
            else []
        )
        return AgentResult(
            intent=Intent.CALIBRATION,
            answer=(
                f"Distance de retraction: **{result} mm**.\n"
                f"- depart: {start:g} mm\n- pas: {step:g} mm\n- meilleure section: {index:g}\n\n"
                "Formule: depart + section x pas."
                f"{note}"
            ),
            requires_confirmation=bool(proposed_actions),
            proposed_actions=proposed_actions,
            data={
                "calibration_type": "retraction",
                "retraction_distance_mm": result,
                "start": start,
                "step": step,
                "best_section": index,
            },
        )

    def _answer_vfa_calibration(self, prompt: str, context: dict) -> AgentResult:
        text = prompt.lower().replace(",", ".")
        start = self._find_labeled_value(text, ["depart", "départ", "start"])
        step = self._find_labeled_value(text, ["pas", "step", "increment"])
        notch = self._find_labeled_value(text, ["encoche", "notch"])
        temp = self._find_labeled_value(text, ["temperature", "température", "temp"])
        if start is None or step is None or notch is None:
            nums = self._calibration_numbers(text)
            if len(nums) >= 4:
                start, step, notch, temp = nums[0], nums[1], nums[2], nums[3]
            elif len(nums) >= 3:
                start, step, notch = nums[0], nums[1], nums[2]
        if start is None or step is None or notch is None or step <= 0 or notch < 1:
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    "Pour le VFA, donne-moi depart, pas, l'encoche ou apparaissent les artefacts et la temperature. "
                    "Ex: VFA depart 160, pas 20, encoche 11, temperature 220."
                ),
                data={"calibration_type": "vfa_max_speed"},
            )
        vmax = round(start + step * (notch - 1))
        if temp is None:
            return AgentResult(
                intent=Intent.CALIBRATION,
                answer=(
                    f"Vitesse max VFA: **{vmax} mm/s** (depart {start:g} + pas {step:g} x (encoche {notch:g} - 1)).\n\n"
                    "Donne-moi aussi la temperature du test pour que je propose la regle conditionnelle "
                    "(vitesse max a cette temperature). Ex: ... temperature 220."
                ),
                data={"calibration_type": "vfa_max_speed", "vfa_max_speed_mm_s": vmax},
            )
        item, candidates = self._resolve_calibration_target(prompt, context)
        note = self._calibration_target_note(item, candidates, context)
        proposed_actions = (
            self._calibration_action(
                item,
                f"Appliquer vitesse max {vmax} mm/s a {temp:g} C sur {self._display_stock_item(item)}",
                {
                    "vfa_max_speed_mm_s": vmax,
                    "vfa_temperature_c": temp,
                    "calibration_type": "vfa_max_speed",
                },
            )
            if item
            else []
        )
        return AgentResult(
            intent=Intent.CALIBRATION,
            answer=(
                f"Vitesse max VFA: **{vmax} mm/s** a **{temp:g} C**.\n"
                f"- depart: {start:g} mm/s\n- pas: {step:g} mm/s\n- encoche: {notch:g}\n\n"
                "Formule: depart + pas x (encoche - 1). J'ajoute une regle de vitesse max conditionnelle "
                "pour cette temperature et je remonte la vitesse max d'impression si besoin."
                f"{note}"
            ),
            requires_confirmation=bool(proposed_actions),
            proposed_actions=proposed_actions,
            data={
                "calibration_type": "vfa_max_speed",
                "vfa_max_speed_mm_s": vmax,
                "vfa_temperature_c": temp,
                "start": start,
                "step": step,
                "notch": notch,
            },
        )

    def _extract_volumetric_flow_calibration(
        self,
        prompt: str,
    ) -> tuple[float, float, float, float, float] | None:
        text = prompt.lower().replace(",", ".")
        if not (
            self._has_any(text, ["debit", "volumetric", "volumetrique"])
            or self._looks_like_volumetric_flow_follow_up(text)
        ):
            return None

        def find_value(labels: list[str]) -> float | None:
            joined = "|".join(re.escape(label) for label in labels)
            match = re.search(
                rf"(?:{joined})\s*(?:=|:|a|de)?\s*(-?\d+(?:\.\d+)?)",
                text,
                flags=re.IGNORECASE,
            )
            return float(match.group(1)) if match else None

        start = find_value(["depart", "start", "valeur de depart"])
        maximum = find_value(["max", "maximum", "valeur max", "valeur maximum"])
        step = find_value(["pas", "step", "increment"])
        clean_height = find_value(
            [
                "hauteur propre",
                "hauteur",
                "mesure",
                "clean height",
                "dernier propre",
            ]
        )
        safety_percent = find_value(["marge", "securite", "safety"]) or 95

        if start is None or maximum is None or step is None or clean_height is None:
            numbers = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", text)]
            if len(numbers) >= 4:
                start, maximum, step, clean_height = numbers[:4]

        if (
            start is None
            or maximum is None
            or step is None
            or clean_height is None
            or step <= 0
            or maximum <= start
        ):
            return None

        return start, maximum, step, clean_height, max(0, min(safety_percent, 100))

    def _answer_general(self, context: dict) -> AgentResult:
        is_pro = context.get("plan") == "pro"
        if is_pro:
            answer = (
                "Je suis l'assistant IA Pro de Spooly. En plus des questions de stock, "
                "stock faible, saisie de consommation et besoins projet, je peux estimer "
                "les dates de rupture, detecter les anomalies, signaler les materiaux et "
                "projets a risque, recommander des achats et retenir vos preferences."
            )
        else:
            answer = (
                "Je suis l'assistant IA Free de Spooly. Je peux repondre sur le stock, "
                "le stock faible, preparer une saisie de consommation et estimer les besoins "
                "d'un projet avec les donnees disponibles."
            )
        return AgentResult(
            intent=Intent.GENERAL_QUESTION,
            answer=answer + self._source_note(context) + self._memory_note(context),
            data={
                "source": context.get("data_source", "mock_fallback"),
                "memories": context.get("memories", []),
                "plan": context.get("plan", "free"),
            },
        )

    def _extract_stock_query(self, prompt: str) -> str | None:
        text = prompt.lower()
        candidates = [
            "pla noir",
            "pla blanc",
            "petg rouge",
            "petg blanc",
            "bambulab",
            "prusament",
            "arianeplast",
            "noir",
            "rouge",
            "blanc",
        ]
        for candidate in candidates:
            if candidate in text:
                return candidate
        return None

    def _has_any(self, text: str, needles: list[str]) -> bool:
        return any(needle in text for needle in needles)

    def _looks_like_volumetric_flow_follow_up(self, text: str) -> bool:
        tokens = ["depart", "départ", "max", "pas", "hauteur", "propre"]
        score = sum(1 for token in tokens if token in text)
        return score >= 3 and len(re.findall(r"-?\d+(?:[,.]\d+)?", text)) >= 3

    def _is_context_selection_message(self, prompt: str) -> bool:
        text = prompt.lower()
        if self._looks_like_volumetric_flow_follow_up(text):
            return False
        has_context_word = self._has_any(text, ["contexte", "selection", "sélection"])
        has_action_word = self._has_any(
            text,
            ["saisi", "saisie", "saisir", "selectionne", "selectionnee", "sélectionné", "choisi"],
        )
        has_amount = re.search(r"\d+(?:[,.]\d+)?\s*(g|gr|grammes|kg)\b", text) is not None
        return has_context_word and has_action_word and not has_amount

    def _memory_note(self, context: dict) -> str:
        memories = context.get("memories") or []
        if not memories:
            return ""

        lines = [f"- {memory['content']}" for memory in memories[:3]]
        return "\n\nMemoire pertinente utilisee:\n" + "\n".join(lines)

    def _source_note(self, context: dict) -> str:
        source = context.get("data_source")
        if source == "main_api":
            return "\n\nSource des donnees: API Spooly."
        if source:
            return "\n\nSource des donnees: mode demo/offline."
        return ""

    def _stock_items(self, context: dict) -> list[StockItem] | None:
        items = context.get("stock_items")
        return items if isinstance(items, list) else None

    def _projects(self, context: dict) -> list[ProjectItem] | None:
        projects = context.get("projects")
        return projects if isinstance(projects, list) else None

    def _active_stock_items(self, context: dict) -> list[StockItem]:
        active_context = context.get("active_context") or {}
        active_ids = {
            str(item_id)
            for item_id in active_context.get("filament_ids", [])
            if item_id is not None
        }
        if not active_ids:
            return []
        return [item for item in (self._stock_items(context) or []) if item.id in active_ids]

    def _active_project(self, context: dict) -> ProjectItem | None:
        active_context = context.get("active_context") or {}
        project_id = active_context.get("project_id")
        if not project_id:
            return None
        for project in self._projects(context) or []:
            if project.id == str(project_id):
                return project
        return None

    def _get_stock_summary(self, context: dict) -> StockSummaryResponse:
        items = self._stock_items(context)
        if items is None:
            return get_stock_summary()
        return StockSummaryResponse(
            active_items=len([item for item in items if item.weight_remaining_g > 0]),
            total_remaining_g=round(sum(item.weight_remaining_g for item in items), 2),
            total_initial_g=round(sum(item.weight_initial_g for item in items), 2),
            items=items,
        )

    def _get_stock_item(self, request: StockItemRequest, context: dict) -> StockItemResponse:
        items = self._stock_items(context)
        if items is None:
            return get_stock_item(request)
        for item in items:
            if self._matches_stock_item(item, request.query):
                return StockItemResponse(item=item)
        return StockItemResponse(item=None)

    def _list_low_stock_items(self, request: LowStockRequest, context: dict) -> LowStockResponse:
        items = self._stock_items(context)
        if items is None:
            return list_low_stock_items(request)
        low_stock = [
            item
            for item in items
            if item.weight_initial_g > 0
            and item.weight_remaining_g / item.weight_initial_g * 100 <= request.threshold_percent
        ]
        return LowStockResponse(items=sorted(low_stock, key=lambda item: item.remaining_percent))

    def _estimate_project_materials(
        self,
        request: ProjectEstimateRequest,
        context: dict,
    ) -> ProjectEstimateResponse:
        projects = self._projects(context)
        items = self._stock_items(context)
        if projects is None or items is None:
            return estimate_project_materials(request)

        project = self._active_project(context) or self._find_project(request.query, projects)
        if project is None:
            return ProjectEstimateResponse(project=None, estimates=[], overall_status="unknown")

        estimates: list[ProjectRequirementEstimate] = []
        for requirement in project.requirements:
            available_g = sum(
                item.weight_remaining_g
                for item in items
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
                )
            )

        overall_status = "ok" if all(item.status == "ok" for item in estimates) else "risk"
        return ProjectEstimateResponse(project=project, estimates=estimates, overall_status=overall_status)

    def _create_consumption_proposal(
        self,
        request: ConsumptionProposalRequest,
        context: dict,
    ) -> ConsumptionProposalResponse:
        items = self._stock_items(context)
        if items is None:
            return create_consumption_proposal(request)

        amount_g = request.amount_g or self._extract_amount_g(request.user_message)
        candidates = self._find_consumption_candidates(request.user_message, items)
        if not candidates:
            candidates = self._active_stock_items(context)
        item = candidates[0] if len(candidates) == 1 else None
        requested_project_name = self._extract_project_name(request.user_message)
        project = self._find_project_exact(request.user_message, self._projects(context) or []) or self._active_project(context)

        if amount_g is None:
            return create_consumption_proposal(request)

        if len(candidates) > 1:
            options = "\n".join(
                f"- {candidate.brand} {candidate.name}: {candidate.weight_remaining_g:g}g restants"
                for candidate in candidates[:5]
            )
            return ConsumptionProposalResponse(
                item=None,
                amount_g=amount_g,
                action=None,
                message=(
                    "J'ai trouve plusieurs bobines possibles pour cette consommation. "
                    "Precisez la marque ou la reference pour que je prepare la bonne saisie:\n"
                    f"{options}\n\nAucune donnee n'a ete modifiee."
                    f"{self._source_note(context)}"
                ),
            )

        if item is None:
            return ConsumptionProposalResponse(
                item=None,
                amount_g=amount_g,
                action=None,
                message=(
                    "Je peux preparer la saisie, mais je n'ai pas identifie "
                    "une bobine correspondant exactement a la matiere et a la couleur demandees. "
                    "Aucune donnee n'a ete modifiee."
                    f"{self._source_note(context)}"
                ),
            )

        project_missing_action = None
        if requested_project_name and project is None:
            project_missing_action = ProposedAction(
                type="create_project",
                label=f"Creer le projet {requested_project_name}",
                payload={
                    "name": requested_project_name,
                    "description": (
                        "Projet cree avec l'assistant Spooly. "
                        f"Besoin initial detecte: {amount_g:g}g sur {item.name}."
                    ),
                    "filament_id": item.id,
                    "amount_g": amount_g,
                },
                requires_confirmation=False,
            )

        remaining_before_g = item.weight_remaining_g
        remaining_after_g = max(remaining_before_g - amount_g, 0)
        message = (
            f"Je propose d'enregistrer {amount_g:g}g de consommation sur {item.name}. "
            f"La bobine contient actuellement {remaining_before_g:g}g; "
            f"il resterait {remaining_after_g:g}g apres validation. "
            "Aucune donnee n'a ete modifiee."
        )
        if amount_g > remaining_before_g:
            message += (
                f"\n\nAttention: la quantite demandee depasse le stock restant "
                f"de {amount_g - remaining_before_g:g}g."
            )
        if requested_project_name and project is None:
            message += (
                f"\n\nJe n'ai pas trouve le projet {requested_project_name}. "
                "Vous pouvez le creer avant d'associer cette consommation au projet."
            )
        message += self._source_note(context)

        return ConsumptionProposalResponse(
            item=item,
            amount_g=amount_g,
            action=ProposedAction(
                type="create_consumption",
                label=(
                    f"Enregistrer {amount_g:g}g consommes sur {item.name} "
                    f"({remaining_after_g:g}g restants)"
                ),
                payload={
                    "filament_id": item.id,
                    "amount_g": amount_g,
                    "type": "PRINT",
                    **({"project_id": project.id} if project else {}),
                    **({"pending_project_name": requested_project_name} if requested_project_name and project is None else {}),
                },
            ),
            message=message,
            extra_actions=[project_missing_action] if project_missing_action else [],
        )

    def _find_project(self, query: str, projects: list[ProjectItem]) -> ProjectItem | None:
        normalized = query.lower()
        for project in projects:
            if project.name.lower() in normalized:
                return project
        for project in projects:
            project_name = project.name.lower()
            if any(token in project_name for token in normalized.split() if len(token) > 2):
                return project
        return projects[0] if projects else None

    def _find_project_exact(self, query: str, projects: list[ProjectItem]) -> ProjectItem | None:
        normalized = query.lower()
        for project in projects:
            if project.name.lower() in normalized:
                return project
        return None

    def _display_stock_item(self, item: StockItem) -> str:
        label = item.name
        if item.brand and item.brand.lower() not in label.lower():
            label = f"{label} {item.brand}"
        return label

    def _extract_project_name(self, query: str) -> str | None:
        match = re.search(r"\bprojet\s+(.+?)(?:[.!?]|$)", query, flags=re.IGNORECASE)
        if not match:
            return None
        name = match.group(1).strip(" .,:;")
        return name[:80] if name else None

    def _find_consumption_item(self, query: str, items: list[StockItem]) -> StockItem | None:
        candidates = self._find_consumption_candidates(query, items)
        return candidates[0] if candidates else None

    def _find_consumption_candidates(self, query: str, items: list[StockItem]) -> list[StockItem]:
        query_tokens = [token for token in self._tokens(query) if len(token) > 2]
        requested_colors = self._requested_color_aliases(query)
        best_score = 0
        scored: list[tuple[int, StockItem]] = []
        for item in items:
            haystack = " ".join([item.name, item.brand, item.material, item.color]).lower()
            if requested_colors and not self._haystack_matches_requested_color(haystack, requested_colors):
                continue
            score = sum(1 for token in query_tokens if token in haystack)
            if requested_colors:
                score += 3
            if score > best_score:
                best_score = score
            if score > 0:
                scored.append((score, item))

        return [item for score, item in scored if score == best_score]

    def _extract_amount_g(self, message: str) -> float | None:
        match = re.search(r"(\d+(?:[,.]\d+)?)\s*(g|gr|grammes|kg)\b", message.lower())
        if not match:
            return None
        value = float(match.group(1).replace(",", "."))
        return value * 1000 if match.group(2) == "kg" else value

    def _matches_stock_item(self, item: StockItem, query: str) -> bool:
        normalized = query.lower()
        haystack = " ".join([item.id, item.name, item.brand, item.material, item.color]).lower()
        requested_colors = self._requested_color_aliases(query)
        if requested_colors and not self._haystack_matches_requested_color(haystack, requested_colors):
            return False
        return all(
            token in haystack
            for token in self._tokens(normalized)
            if len(token) > 1 and token not in requested_colors
        )

    def _requested_color_aliases(self, query: str) -> set[str]:
        tokens = set(self._tokens(query))
        requested: set[str] = set()
        for aliases in self.color_aliases.values():
            if tokens.intersection(aliases):
                requested.update(aliases)
        return requested

    def _haystack_matches_requested_color(self, haystack: str, requested_colors: set[str]) -> bool:
        tokens = set(self._tokens(haystack))
        return any(color in tokens for color in requested_colors)

    def _tokens(self, value: str) -> list[str]:
        return re.findall(r"[a-zA-ZÀ-ÿ0-9#]+", value.lower())
