export const SERVER_EXPORT_FORMAT = 'spooly.server-export';
export const SERVER_EXPORT_SCHEMA_VERSION = 1;
export const LEGACY_MOBILE_BACKUP_FORMAT = 'spoolytracker.mobile-backup';

export const DATA_PORTABILITY_SCOPES = [
  'referenceData',
  'inventory',
  'consumption',
  'projects',
  'organizationSettings',
] as const;

export type DataPortabilityScope = (typeof DATA_PORTABILITY_SCOPES)[number];

export type ExportRequestDto = {
  scopes?: DataPortabilityScope[];
  includeGlobalReferenceData?: boolean;
};

export type ImportInspectRequestDto = {
  payload: unknown;
};

export type ImportPreviewRequestDto = {
  payload: unknown;
  mode?: 'replace' | 'merge';
  scopes?: DataPortabilityScope[];
};

export type ImportCommitRequestDto = ImportPreviewRequestDto;

export type FieldDifference = {
  scope: string;
  entity: string;
  field: string;
  kind: 'unknown' | 'missing';
  severity: 'info' | 'warning' | 'error';
};

export type ExportManifest = {
  format: typeof SERVER_EXPORT_FORMAT;
  schemaVersion: typeof SERVER_EXPORT_SCHEMA_VERSION;
  exportId: string;
  exportedAt: string;
  source: {
    apiVersion: string;
    webVersion: string | null;
    dbMigrationVersion: string | null;
    organizationId: number;
  };
  selectedScopes: DataPortabilityScope[];
};

export type ServerExportPayload = {
  manifest: ExportManifest;
  data: Record<string, unknown>;
};
