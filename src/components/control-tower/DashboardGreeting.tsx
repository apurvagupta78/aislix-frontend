import { useQuery } from "@tanstack/react-query";

import { fetchProfile } from "@/lib/account";

function greetingName(fullName: string, email: string): string {
  const trimmed = fullName.trim();
  if (trimmed) return trimmed.split(/\s+/)[0] ?? trimmed;
  const local = email.split("@")[0]?.trim();
  return local || "there";
}

export function DashboardGreeting() {
  const profileQuery = useQuery({
    queryKey: ["dashboard-profile-greeting"],
    queryFn: fetchProfile,
    staleTime: 60_000,
  });

  const name = profileQuery.data
    ? greetingName(profileQuery.data.full_name, profileQuery.data.email)
    : "there";

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-navy md:text-3xl">Hi {name}</h1>
      <p className="mt-1 text-sm text-mp-muted">Your retail audit and intelligence command center.</p>
    </div>
  );
}
