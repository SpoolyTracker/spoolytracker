// Jeton d'injection pour resoudre AiAlertService sans creer de cycle d'import
// de fichiers (FilamentService -> AiAlertService -> AiAgentService -> FilamentService).
export const AI_ALERT_SERVICE = 'AI_ALERT_SERVICE';
