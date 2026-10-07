import { useQuery } from "@tanstack/react-query";
import {
  canInviteMember,
  fetchUsageSummary,
  remainingSeats,
  seatUsageLabel,
  type UsageSummary,
} from "@/lib/subscription-limits";

/**
 * Plan seat allowance for the active workspace. Used to disable or hide invite
 * UI before the request is made — the DB trigger remains the backstop.
 */
export function useSeatUsage() {
  const query = useQuery({
    queryKey: ["billing", "usage-summary"],
    queryFn: ({ signal }) => fetchUsageSummary(signal),
    retry: false,
    staleTime: 30_000,
  });

  const usage: UsageSummary | undefined = query.data;
  const seatsIncluded = usage?.seats_included ?? null;
  const singleSeat = Boolean(usage) && seatsIncluded === 1 && !usage?.platform_bypass;

  return {
    usage,
    isLoading: query.isPending,
    canInvite: usage ? canInviteMember(usage) : true,
    singleSeat,
    remaining: usage ? remainingSeats(usage) : null,
    label: usage ? seatUsageLabel(usage) : "",
    seatLimitLabel: usage?.seat_limit_label ?? "",
    upgradeMessage: seatUpgradeMessage(usage),
  };
}

function seatUpgradeMessage(usage: UsageSummary | undefined): string {
  if (!usage || usage.seats_included === null || usage.seats_included <= 1) {
    return "Upgrade to the Growth plan or higher to invite team members.";
  }
  return `All ${usage.seats_included} users on your ${usage.plan_name} plan are in use. Upgrade to invite more people.`;
}
