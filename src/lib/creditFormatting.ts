export type CreditDisplayEntry = {
  label: string;
  direction: "credit" | "debit" | "hold";
  amount: number;
  formattedAmount: string;
  semanticColor: "positive" | "negative" | "neutral";
  description: string;
};

export function formatCreditEntry(transaction: {
  type?: string;
  transaction_type?: string;
  amount: number;
  description?: string;
}): CreditDisplayEntry {
  const rawType = (transaction.type || transaction.transaction_type || "").toLowerCase().trim();
  const rawAmount = Number(transaction.amount);
  const absAmount = Math.abs(rawAmount);

  // V2 entry types or V1 transaction types mapping:
  // Debit types: hold, capture, charge, consumed, spent, deduction, reservation, reserved
  // Credit types: grant, bonus, purchase, refund, reversal, earned, refunded, refill

  const isDebit = [
    "hold",
    "capture",
    "charge",
    "consumed",
    "spent",
    "deduction",
    "reservation",
    "reserved"
  ].includes(rawType);

  const isHold = ["hold", "reservation", "reserved"].includes(rawType);

  let direction: "credit" | "debit" | "hold" = "credit";
  let label = "Credit";
  let semanticColor: "positive" | "negative" | "neutral" = "positive";
  let formattedAmount = `+${absAmount}`;

  if (isHold) {
    direction = "hold";
    label = "Credits Reserved";
    semanticColor = "neutral";
    formattedAmount = `Reserved ${absAmount}`;
  } else if (isDebit || rawAmount < 0) {
    direction = "debit";
    label = "Credits Spent";
    semanticColor = "negative";
    formattedAmount = `-${absAmount}`;
  } else {
    direction = "credit";
    label = "Credits Added";
    semanticColor = "positive";
    formattedAmount = `+${absAmount}`;
  }

  // Refined label based on specific transaction types (V2 & V1)
  switch (rawType) {
    case "hold":
    case "reservation":
    case "reserved":
      label = "Credits Reserved";
      break;
    case "capture":
    case "charge":
    case "consumed":
    case "spent":
    case "deduction":
      label = "Credits Deducted";
      break;
    case "grant":
    case "earned":
      label = "Monthly Credits";
      break;
    case "bonus":
      label = "Bonus Credits";
      break;
    case "refund":
    case "refunded":
      label = "Refund";
      break;
    case "purchase":
      label = "Credits Purchased";
      break;
    case "refill":
      label = "Balance Refill";
      break;
    case "adjustment":
      label = "Credit Adjustment";
      // Determine direction for adjustment based on amount
      if (rawAmount < 0) {
        formattedAmount = `-${absAmount}`;
        semanticColor = "negative";
        direction = "debit";
      } else {
        formattedAmount = `+${absAmount}`;
        semanticColor = "positive";
        direction = "credit";
      }
      break;
    default:
      if (rawAmount < 0) {
        label = "Credits Deducted";
      } else {
        label = "Credits Added";
      }
  }

  return {
    label,
    direction,
    amount: absAmount,
    formattedAmount,
    semanticColor,
    description: transaction.description || label
  };
}
