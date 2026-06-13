import {type Doc} from '@/convex/_generated/dataModel';

export type PricingRule = Doc<'platformPricingRules'>;

export type TierInput = {
  name: string;
  price: string;
  quantity: string;
  currency: string;
};

export type FeeBreakdownItem = {
  tierName: string;
  tierPrice: number;
  tierQuantity: number;
  matchedRule: PricingRule | null;
  fee: number;
  currency: string;
};

export type FeeResult = {
  breakdown: FeeBreakdownItem[];
  totalFee: number;
  currency: string | null;
};

/**
 * Calculates platform fee for an event's tiers against a list of active rules.
 *
 * Rules are evaluated in displayOrder (ascending). The first rule whose
 * conditions all pass is applied to that tier. Conditions are optional — a
 * rule with no conditions set is a catch-all and matches every tier.
 */
export function calculatePlatformFee(
  tiers: TierInput[],
  rules: PricingRule[],
): FeeResult {
  if (rules.length === 0 || tiers.length === 0) {
    return {breakdown: [], totalFee: 0, currency: null};
  }

  const totalTickets = tiers.reduce((sum, t) => {
    const qty = parseInt(t.quantity, 10);
    return sum + (isNaN(qty) ? 0 : qty);
  }, 0);

  // Rules are already sorted by displayOrder from listActive
  const breakdown: FeeBreakdownItem[] = tiers.map(tier => {
    const price = parseFloat(tier.price);
    const qty = parseInt(tier.quantity, 10);

    if (isNaN(price) || isNaN(qty) || qty <= 0) {
      return {
        tierName: tier.name,
        tierPrice: 0,
        tierQuantity: 0,
        matchedRule: null,
        fee: 0,
        currency: '',
      };
    }

    const matchedRule =
      rules.find(rule => {
        const priceOk =
          (rule.ticketPriceMin === undefined || price >= rule.ticketPriceMin) &&
          (rule.ticketPriceMax === undefined || price <= rule.ticketPriceMax);
        const countOk =
          (rule.totalTicketsMin === undefined ||
            totalTickets >= rule.totalTicketsMin) &&
          (rule.totalTicketsMax === undefined ||
            totalTickets <= rule.totalTicketsMax);
        return priceOk && countOk;
      }) ?? null;

    let fee = 0;
    if (matchedRule) {
      fee =
        matchedRule.feeType === 'percentage'
          ? price * (matchedRule.feeValue / 100) * qty
          : matchedRule.feeValue * qty;
    }

    return {
      tierName: tier.name,
      tierPrice: price,
      tierQuantity: qty,
      matchedRule,
      fee,
      currency: matchedRule?.currency ?? '',
    };
  });

  const totalFee = breakdown.reduce((sum, item) => sum + item.fee, 0);

  // Use the currency of the first tier that matched a rule
  const currency =
    breakdown.find(item => item.matchedRule !== null)?.currency ?? null;

  return {breakdown, totalFee, currency};
}

/** Human-readable description of a rule's conditions. */
export function describeConditions(rule: PricingRule): string {
  const parts: string[] = [];

  const hasPrice =
    rule.ticketPriceMin !== undefined || rule.ticketPriceMax !== undefined;
  const hasCount =
    rule.totalTicketsMin !== undefined || rule.totalTicketsMax !== undefined;

  if (hasPrice) {
    if (rule.ticketPriceMin !== undefined && rule.ticketPriceMax !== undefined) {
      parts.push(
        `Ticket price ${rule.currency}${rule.ticketPriceMin}–${rule.currency}${rule.ticketPriceMax}`,
      );
    } else if (rule.ticketPriceMin !== undefined) {
      parts.push(`Ticket price ≥ ${rule.currency}${rule.ticketPriceMin}`);
    } else if (rule.ticketPriceMax !== undefined) {
      parts.push(`Ticket price ≤ ${rule.currency}${rule.ticketPriceMax}`);
    }
  }

  if (hasCount) {
    if (
      rule.totalTicketsMin !== undefined &&
      rule.totalTicketsMax !== undefined
    ) {
      parts.push(
        `Total tickets ${rule.totalTicketsMin}–${rule.totalTicketsMax}`,
      );
    } else if (rule.totalTicketsMin !== undefined) {
      parts.push(`Total tickets ≥ ${rule.totalTicketsMin}`);
    } else if (rule.totalTicketsMax !== undefined) {
      parts.push(`Total tickets ≤ ${rule.totalTicketsMax}`);
    }
  }

  return parts.length > 0 ? parts.join(' · ') : 'All tickets (catch-all)';
}

/** Human-readable fee description. */
export function describeFee(rule: PricingRule): string {
  return rule.feeType === 'percentage'
    ? `${rule.feeValue}% of ticket price`
    : `${rule.currency}${rule.feeValue.toFixed(2)} flat per ticket`;
}
