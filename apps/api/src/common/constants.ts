export const PLAN_LIMITS = {
  free: {
    maxSpoolsPerOrg: 30,
    maxMembersPerOrg: 3,
    maxProjectsPerOrg: 5,
    maxFileUploadSizeMb: 20,
    maxFilesPerProject: 3,
  },
  pro: {
    maxSpoolsPerOrg: 100,
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
