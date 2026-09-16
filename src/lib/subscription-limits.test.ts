import { describe, expect, it } from "vitest";

import {
  SCAN_START_GATE_RPC,
  resolveScanStartGate,
} from "@/lib/subscription-limits";

describe("scan start gate", () => {
  it("uses can_org_start_scan RPC name (not get_org_usage_summary) for submit preflight", () => {
    expect(SCAN_START_GATE_RPC).toBe("can_org_start_scan");
  });

  it("allows platform bypass without calling usage summary RPC", () => {
    expect(
      resolveScanStartGate({
        platformBypass: true,
        rpcAllowed: false,
        rpcError: "column sp.master_setup_limit does not exist",
      }),
    ).toBe("allow");
  });

  it("denies when can_org_start_scan returns false", () => {
    expect(
      resolveScanStartGate({
        platformBypass: false,
        rpcAllowed: false,
        rpcError: null,
      }),
    ).toBe("deny");
  });

  it("surfaces RPC errors separately from scan quota denial", () => {
    expect(
      resolveScanStartGate({
        platformBypass: false,
        rpcAllowed: null,
        rpcError: "column sp.master_setup_limit does not exist",
      }),
    ).toBe("rpc_error");
  });

  it("allows when can_org_start_scan returns true even if usage summary RPC is broken", () => {
    expect(
      resolveScanStartGate({
        platformBypass: false,
        rpcAllowed: true,
        rpcError: null,
      }),
    ).toBe("allow");
  });
});
