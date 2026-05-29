import { useState, useEffect } from 'react';

export interface FileHistoryArtifacts {
  analysisReport: boolean;
  reviewPdf: boolean;
  fixedPdf: boolean;
  certifiedPdf: boolean;
}

export interface RelatedFixJob {
  jobId: string;
  status: string;
  appliedFixesCount: number;
  skippedFixesCount: number;
  failedFixesCount: number;
  requiresHumanReview: boolean;
  productionCertified: boolean;
  createdAt: string;
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
      
      const token = localStorage.getItem('printprice_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`/api/v2/me/file-history?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`File history fetch failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.ok) {
        setHistory(data);
      } else {
        throw new Error('File history response not ok');
      }
    } catch (err: any) {
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
