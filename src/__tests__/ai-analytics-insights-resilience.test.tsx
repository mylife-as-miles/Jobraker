import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AIAnalyticsIntelligenceCard } from '../components/analytics/AIAnalyticsIntelligenceCard';
import { invokeProtectedFunction } from '../services/supabase/invokeProtectedFunction';
import React from 'react';

vi.mock('../services/supabase/invokeProtectedFunction', () => ({
  invokeProtectedFunction: vi.fn(),
}));

describe('AIAnalyticsIntelligenceCard Resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heuristic fallback gracefully when AI is unavailable', async () => {
    vi.mocked(invokeProtectedFunction).mockResolvedValueOnce({
      success: true,
      insights: { executiveSummary: 'Fallback summary' },
      isFallback: true,
      fallbackReason: 'Live AI engine temporarily resting',
    });

    render(<AIAnalyticsIntelligenceCard />);

    await waitFor(() => {
      expect(screen.getByText(/Live AI engine temporarily resting/i)).toBeInTheDocument();
      expect(screen.getByText('Rule-Based Diagnostics')).toBeInTheDocument();
      expect(screen.getByText('Fallback summary')).toBeInTheDocument();
    });
  });

  it('sanitizes raw 429 quota errors on the client to prevent stack trace leaks', async () => {
    vi.mocked(invokeProtectedFunction).mockRejectedValueOnce(
      new Error('[429 Too Many Requests] Resource has been exhausted (e.g. check quota)')
    );

    render(<AIAnalyticsIntelligenceCard />);

    await waitFor(() => {
      expect(screen.getByText(/Our AI diagnostics are currently experiencing high demand/i)).toBeInTheDocument();
      expect(screen.queryByText(/429/)).not.toBeInTheDocument();
      expect(screen.queryByText(/exhausted/)).not.toBeInTheDocument();
    });
  });

  it('sanitizes GoogleGenerativeAI errors to prevent leaks', async () => {
    vi.mocked(invokeProtectedFunction).mockRejectedValueOnce(
      new Error('GoogleGenerativeAI Error: Failed to fetch')
    );

    render(<AIAnalyticsIntelligenceCard />);

    await waitFor(() => {
      expect(screen.getByText(/Our AI diagnostics are currently experiencing high demand/i)).toBeInTheDocument();
      expect(screen.queryByText(/GoogleGenerativeAI/)).not.toBeInTheDocument();
    });
  });
});
