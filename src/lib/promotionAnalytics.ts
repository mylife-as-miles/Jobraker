// src/lib/promotionAnalytics.ts
// Reusable pure analytics calculators and reporting queries for Jobraker Personalized Promotion Engine.
// Evaluates variant performance, discount lift, incremental revenue lift, and retention cohorts.
//
// SECURITY & AUTHORITY MODEL:
// 1. Cross-user metrics (control vs treatment conversion, global ARPU, revenue lift, discount lift)
//    MUST ONLY be computed in trusted server/admin contexts (e.g. admin Edge Functions or Data Warehouse).
// 2. Normal authenticated client RLS policies strictly restrict users to their own rows (auth.uid() = user_id).
// 3. The functions in this file are pure deterministic transform helpers; they never initiate client queries
//    for unauthorized cross-user datasets.

import type {
  PromotionAssignmentRow,
  PromotionMessageVariant,
} from "./promotions";

export interface VariantConversionMetrics {
  experimentVariant: "control" | "treatment";
  messageVariant: PromotionMessageVariant | "all";
  assignedCount: number;
  impressionCount: number;
  clickCount: number;
  checkoutCount: number;
  conversionCount: number;
  totalRevenue: number;
  ctr: number; // clicks / impressions
  checkoutRate: number; // checkouts / impressions
  conversionRate: number; // conversions / assigned
  arpu: number; // totalRevenue / assigned
}

export interface DiscountLiftMetrics {
  discountPercent: number;
  assignedCount: number;
  convertedCount: number;
  conversionRate: number;
  totalRevenue: number;
  averageRevenuePerConverted: number;
}

export interface ControlVsTreatmentLift {
  controlAssigned: number;
  treatmentAssigned: number;
  controlConversions: number;
  treatmentConversions: number;
  controlConversionRate: number;
  treatmentConversionRate: number;
  absoluteConversionLift: number;
  relativeConversionLiftPct: number;
  controlTotalRevenue: number;
  treatmentTotalRevenue: number;
  controlArpu: number;
  treatmentArpu: number;
  incrementalRevenuePerUser: number;
}

export interface ImpressionDistributionMetrics {
  totalUsers: number;
  totalImpressions: number;
  averageImpressionsPerUser: number;
  dismissCount: number;
  dismissRate: number;
}

export interface RetentionCohortMetrics {
  cohortKey: string;
  totalSubscribers: number;
  retained7dCount: number;
  retained7dRate: number;
  retained30dCount: number;
  retained30dRate: number;
  retained90dCount: number;
  retained90dRate: number;
}

/**
 * Calculates conversion rates, CTR, checkout rates, and ARPU partitioned by experiment variant and message variant.
 */
export function calculateVariantConversionRates(
  assignments: Array<Partial<PromotionAssignmentRow>>,
  events: Array<{ assignment_id?: string | null; event_type: string }>
): VariantConversionMetrics[] {
  const impressionMap = new Map<string, number>();
  const clickMap = new Map<string, number>();
  const checkoutMap = new Map<string, number>();

  for (const ev of events) {
    if (!ev.assignment_id) continue;
    if (ev.event_type === "impression") {
      impressionMap.set(ev.assignment_id, (impressionMap.get(ev.assignment_id) || 0) + 1);
    } else if (ev.event_type === "clicked") {
      clickMap.set(ev.assignment_id, (clickMap.get(ev.assignment_id) || 0) + 1);
    } else if (ev.event_type === "checkout_started") {
      checkoutMap.set(ev.assignment_id, (checkoutMap.get(ev.assignment_id) || 0) + 1);
    }
  }

  const groups = new Map<string, {
    experimentVariant: "control" | "treatment";
    messageVariant: PromotionMessageVariant;
    assignedCount: number;
    impressionCount: number;
    clickCount: number;
    checkoutCount: number;
    conversionCount: number;
    totalRevenue: number;
  }>();

  for (const a of assignments) {
    const expVar = a.experiment_variant === "control" ? "control" : "treatment";
    const msgVar = a.message_variant || "value";
    const key = `${expVar}__${msgVar}`;

    let item = groups.get(key);
    if (!item) {
      item = {
        experimentVariant: expVar,
        messageVariant: msgVar,
        assignedCount: 0,
        impressionCount: 0,
        clickCount: 0,
        checkoutCount: 0,
        conversionCount: 0,
        totalRevenue: 0,
      };
      groups.set(key, item);
    }

    item.assignedCount += 1;
    if (a.id) {
      item.impressionCount += impressionMap.get(a.id) || 0;
      item.clickCount += clickMap.get(a.id) || 0;
      item.checkoutCount += checkoutMap.get(a.id) || 0;
    }

    if (a.status === "converted" || a.converted_at) {
      item.conversionCount += 1;
      item.totalRevenue += Number(a.converted_amount || 0);
    }
  }

  return Array.from(groups.values()).map((g) => ({
    experimentVariant: g.experimentVariant,
    messageVariant: g.messageVariant,
    assignedCount: g.assignedCount,
    impressionCount: g.impressionCount,
    clickCount: g.clickCount,
    checkoutCount: g.checkoutCount,
    conversionCount: g.conversionCount,
    totalRevenue: Math.round(g.totalRevenue * 100) / 100,
    ctr: g.impressionCount > 0 ? Math.round((g.clickCount / g.impressionCount) * 1000) / 10 : 0,
    checkoutRate: g.impressionCount > 0 ? Math.round((g.checkoutCount / g.impressionCount) * 1000) / 10 : 0,
    conversionRate: g.assignedCount > 0 ? Math.round((g.conversionCount / g.assignedCount) * 1000) / 10 : 0,
    arpu: g.assignedCount > 0 ? Math.round((g.totalRevenue / g.assignedCount) * 100) / 100 : 0,
  }));
}

