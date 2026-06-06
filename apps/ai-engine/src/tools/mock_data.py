from src.tools.models import ConsumptionLog, ProjectItem, ProjectMaterialRequirement, StockItem


MOCK_STOCK_ITEMS = [
    StockItem(
        id="fil-pla-noir",
        name="PLA noir BambuLab",
        brand="BambuLab",
        material="PLA",
        color="noir",
        weight_initial_g=1000,
        weight_remaining_g=740,
    ),
    StockItem(
        id="fil-petg-rouge",
        name="PETG rouge Prusament",
        brand="Prusament",
        material="PETG",
        color="rouge",
        weight_initial_g=1000,
        weight_remaining_g=120,
    ),
    StockItem(
        id="fil-petg-blanc",
        name="PETG blanc Prusament",
        brand="Prusament",
        material="PETG",
        color="blanc",
        weight_initial_g=1000,
        weight_remaining_g=680,
    ),
    StockItem(
        id="fil-pla-blanc",
        name="PLA blanc ArianePlast",
        brand="ArianePlast",
        material="PLA",
        color="blanc",
        weight_initial_g=1000,
        weight_remaining_g=35,
    ),
]

MOCK_CONSUMPTIONS = [
    ConsumptionLog(
        id="cons-1",
        filament_id="fil-pla-noir",
        amount_g=42,
        note="Prototype support mural",
    ),
    ConsumptionLog(
        id="cons-2",
        filament_id="fil-petg-rouge",
        amount_g=88,
        note="Boitier exterieur",
    ),
]

MOCK_PROJECTS = [
    ProjectItem(
        id="proj-drone",
        name="Drone FPV",
        status="PLANNING",
        requirements=[
            ProjectMaterialRequirement(material="PLA", color="noir", required_g=220),
            ProjectMaterialRequirement(material="PETG", color="rouge", required_g=180),
        ],
    ),
    ProjectItem(
        id="proj-support",
        name="Support mural",
        status="IN_PROGRESS",
        requirements=[
            ProjectMaterialRequirement(material="PLA", color="blanc", required_g=80),
            ProjectMaterialRequirement(material="PETG", color="blanc", required_g=250),
        ],
    ),
    ProjectItem(
        id="proj-boitier-electronique",
        name="Boitier electronique",
        status="PLANNING",
        requirements=[
            ProjectMaterialRequirement(material="PETG", color="blanc", required_g=420),
            ProjectMaterialRequirement(material="PLA", color="noir", required_g=160),
        ],
    ),
]
