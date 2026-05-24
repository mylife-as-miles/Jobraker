type OrderRow = {
  id: string;
  user_id: string;
  plan_type: "credit_pack" | "subscription" | "concurrency_pack";
  total_amount: number;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  is_success: boolean;
};

type FulfillmentResult = {
  ok: boolean;
  status:
    | "fulfilled"
    | "already_fulfilled"
    | "order_not_found"
    | "user_mismatch"
    | "amount_mismatch"
    | "order_update_failed"
    | "credit_failed"
    | "subscription_failed"
    | "quota_failed"
    | "invalid_order";
  message?: string;
  orderId?: string;
  newBalance?: number;
};

type VerifiedPaystackTransaction = {
  ok: boolean;
  reference: string;
  amount: number;
  currency: string;
  status?: string;
  message?: string;
};

function addBillingCycle(baseDate: Date, billingCycle: string) {
  const next = new Date(baseDate.getTime());
  switch (billingCycle) {
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "monthly":
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

async function hasCreditTransaction(
  supabaseAdmin: any,
  userId: string,
  referenceType: string,
  orderId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("reference_type", referenceType)
    .eq("reference_id", orderId)
    .limit(1);

  if (error) {
    console.error("Failed to check credit transaction idempotency:", error);
    return false;
  }

  return Boolean(data?.length);
}

function creditReferenceTypeForOrder(order: OrderRow) {
  return order.plan_type === "subscription" ? "subscription" : "order";
}

async function hasConcurrencyProvision(
  supabaseAdmin: any,
  userId: string,
  orderId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("user_feature_quotas")
    .select("id")
    .eq("user_id", userId)
    .eq("feature_key", "auto_apply_concurrency")
    .eq("source", "addon")
    .contains("metadata", { order_ids: [orderId] })
    .limit(1);

  if (error) {
    console.error("Failed to check concurrency entitlement idempotency:", error);
    return false;
  }

  return Boolean(data?.length);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorText(error: any) {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function looksLikeSchemaMismatch(error: any, fieldName: string) {
  const text = getErrorText(error);
  return (
    text.includes(fieldName.toLowerCase()) ||
    text.includes("schema cache") ||
    text.includes("column")
  );
}

function looksLikeStatusValueMismatch(error: any, statusValue: string) {
  const text = getErrorText(error);
  return (
    text.includes(statusValue.toLowerCase()) ||
    text.includes("check constraint") ||
    text.includes("invalid input value")
  );
}

async function cancelActiveSubscriptions(
  supabaseAdmin: any,
  userId: string,
  currentPeriodStart: string,
) {
  const baseUpdate = {
    current_period_end: currentPeriodStart,
    updated_at: currentPeriodStart,
  };
  const statusAttempts = ["canceled", "cancelled"];
  let lastError: any = null;

  for (let index = 0; index < statusAttempts.length; index += 1) {
    const status = statusAttempts[index];
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .update({
        ...baseUpdate,
        status,
      })
      .eq("user_id", userId)
      .eq("status", "active");

    if (!error) {
      return;
    }

    lastError = error;
    const isFinalAttempt = index === statusAttempts.length - 1;
    if (isFinalAttempt || !looksLikeStatusValueMismatch(error, status)) {
      break;
    }
  }

  if (lastError) {
    console.error("Failed to cancel previous subscriptions:", lastError);
  }
}

async function createUserSubscription(
  supabaseAdmin: any,
  userId: string,
  planId: string,
  currentPeriodStart: string,
  currentPeriodEnd: string,
) {
  const baseInsert = {
    user_id: userId,
    status: "active",
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    updated_at: currentPeriodStart,
  };
  const attempts = [
    {
      ...baseInsert,
      subscription_plan_id: planId,
    },
    {
      ...baseInsert,
      plan_id: planId,
    },
  ];
  let lastError: any = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const payload = attempts[index];
    const attemptedPlanField =
      "subscription_plan_id" in payload ? "subscription_plan_id" : "plan_id";
    const { error } = await supabaseAdmin
      .from("user_subscriptions")
      .insert(payload);

    if (!error) {
      return null;
    }

    lastError = error;
    const isFinalAttempt = index === attempts.length - 1;
    if (isFinalAttempt || !looksLikeSchemaMismatch(error, attemptedPlanField)) {
      break;
    }
  }

  return lastError;
}

export async function verifyPaystackReference(
  reference: string,
  paystackSecret: string,
): Promise<VerifiedPaystackTransaction> {
  const verifyRes = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    },
  );
  const verifyData = await verifyRes.json();

  if (!verifyData?.status || verifyData?.data?.status !== "success") {
    return {
      ok: false,
      reference,
      amount: Number(verifyData?.data?.amount || 0),
      currency: String(verifyData?.data?.currency || "NGN").toUpperCase(),
      status: verifyData?.data?.status,
      message: verifyData?.message || "Payment has not been completed",
    };
  }

  return {
    ok: true,
    reference,
    amount: Number(verifyData.data.amount || 0),
    currency: String(verifyData.data.currency || "NGN").toUpperCase(),
    status: verifyData.data.status,
  };
}

export async function fulfillVerifiedPaystackPayment({
  supabaseAdmin,
  reference,
  verifiedAmount,
  verifiedCurrency,
  expectedUserId,
}: {
  supabaseAdmin: any;
  reference: string;
  verifiedAmount: number;
  verifiedCurrency: string;
  expectedUserId?: string;
}): Promise<FulfillmentResult> {
  const { data: existingOrder, error: existingOrderError } = await supabaseAdmin
    .from("orders")
    .select("id, user_id, plan_type, total_amount, currency, metadata, is_success")
    .eq("tx_id", reference)
    .maybeSingle<OrderRow>();

  if (existingOrderError) {
    console.error("Failed to read order:", existingOrderError);
    return {
      ok: false,
      status: "invalid_order",
      message: "Could not read payment order",
    };
  }

  if (!existingOrder) {
    console.warn(`Order ${reference} not found.`);
    return { ok: true, status: "order_not_found" };
  }

  if (expectedUserId && existingOrder.user_id !== expectedUserId) {
    console.error("Payment verification user mismatch", {
      reference,
      expectedUserId,
      orderUserId: existingOrder.user_id,
    });
    return {
      ok: false,
      status: "user_mismatch",
      orderId: existingOrder.id,
      message: "Payment reference does not belong to this account",
    };
  }

  const expectedCurrency = String(existingOrder.currency || "NGN").toUpperCase();
  const normalizedVerifiedCurrency = String(verifiedCurrency || "NGN").toUpperCase();
  if (
    Number(verifiedAmount) !== Number(existingOrder.total_amount) ||
    normalizedVerifiedCurrency !== expectedCurrency
  ) {
    console.error("Payment verification mismatch", {
      reference,
      expectedAmount: existingOrder.total_amount,
      verifiedAmount,
      expectedCurrency,
      verifiedCurrency: normalizedVerifiedCurrency,
    });
    return {
      ok: false,
      status: "amount_mismatch",
      orderId: existingOrder.id,
      message: "Verified payment does not match the order amount",
    };
  }

  let order = existingOrder;
  if (!existingOrder.is_success) {
    const { data: updatedOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .update({
        is_success: true,
        updated_at: new Date().toISOString(),
      })
      .eq("tx_id", reference)
      .eq("is_success", false)
      .select("id, user_id, plan_type, total_amount, currency, metadata, is_success")
      .maybeSingle<OrderRow>();

    if (orderError) {
      console.error("Order update failed:", orderError);
      return {
        ok: false,
        status: "order_update_failed",
        orderId: existingOrder.id,
        message: "Could not mark payment order as successful",
      };
    }

    if (!updatedOrder) {
      await sleep(1500);
      if (
        await hasCreditTransaction(
          supabaseAdmin,
          existingOrder.user_id,
          creditReferenceTypeForOrder(existingOrder),
          existingOrder.id,
        )
      ) {
        return {
          ok: true,
          status: "already_fulfilled",
          orderId: existingOrder.id,
        };
      }

      return {
        ok: false,
        status: "order_update_failed",
        orderId: existingOrder.id,
        message: "Payment order is already being processed",
      };
    }

    order = updatedOrder;
  } else if (
    await hasCreditTransaction(
      supabaseAdmin,
      existingOrder.user_id,
      creditReferenceTypeForOrder(existingOrder),
      existingOrder.id,
    )
  ) {
    return { ok: true, status: "already_fulfilled", orderId: existingOrder.id };
  } else {
    await sleep(1500);
    if (
      await hasCreditTransaction(
        supabaseAdmin,
        existingOrder.user_id,
        creditReferenceTypeForOrder(existingOrder),
        existingOrder.id,
      )
    ) {
      return {
        ok: true,
        status: "already_fulfilled",
        orderId: existingOrder.id,
      };
    }
  }

  const metadata = order.metadata || {};
  const userId = order.user_id;

  if (order.plan_type === "credit_pack") {
    if (await hasCreditTransaction(supabaseAdmin, userId, "order", order.id)) {
      return { ok: true, status: "already_fulfilled", orderId: order.id };
    }

    const creditsToAdd = Number(metadata.credits || 0);
    const bonusCredits = Number(metadata.bonus_credits || 0);
    const totalCredits = creditsToAdd + bonusCredits;

    if (totalCredits <= 0) {
      return {
        ok: false,
        status: "invalid_order",
        orderId: order.id,
        message: "Credit pack order has no credits to add",
      };
    }

    const { data: rpcResult, error: creditError } = await supabaseAdmin.rpc(
      "add_credits",
      {
        p_user_id: userId,
        p_amount: totalCredits,
        p_description: `Purchased ${String(metadata.pack_name || "credit pack")} (${creditsToAdd} + ${bonusCredits} bonus)`,
        p_reference_type: "order",
        p_reference_id: order.id,
        p_metadata: {
          order_id: order.id,
          paystack_ref: reference,
          sku: metadata.sku,
        },
      },
    );

    if (creditError || !rpcResult?.success) {
      console.error(
        "Failed to add user credits via RPC:",
        creditError || rpcResult?.message,
      );
      return {
        ok: false,
        status: "credit_failed",
        orderId: order.id,
        message: creditError?.message || rpcResult?.message || "Could not add credits",
      };
    }

    return {
      ok: true,
      status: "fulfilled",
      orderId: order.id,
      newBalance: Number(rpcResult?.new_balance),
    };
  }

  if (order.plan_type === "concurrency_pack") {
    if (await hasConcurrencyProvision(supabaseAdmin, userId, order.id)) {
      return { ok: true, status: "already_fulfilled", orderId: order.id };
    }

    const parallelSlots = Number(metadata.parallel_slots || 0);
    const periodStart =
      typeof metadata.period_start === "string"
        ? metadata.period_start
        : new Date().toISOString();
    const periodEnd =
      typeof metadata.period_end === "string"
        ? metadata.period_end
        : addBillingCycle(new Date(), "monthly").toISOString();

    if (parallelSlots <= 0) {
      return {
        ok: false,
        status: "invalid_order",
        orderId: order.id,
        message: "Concurrency pack order has no parallel slots to add",
      };
    }

    const { data: existingQuota, error: quotaLookupError } = await supabaseAdmin
      .from("user_feature_quotas")
      .select("id, included_quantity, metadata")
      .eq("user_id", userId)
      .eq("feature_key", "auto_apply_concurrency")
      .eq("source", "addon")
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (quotaLookupError) {
      console.error("Failed to look up concurrency entitlement:", quotaLookupError);
      return {
        ok: false,
        status: "quota_failed",
        orderId: order.id,
        message: "Could not look up concurrency entitlement",
      };
    }

    const existingMetadata =
      existingQuota?.metadata && typeof existingQuota.metadata === "object"
        ? (existingQuota.metadata as Record<string, unknown>)
        : {};
    const existingOrderIds = Array.isArray(existingMetadata.order_ids)
      ? existingMetadata.order_ids
          .map((value) => String(value))
          .filter(Boolean)
      : [];

    if (existingOrderIds.includes(order.id)) {
      return { ok: true, status: "already_fulfilled", orderId: order.id };
    }

    const nextOrderIds = [...existingOrderIds, order.id];
    const quotaPayload = {
      user_id: userId,
      feature_key: "auto_apply_concurrency",
      source: "addon",
      period_start: periodStart,
      period_end: periodEnd,
      included_quantity:
        Math.max(0, Math.floor(Number(existingQuota?.included_quantity || 0))) +
        parallelSlots,
      used_quantity: 0,
      updated_at: new Date().toISOString(),
      metadata: {
        ...existingMetadata,
        order_ids: nextOrderIds,
        last_order_id: order.id,
        pack_name: metadata.pack_name,
        sku: metadata.sku,
      },
    };

    const quotaMutation = existingQuota?.id
      ? await supabaseAdmin
          .from("user_feature_quotas")
          .update(quotaPayload)
          .eq("id", existingQuota.id)
      : await supabaseAdmin.from("user_feature_quotas").insert(quotaPayload);

    if (quotaMutation.error) {
      console.error("Failed to provision concurrency entitlement:", quotaMutation.error);
      return {
        ok: false,
        status: "quota_failed",
        orderId: order.id,
        message: "Could not provision concurrency entitlement",
      };
    }

    return {
      ok: true,
      status: "fulfilled",
      orderId: order.id,
    };
  }

  if (order.plan_type === "subscription") {
    const planId =
      typeof metadata.subscription_plan_id === "string"
        ? metadata.subscription_plan_id
        : typeof metadata.plan_id === "string"
          ? metadata.plan_id
          : null;
    if (!planId) {
      return {
        ok: false,
        status: "invalid_order",
        orderId: order.id,
        message: "Subscription order is missing a plan",
      };
    }

    const monthlyCredits = Number(metadata.credits_per_month || 0);
    const alreadyCredited =
      monthlyCredits > 0 &&
      (await hasCreditTransaction(supabaseAdmin, userId, "subscription", order.id));
    if (alreadyCredited) {
      return { ok: true, status: "already_fulfilled", orderId: order.id };
    }

    const planName = String(metadata.plan_name || "Paid");
    const billingCycle = String(metadata.billing_cycle || "monthly");
    const autoApplyLimit = Number(metadata.auto_apply_monthly_limit || 0);
    const now = new Date();
    const currentPeriodStart = now.toISOString();
    const currentPeriodEnd = addBillingCycle(now, billingCycle).toISOString();

    await cancelActiveSubscriptions(supabaseAdmin, userId, currentPeriodStart);

    const subError = await createUserSubscription(
      supabaseAdmin,
      userId,
      planId,
      currentPeriodStart,
      currentPeriodEnd,
    );

    if (subError) {
      console.error("Failed to create subscription:", subError);
      return {
        ok: false,
        status: "subscription_failed",
        orderId: order.id,
        message: "Could not activate subscription",
      };
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        subscription_tier: planName,
        updated_at: currentPeriodStart,
      })
      .eq("id", userId);

    if (monthlyCredits > 0) {
      const { data: rpcResult, error: creditError } = await supabaseAdmin.rpc(
        "add_credits",
        {
          p_user_id: userId,
          p_amount: monthlyCredits,
          p_description: `${planName} monthly search and AI credits`,
          p_reference_type: "subscription",
          p_reference_id: order.id,
          p_metadata: {
            order_id: order.id,
            paystack_ref: reference,
            plan_id: planId,
            subscription_plan_id: planId,
            plan_name: planName,
          },
        },
      );

      if (creditError || !rpcResult?.success) {
        console.error(
          "Failed to add monthly subscription credits via RPC:",
          creditError || rpcResult?.message,
        );
        return {
          ok: false,
          status: "credit_failed",
          orderId: order.id,
          message:
            creditError?.message || rpcResult?.message || "Could not add subscription credits",
        };
      }
    }

    if (autoApplyLimit > 0) {
      const { error: quotaError } = await supabaseAdmin
        .from("user_feature_quotas")
        .upsert(
          {
            user_id: userId,
            feature_key: "auto_apply",
            source: "subscription",
            period_start: currentPeriodStart,
            period_end: currentPeriodEnd,
            included_quantity: autoApplyLimit,
            used_quantity: 0,
            updated_at: currentPeriodStart,
            metadata: {
              plan_id: planId,
              subscription_plan_id: planId,
              plan_name: planName,
              order_id: order.id,
            },
          },
          {
            onConflict: "user_id,feature_key,source,period_start,period_end",
          },
        );

      if (quotaError) {
        console.error("Failed to provision auto apply quota:", quotaError);
        return {
          ok: false,
          status: "quota_failed",
          orderId: order.id,
          message: "Could not provision subscription quota",
        };
      }
    }

    return { ok: true, status: "fulfilled", orderId: order.id };
  }

  return {
    ok: false,
    status: "invalid_order",
    orderId: order.id,
    message: "Unsupported order type",
  };
}
