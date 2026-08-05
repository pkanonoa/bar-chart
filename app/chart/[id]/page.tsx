'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/AuthProvider';
import { useChartSync } from '@/hooks/useChartSync';
import { useParams, useRouter } from 'next/navigation';
import { ChartData } from '@/lib/chart-types';

const PiascoreReader = dynamic(
  () => import('@/components/PiascoreReader').then((mod) => mod.PiascoreReader),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading score...</span>
        </div>
      </div>
    ),
  }
);

export default function ChartViewer() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chartId = params.id as string;

  const { chart, loading: chartLoading } = useChartSync(chartId);

  if (authLoading || chartLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121214] text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-[#007aff] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading score...</span>
        </div>
      </div>
    );
  }

  if (!user || !chart) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#121214] text-white gap-4">
        <p className="text-slate-400 text-sm">Chart not found or access denied.</p>
        <button
          onClick={() => router.push('/')}
          className="px-5 py-2.5 bg-[#007aff] font-bold rounded-xl text-white hover:bg-[#0066cc] transition-all"
        >
          Go to Catalog
        </button>
      </div>
    );
  }

  return (
    <PiascoreReader
      initialChart={chart as ChartData}
      folderId={chart.folder_id}
    />
  );
}
