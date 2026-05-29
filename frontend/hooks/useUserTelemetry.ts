import { useState, useEffect } from 'react';

export interface UserTelemetry {
  identity: {
    userId: string;
    email: string;
    role: string;
    appRole: string;
    printhouseId: string;
    organizationName: string | null;
  };
  license: {
    plan: string;
    daily_jobs_limit: number;
    ai_magic_fix_enabled: boolean;
    max_file_size_mb: number;
  };
  apiAccess: {
    enabled: boolean;
    environment: string;
    maskedKey: string | null;
    scopes: string[];
    lastUsedAt: string | null;
    rotationAvailable: boolean;
    rotationStatus: string;
  };
  security: {
    jwtValidated: boolean;
    loginMethod: string;
  };
  usage: {
    jobsToday: number;
    analyzeJobsToday: number;
    autofixJobsToday: number;
  };
}

export function useUserTelemetry() {
  const [telemetry, setTelemetry] = useState<UserTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTelemetry = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('printprice_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch('/api/v2/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Telemetry fetch failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.ok) {
        setTelemetry(data);
      } else {
        throw new Error('Telemetry response not ok');
      }
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, []);

  return { telemetry, isLoading, error, refresh: fetchTelemetry };
}
