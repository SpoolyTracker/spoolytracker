import { create } from 'zustand';
import { api } from '../api';

export interface JobState {
    id: string;
    name: string;
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
    progress: number;
    filename: string;
    result?: any;
    error?: string;
}

interface JobStore {
    jobs: Record<string, JobState>;
    addJob: (id: string, name: string, filename: string) => void;
    updateJob: (id: string, data: Partial<JobState>) => void;
    removeJob: (id: string) => void;
    removeJobsByName: (name: string) => void;
    clearCompleted: () => void;
    pollJobs: () => Promise<void>;
}

export const useJobStore = create<JobStore>((set, get) => {
    let pollingInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
        if (!pollingInterval) {
            pollingInterval = setInterval(() => {
                get().pollJobs();
            }, 2000);
        }
    };

    const stopPolling = () => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    };

    return {
        jobs: {},
        addJob: (id, name, filename) => {
            set((state) => ({
                jobs: {
                    ...state.jobs,
                    [id]: { id, name, status: 'waiting', progress: 0, filename }
                }
            }));
            startPolling();
        },
        updateJob: (id, data) => set((state) => {
            if (!state.jobs[id]) return state;
            return {
                jobs: {
                    ...state.jobs,
                    [id]: { ...state.jobs[id], ...data }
                }
            };
        }),
        removeJob: (id) => set((state) => {
            const newJobs = { ...state.jobs };
            delete newJobs[id];
            
            const hasActiveJobs = Object.values(newJobs).some(j => j.status === 'waiting' || j.status === 'active');
            if (!hasActiveJobs) stopPolling();

            return { jobs: newJobs };
        }),
        clearCompleted: () => set((state) => {
            const newJobs = { ...state.jobs };
            for (const key in newJobs) {
                if (newJobs[key].status === 'completed' || newJobs[key].status === 'failed') {
                    delete newJobs[key];
                }
            }
            return { jobs: newJobs };
        }),
    removeJobsByName: (name: string) => set((state) => {
      const newJobs = { ...state.jobs };
      let changed = false;
      for (const id in newJobs) {
        if (newJobs[id].name === name) {
          delete newJobs[id];
          changed = true;
        }
      }
      if (!changed) return state;
      
      const hasActiveJobs = Object.values(newJobs).some(j => j.status === 'waiting' || j.status === 'active');
      if (!hasActiveJobs) stopPolling();

      return { jobs: newJobs };
    }),
    pollJobs: async () => {
      const { jobs, updateJob } = get();
      const activeJobs = Object.values(jobs)
        .filter(j => j.status === 'waiting' || j.status === 'active');

      if (activeJobs.length === 0) {
        stopPolling();
        return;
      }

      try {
        for (const job of activeJobs) {
          try {
            const details = await api.getJobStatus(job.id);
            updateJob(job.id, {
              status: details.status as any,
              progress: details.progress,
              result: details.result,
              error: details.error,
            });
          } catch (err: any) {
            console.error(`Failed to poll job ${job.id}:`, err);
            // If job not found (400/404), mark as failed so UI can stop spinner
            if (err.message?.includes('not found') || err.message?.includes('404') || err.status === 400 || err.status === 404) {
              updateJob(job.id, {
                status: 'failed',
                error: 'Job not found on server'
              });
            }
          }
        }
      } catch (err) {
        console.error("Critical error in pollJobs:", err);
      }
    }
    };
});
