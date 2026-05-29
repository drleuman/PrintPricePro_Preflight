import { useState, useEffect } from 'react';

export interface FileHistoryArtifacts {
  analysisReport: boolean;
  fixAudit: boolean;
  reviewPdf: boolean;
  fixedPdf: boolean;
  certifiedPdf: boolean;
}

export interface RelatedFixJob {
  jobId: string;
  sourceJobId: string;
  type: string;
  filename: string;
  status: string;
  requestedFixesCount: number;
  appliedFixesCount: number;
  skippedFixesCount: number;
  failedFixesCount: number;
  requiresHumanReview: boolean;
  productionCertified: boolean;
  reviewReasons: any[];
  fixSummary: any[];
  clientChangeSummary?: any;
  artifacts: FileHistoryArtifacts;
  createdAt: string;
  updatedAt: string;
}

export interface SourceAnalyzeJob {
  jobId: string;
  filename: string;
  status: string;
  issuesCount: number;
  findingsCount: number;
}

export interface FileHistoryItem {
  groupKey: string;
  jobId: string;
  type: 'ANALYZE' | 'AUTOFIX';
  filename: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  fileSizeBytes: number;
  fileSizeMb: number;
  
  // ANALYZE specific
  policyProfile?: string;
  issuesCount?: number;
  findingsCount?: number;
  relatedFixJobs?: RelatedFixJob[];
  
  // AUTOFIX specific
  sourceJobId?: string;
  appliedFixesCount?: number;
  skippedFixesCount?: number;
  failedFixesCount?: number;
  requiresHumanReview?: boolean;
  productionCertified?: boolean;
  sourceAnalyzeJob?: SourceAnalyzeJob | null;

  artifacts: FileHistoryArtifacts;
}

export interface FileHistoryResponse {
  ok: boolean;
  scope: 'tenant' | 'user';
  limit: number;
  items: FileHistoryItem[];
}

export function useUserFileHistory(limit: number = 20) {
  const [history, setHistory] = useState<FileHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('ppos_auth_token');

      console.info('[ACCOUNT-PANEL][FILE-HISTORY-FETCH]', {
        hasToken: Boolean(token),
        limit
      });
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/v2/me/file-history?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });

      console.info('[ACCOUNT-PANEL][FILE-HISTORY-RESPONSE]', {
        status: response.status,
        ok: response.ok
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || data?.message || `File history fetch failed with status ${response.status}`);
      }

      if (!data?.ok) {
        throw new Error(data?.error || data?.message || 'File history response not ok');
      }

      setHistory(data);
    } catch (err: any) {
      console.warn('[ACCOUNT-PANEL][FILE-HISTORY-ERROR]', {
        message: err?.message || String(err)
      });
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [limit]);

  return { history, isLoading, error, refresh: fetchHistory };
}