/**
 * Calculates conversion rates and revenue lift partitioned by discount tier (0%, 10%, 15%, 20%, 25%, 30%, 40%).
 */
export function calculateDiscountLiftAnalysis(
  assignments: Array<Partial<PromotionAssignmentRow>>
): DiscountLiftMetrics[] {
  const map = new Map<number, { assigned: number; converted: number; revenue: number }>();

  for (const a of assignments) {
    const discount = Math.max(0, Number(a.discount_percent || 0));
    let entry = map.get(discount);
    if (!entry) {
      entry = { assigned: 0, converted: 0, revenue: 0 };
      map.set(discount, entry);
    }
    entry.assigned += 1;
    if (a.status === "converted" || a.converted_at) {
      entry.converted += 1;
      entry.revenue += Number(a.converted_amount || 0);
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([discountPercent, data]) => ({
      discountPercent,
      assignedCount: data.assigned,
      convertedCount: data.converted,
      conversionRate: data.assigned > 0 ? Math.round((data.converted / data.assigned) * 1000) / 10 : 0,
      totalRevenue: Math.round(data.revenue * 100) / 100,
      averageRevenuePerConverted:
        data.converted > 0 ? Math.round((data.revenue / data.converted) * 100) / 100 : 0,
    }));
}

/**
 * Calculates true incremental conversion and incremental revenue lift between Control (10%) and Treatment (90%).
 */
export function calculateControlVsTreatmentLift(
  assignments: Array<Partial<PromotionAssignmentRow>>
): ControlVsTreatmentLift {
  let controlAssigned = 0;
  let treatmentAssigned = 0;
  let controlConversions = 0;
  let treatmentConversions = 0;
  let controlTotalRevenue = 0;
  let treatmentTotalRevenue = 0;

  for (const a of assignments) {
    const isControl = a.experiment_variant === "control";
    const isConverted = a.status === "converted" || Boolean(a.converted_at);
    const rev = Number(a.converted_amount || 0);

    if (isControl) {
      controlAssigned += 1;
      if (isConverted) {
        controlConversions += 1;
        controlTotalRevenue += rev;
      }
    } else {
      treatmentAssigned += 1;
      if (isConverted) {
        treatmentConversions += 1;
        treatmentTotalRevenue += rev;
      }
    }
  }

  const controlConversionRate =
    controlAssigned > 0 ? controlConversions / controlAssigned : 0;
  const treatmentConversionRate =
    treatmentAssigned > 0 ? treatmentConversions / treatmentAssigned : 0;

  const absoluteConversionLift = treatmentConversionRate - controlConversionRate;
  const relativeConversionLiftPct =
    controlConversionRate > 0 ? (absoluteConversionLift / controlConversionRate) * 100 : 0;

  const controlArpu = controlAssigned > 0 ? controlTotalRevenue / controlAssigned : 0;
  const treatmentArpu = treatmentAssigned > 0 ? treatmentTotalRevenue / treatmentAssigned : 0;
  const incrementalRevenuePerUser = treatmentArpu - controlArpu;

  return {
    controlAssigned,
    treatmentAssigned,
    controlConversions,
    treatmentConversions,
    controlConversionRate: Math.round(controlConversionRate * 1000) / 10,
    treatmentConversionRate: Math.round(treatmentConversionRate * 1000) / 10,
    absoluteConversionLift: Math.round(absoluteConversionLift * 1000) / 10,
    relativeConversionLiftPct: Math.round(relativeConversionLiftPct * 10) / 10,
    controlTotalRevenue: Math.round(controlTotalRevenue * 100) / 100,
    treatmentTotalRevenue: Math.round(treatmentTotalRevenue * 100) / 100,
    controlArpu: Math.round(controlArpu * 100) / 100,
    treatmentArpu: Math.round(treatmentArpu * 100) / 100,
    incrementalRevenuePerUser: Math.round(incrementalRevenuePerUser * 100) / 100,
  };
}

/**
 * Calculates impression frequency distribution and dismissal rates across active users.
 */
export function calculateImpressionDistribution(
  assignments: Array<Partial<PromotionAssignmentRow>>,
  events: Array<{ event_type: string; user_id?: string }>
): ImpressionDistributionMetrics {
  const userImpressions = new Map<string, number>();
  let dismissCount = 0;

  for (const ev of events) {
    if (!ev.user_id) continue;
    if (ev.event_type === "impression") {
      userImpressions.set(ev.user_id, (userImpressions.get(ev.user_id) || 0) + 1);
    } else if (ev.event_type === "dismissed") {
      dismissCount += 1;
    }
  }

  const totalUsers = assignments.length > 0 ? assignments.length : userImpressions.size;
  const totalImpressions = Array.from(userImpressions.values()).reduce((sum, n) => sum + n, 0);
  const averageImpressionsPerUser =
    totalUsers > 0 ? Math.round((totalImpressions / totalUsers) * 10) / 10 : 0;
  const dismissRate =
    totalImpressions > 0 ? Math.round((dismissCount / totalImpressions) * 1000) / 10 : 0;

  return {
    totalUsers,
    totalImpressions,
    averageImpressionsPerUser,
    dismissCount,
    dismissRate,
  };
}

/**
 * Analytical SQL queries for backend data warehouses / Supabase dashboards
 */
export const PROMOTION_ANALYTICS_SQL = {
  VARIANT_PERFORMANCE: `
    SELECT
      experiment_variant,
      message_variant,
      COUNT(*) AS total_assigned,
      COUNT(*) FILTER (WHERE status = 'converted') AS total_converted,
      ROUND(AVG(discount_percent), 1) AS avg_discount_pct,
      COALESCE(SUM(converted_amount), 0) AS total_revenue,
      ROUND(COUNT(*) FILTER (WHERE status = 'converted')::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS conversion_rate_pct,
      ROUND(COALESCE(SUM(converted_amount), 0) / NULLIF(COUNT(*), 0), 2) AS arpu
    FROM public.promotion_assignments
    GROUP BY experiment_variant, message_variant
    ORDER BY experiment_variant, conversion_rate_pct DESC;
  `,

  DISCOUNT_LIFT: `
    SELECT
      discount_percent,
      COUNT(*) AS assigned_users,
      COUNT(*) FILTER (WHERE status = 'converted') AS conversions,
      ROUND(COUNT(*) FILTER (WHERE status = 'converted')::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS conversion_rate_pct,
      COALESCE(SUM(converted_amount), 0) AS total_revenue,
      ROUND(COALESCE(SUM(converted_amount), 0) / NULLIF(COUNT(*) FILTER (WHERE status = 'converted'), 0), 2) AS avg_rev_per_conversion
    FROM public.promotion_assignments
    GROUP BY discount_percent
    ORDER BY discount_percent ASC;
  `,

  CONTROL_VS_TREATMENT_LIFT: `
    WITH stats AS (
      SELECT
        experiment_variant,
        COUNT(*)::numeric AS n,
        COUNT(*) FILTER (WHERE status = 'converted')::numeric AS conversions,
        COALESCE(SUM(converted_amount), 0)::numeric AS revenue
      FROM public.promotion_assignments
      GROUP BY experiment_variant
    )
    SELECT
      control.n AS control_n,
      treatment.n AS treatment_n,
      ROUND(control.conversions / NULLIF(control.n, 0) * 100, 2) AS control_cvr_pct,
      ROUND(treatment.conversions / NULLIF(treatment.n, 0) * 100, 2) AS treatment_cvr_pct,
      ROUND((treatment.conversions / NULLIF(treatment.n, 0) - control.conversions / NULLIF(control.n, 0)) * 100, 2) AS abs_lift_cvr_pct,
      ROUND(control.revenue / NULLIF(control.n, 0), 2) AS control_arpu,
      ROUND(treatment.revenue / NULLIF(treatment.n, 0), 2) AS treatment_arpu,
      ROUND((treatment.revenue / NULLIF(treatment.n, 0) - control.revenue / NULLIF(control.n, 0)), 2) AS incremental_revenue_per_user
    FROM stats control
    CROSS JOIN stats treatment
    WHERE control.experiment_variant = 'control'
      AND treatment.experiment_variant = 'treatment';
  `,
} as const;
