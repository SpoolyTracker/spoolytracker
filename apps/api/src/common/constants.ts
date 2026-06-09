export const PLAN_LIMITS = {
  free: {
    maxSpoolsPerOrg: 20,
    maxMembersPerOrg: 3,
    maxProjectsPerOrg: 5,
    maxFileUploadSizeMb: 20,
    maxFilesPerProject: 3,
  },
  pro: {
    maxSpoolsPerOrg: 50,
    maxMembersPerOrg: 20,
    maxProjectsPerOrg: 50,
    maxFileUploadSizeMb: 100,
    maxFilesPerProject: 10,
  },
  beta: {
    maxSpoolsPerOrg: 100,
    maxMembersPerOrg: 20,
    maxProjectsPerOrg: 50,
    maxFileUploadSizeMb: 100,
    maxFilesPerProject: 10,
  },
  enterprise: {
    maxSpoolsPerOrg: Infinity,
    maxMembersPerOrg: Infinity,
    maxProjectsPerOrg: Infinity,
    maxFileUploadSizeMb: 200,
    maxFilesPerProject: Infinity,
  },
};
