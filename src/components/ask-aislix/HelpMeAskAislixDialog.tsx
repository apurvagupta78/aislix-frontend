import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  buildHelpAskQuestion,
  getHelpAskAislixOptions,
  type HelpAskAuthorizedOptions,
  type HelpAskIntent,
  type HelpOperatingRole,
} from "@/lib/ask-aislix";
import {
  buildOperatingContext,
  buildUserContext,
  CUSTOM_REQUEST_PLACEHOLDERS,
  USER_ROLE_PLACEHOLDERS,
} from "@/lib/ask-aislix/help-ask-aislix.context";
import { HELP_CUSTOM_REQUEST_MAX_LENGTH } from "@/lib/ask-aislix/help-ask-aislix.types";
import {
  getAvailableTopicsForRole,
  GROUP_BY_LABELS,
  HELP_LIMIT_OPTIONS,
  HELP_ROLE_CARDS,
  HELP_TIME_PRESETS,
  metricsForTopic,
  PRODUCT_MODE_LABELS,
  type HelpTopicConfig,
} from "@/lib/ask-aislix/help-ask-aislix.config";
import { resolveHelpTimeRange } from "@/lib/ask-aislix/help-ask-aislix.dates";
import { requireOrgId } from "@/lib/db/context";

const WIZARD_STEPS = [
  "operatingModel",
  "userRole",
  "topic",
  "location",
  "time",
  "additional",
] as const;

type WizardStep = (typeof WIZARD_STEPS)[number];
type DialogPhase = "wizard" | "generating" | "review";

const STEP_TITLES: Record<WizardStep, string> = {
  operatingModel: "What type of operation are you analyzing?",
  userRole: "What is your role?",
  topic: "What do you want to know?",
  location: "Where do you want to analyze?",
  time: "What time period should Aislix analyze?",
  additional: "Anything else you want Aislix to analyze?",
};

type WizardState = {
  role: HelpOperatingRole | null;
  userRole: string;
  topic: string | null;
  locationScope: "all_my_locations" | "specific";
  country: string;
  city: string;
  storeIds: string[];
  productMode: string;
  productValue: string;
  metric: string;
  timePreset: string;
  customFrom: string;
  customTo: string;
  groupBy: string;
  limit: number;
  optionalBrand: string;
  optionalCategory: string;
  customUserRequest: string;
};

const INITIAL: WizardState = {
  role: null,
  userRole: "",
  topic: null,
  locationScope: "all_my_locations",
  country: "",
  city: "",
  storeIds: [],
  productMode: "all",
  productValue: "",
  metric: "",
  timePreset: "30d",
  customFrom: "",
  customTo: "",
  groupBy: "",
  limit: 10,
  optionalBrand: "",
  optionalCategory: "",
  customUserRequest: "",
};

function topicConfig(
  role: HelpOperatingRole | null,
  topic: string | null,
): HelpTopicConfig | null {
  if (!role || !topic) return null;
  return getAvailableTopicsForRole(role).find((t) => t.id === topic) ?? null;
}

function buildIntent(state: WizardState, options: HelpAskAuthorizedOptions): HelpAskIntent {
  const cfg = topicConfig(state.role, state.topic)!;
  const timeResolved = resolveHelpTimeRange(state.timePreset, state.customFrom, state.customTo);
  const timeLabel =
    HELP_TIME_PRESETS.find((p) => p.id === state.timePreset)?.label ?? "Custom date range";
  const selectedStores = options.stores.filter((s) => state.storeIds.includes(s.id));

  const standardProductModes = new Set([
    "all",
    "category",
    "brand",
    "sku",
    "item_code",
    "product_name",
    "variant",
    "batch",
  ]);

  let product_scope: HelpAskIntent["product_scope"];
  const extraFilters: Record<string, string> = {};

  if (cfg.needsProduct) {
    if (state.productMode === "all" || !state.productValue.trim()) {
      product_scope = { mode: "all" };
    } else if (standardProductModes.has(state.productMode)) {
      product_scope = {
        mode: state.productMode as NonNullable<HelpAskIntent["product_scope"]>["mode"],
        ...(state.productMode === "category" ? { category: state.productValue } : {}),
        ...(state.productMode === "brand" ? { brand: state.productValue } : {}),
        ...(state.productMode === "sku" ? { sku: state.productValue } : {}),
        ...(state.productMode === "item_code" ? { item_code: state.productValue } : {}),
        ...(state.productMode === "product_name" ? { product_name: state.productValue } : {}),
        ...(state.productMode === "variant" ? { variant: state.productValue } : {}),
        ...(state.productMode === "batch" ? { batch: state.productValue } : {}),
      };
    } else {
      product_scope = { mode: "all" };
      extraFilters[state.productMode] = state.productValue;
    }
  }

  const metricOptions = metricsForTopic(state.topic!);
  const metricDef = metricOptions.find((m) => m.id === state.metric);

  return {
    operating_role: state.role!,
    operating_context: buildOperatingContext(state.role!),
    user_role: state.userRole.trim(),
    user_context: buildUserContext(state.role!, state.userRole),
    topic: state.topic!,
    topic_label: cfg.label,
    locations: {
      scope: state.locationScope,
      ...(state.locationScope === "specific" && state.country ? { country: state.country } : {}),
      ...(state.locationScope === "specific" && state.city ? { city: state.city } : {}),
      ...(state.locationScope === "specific" && state.storeIds.length
        ? {
            store_ids: state.storeIds,
            store_names: selectedStores.map((s) => s.name),
          }
        : {}),
    },
    ...(product_scope ? { product_scope } : {}),
    ...(state.metric ? { metric: state.metric, metric_label: metricDef?.label } : {}),
    time_range: {
      preset: timeResolved.preset,
      label: timeLabel,
      from: timeResolved.from,
      to: timeResolved.to,
    },
    ...(state.groupBy ? { group_by: state.groupBy } : {}),
    ...(state.limit > 0 ? { limit: state.limit } : {}),
    ...((state.optionalBrand || state.optionalCategory || Object.keys(extraFilters).length > 0) && {
      optional_filters: {
        ...extraFilters,
        ...(state.optionalBrand ? { brand: state.optionalBrand } : {}),
        ...(state.optionalCategory ? { category: state.optionalCategory } : {}),
      },
    }),
    ...(state.customUserRequest.trim()
      ? { custom_user_request: state.customUserRequest.trim() }
      : {}),
  };
}

export function HelpMeAskAislixDialog({
  open,
  onOpenChange,
  onAskAislix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAskAislix: (question: string) => void;
}) {
  const [state, setState] = useState<WizardState>(INITIAL);
  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<DialogPhase>("wizard");
  const [options, setOptions] = useState<HelpAskAuthorizedOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedQuestion, setGeneratedQuestion] = useState("");
  const [contextSummary, setContextSummary] = useState("");

  const currentStep = WIZARD_STEPS[stepIndex] ?? "operatingModel";
  const cfg = topicConfig(state.role, state.topic);
  const isLastStep = stepIndex >= WIZARD_STEPS.length - 1;

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setError(null);
    try {
      const orgId = await requireOrgId();
      const data = await getHelpAskAislixOptions({ data: { activeOrgId: orgId } });
      setOptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load authorized locations.");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadOptions();
    } else {
      setState(INITIAL);
      setStepIndex(0);
      setPhase("wizard");
      setError(null);
      setGeneratedQuestion("");
      setContextSummary("");
    }
  }, [open, loadOptions]);

  const patch = (partial: Partial<WizardState>) => setState((s) => ({ ...s, ...partial }));

  const citiesForCountry = useMemo(() => {
    if (!options || !state.country) return options?.cities ?? [];
    return options.stores
      .filter((s) => s.country === state.country)
      .map((s) => s.city ?? "")
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
  }, [options, state.country]);

  const storesForLocation = useMemo(() => {
    if (!options) return [];
    return options.stores.filter((s) => {
      if (state.country && s.country !== state.country) return false;
      if (state.city && s.city !== state.city) return false;
      return true;
    });
  }, [options, state.country, state.city]);

  const availableTopics = state.role ? getAvailableTopicsForRole(state.role) : [];

  const goNext = () => {
    if (stepIndex < WIZARD_STEPS.length - 1) setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    if (phase === "review") {
      setPhase("wizard");
      setStepIndex(WIZARD_STEPS.length - 1);
      return;
    }
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const canContinue = (): boolean => {
    if (currentStep === "operatingModel") return !!state.role;
    if (currentStep === "userRole") return !!state.userRole.trim();
    if (currentStep === "topic") return !!state.topic;
    if (currentStep === "location") {
      if (state.locationScope === "all_my_locations") return true;
      return !!(state.country || state.city || state.storeIds.length);
    }
    if (currentStep === "time") {
      if (state.timePreset !== "custom") return true;
      return !!state.customFrom && !!state.customTo;
    }
    return true;
  };

  const finishWizard = async () => {
    if (!options || phase === "generating") return;
    setPhase("generating");
    setError(null);
    try {
      const intent = buildIntent(state, options);
      const orgId = await requireOrgId();
      const result = await buildHelpAskQuestion({ data: { activeOrgId: orgId, intent } });
      if (!result.ok) {
        setPhase("wizard");
        setError(result.error ?? "Could not build your question.");
        return;
      }
      setGeneratedQuestion(result.question);
      setContextSummary(result.contextSummary ?? "");
      setPhase("review");
    } catch (err) {
      setPhase("wizard");
      setError(err instanceof Error ? err.message : "Could not build your question.");
    }
  };

  const handlePrimaryAction = () => {
    if (isLastStep) {
      void finishWizard();
      return;
    }
    goNext();
  };

  const handleAskAislix = () => {
    if (!generatedQuestion.trim()) return;
    onAskAislix(generatedQuestion);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-navy">
            <Wand2 className="h-5 w-5" />
            Help me ask Aislix
          </DialogTitle>
          <DialogDescription>
            Answer a few quick questions — we&apos;ll draft a precise question for you to review.
          </DialogDescription>
        </DialogHeader>

        {phase === "generating" ? (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-navy">Building your question…</p>
          </div>
        ) : phase === "review" ? (
          <div className="space-y-4">
            <p className="text-sm font-medium text-navy">Here&apos;s what I understood:</p>
            <blockquote className="rounded-lg border border-line bg-canvas px-4 py-3 text-sm leading-relaxed text-navy">
              &ldquo;{generatedQuestion}&rdquo;
            </blockquote>
            {contextSummary ? (
              <p className="text-xs text-mp-muted">{contextSummary}</p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-navy">{STEP_TITLES[currentStep]}</p>
              {currentStep === "additional" ? (
                <p className="text-xs text-mp-muted">
                  Tell Aislix anything specific that you have in mind. You don&apos;t need to know
                  how to write a prompt.
                </p>
              ) : null}
            </div>

            {optionsLoading && currentStep !== "operatingModel" ? (
              <div className="flex items-center gap-2 text-sm text-mp-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your authorized locations…
              </div>
            ) : null}

            {currentStep === "operatingModel" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {HELP_ROLE_CARDS.map((card) => {
                  const Icon = card.icon;
                  const selected = state.role === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() =>
                        patch({ role: card.id, topic: null, metric: "", userRole: state.userRole })
                      }
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        selected
                          ? "border-primary bg-white shadow-card"
                          : "border-line bg-canvas hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-white text-navy shadow-sm">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-semibold text-navy">{card.label}</p>
                          <p className="mt-1 text-xs text-mp-muted">{card.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {currentStep === "userRole" && state.role ? (
              <div className="space-y-2">
                <p className="text-xs text-mp-muted">
                  Tell Aislix your role so it can understand your perspective.
                </p>
                <Input
                  value={state.userRole}
                  placeholder={USER_ROLE_PLACEHOLDERS[state.role]}
                  onChange={(e) => patch({ userRole: e.target.value })}
                />
              </div>
            ) : null}

            {currentStep === "topic" && state.role ? (
              <div className="flex flex-wrap gap-2">
                {availableTopics.map((t) => (
                  <Button
                    key={t.id}
                    type="button"
                    size="sm"
                    variant={state.topic === t.id ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => patch({ topic: t.id, metric: "" })}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {currentStep === "location" && options ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={state.locationScope === "all_my_locations" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => patch({ locationScope: "all_my_locations", storeIds: [] })}
                  >
                    All my locations
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={state.locationScope === "specific" ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() => patch({ locationScope: "specific" })}
                  >
                    Choose specific locations
                  </Button>
                </div>

                {state.locationScope === "specific" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <Select
                        value={state.country}
                        onValueChange={(v) => patch({ country: v, city: "", storeIds: [] })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.countries.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>City</Label>
                      <Select
                        value={state.city}
                        onValueChange={(v) => patch({ city: v, storeIds: [] })}
                        disabled={!state.country}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select city" />
                        </SelectTrigger>
                        <SelectContent>
                          {citiesForCountry.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Store</Label>
                      <div className="flex flex-wrap gap-2">
                        {storesForLocation.map((s) => {
                          const active = state.storeIds.includes(s.id);
                          return (
                            <Button
                              key={s.id}
                              type="button"
                              size="sm"
                              variant={active ? "default" : "outline"}
                              className="rounded-full"
                              onClick={() =>
                                patch({
                                  storeIds: active
                                    ? state.storeIds.filter((id) => id !== s.id)
                                    : [...state.storeIds, s.id],
                                })
                              }
                            >
                              {s.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === "time" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {HELP_TIME_PRESETS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      size="sm"
                      variant={state.timePreset === p.id ? "default" : "outline"}
                      className="rounded-full"
                      onClick={() => patch({ timePreset: p.id })}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {state.timePreset === "custom" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Date from</Label>
                      <Input
                        type="date"
                        value={state.customFrom}
                        onChange={(e) => patch({ customFrom: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date to</Label>
                      <Input
                        type="date"
                        value={state.customTo}
                        onChange={(e) => patch({ customTo: e.target.value })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {currentStep === "additional" && cfg ? (
              <div className="space-y-4">
                {cfg.needsProduct ? (
                  <div className="space-y-3">
                    <Label>Product filter (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {(cfg.productDimensions ?? ["category", "brand", "sku"]).map((dim) => (
                        <Button
                          key={dim}
                          type="button"
                          size="sm"
                          variant={state.productMode === dim ? "default" : "outline"}
                          className="rounded-full capitalize"
                          onClick={() => patch({ productMode: dim, productValue: "" })}
                        >
                          {PRODUCT_MODE_LABELS[dim] ?? dim.replace(/_/g, " ")}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant={state.productMode === "all" ? "default" : "outline"}
                        className="rounded-full"
                        onClick={() => patch({ productMode: "all", productValue: "" })}
                      >
                        All products
                      </Button>
                    </div>
                    {state.productMode !== "all" ? (
                      <Input
                        placeholder={`Enter ${PRODUCT_MODE_LABELS[state.productMode] ?? state.productMode}`}
                        value={state.productValue}
                        onChange={(e) => patch({ productValue: e.target.value })}
                      />
                    ) : null}
                  </div>
                ) : null}

                {cfg.needsMetric ? (
                  <div className="space-y-2">
                    <Label>Metric (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {metricsForTopic(state.topic!).map((m) => (
                        <Button
                          key={m.id}
                          type="button"
                          size="sm"
                          disabled={!m.available}
                          variant={state.metric === m.id ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => patch({ metric: m.id })}
                        >
                          {m.label}
                          {m.comingSoon ? " (Coming soon)" : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {cfg.needsGrouping ? (
                  <div className="space-y-2">
                    <Label>Group by (optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {(cfg.groupByOptions ?? []).map((g) => (
                        <Button
                          key={g}
                          type="button"
                          size="sm"
                          variant={state.groupBy === g ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => patch({ groupBy: g })}
                        >
                          {GROUP_BY_LABELS[g] ?? g}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {HELP_LIMIT_OPTIONS.map((l) => (
                        <Button
                          key={l.id}
                          type="button"
                          size="sm"
                          variant={state.limit === l.id ? "default" : "outline"}
                          className="rounded-full"
                          onClick={() => patch({ limit: l.id })}
                        >
                          {l.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Brand (optional)</Label>
                    <Input
                      value={state.optionalBrand}
                      onChange={(e) => patch({ optionalBrand: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category (optional)</Label>
                    {options?.categories.length ? (
                      <Select
                        value={state.optionalCategory}
                        onValueChange={(v) => patch({ optionalCategory: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.categories.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={state.optionalCategory}
                        onChange={(e) => patch({ optionalCategory: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-line pt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-mp-muted">
                    Or tell Aislix in your own words
                  </p>
                  <Textarea
                    value={state.customUserRequest}
                    placeholder={
                      state.role
                        ? CUSTOM_REQUEST_PLACEHOLDERS[state.role]
                        : "Example: I want to know whether Coca-Cola shelf space has improved in my Mumbai stores compared with last month..."
                    }
                    rows={3}
                    maxLength={HELP_CUSTOM_REQUEST_MAX_LENGTH}
                    className="min-h-[72px] resize-y text-sm"
                    onChange={(e) =>
                      patch({
                        customUserRequest: e.target.value.slice(0, HELP_CUSTOM_REQUEST_MAX_LENGTH),
                      })
                    }
                  />
                  <p className="text-right text-[11px] text-mp-muted">
                    {state.customUserRequest.length}/{HELP_CUSTOM_REQUEST_MAX_LENGTH}
                  </p>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {phase === "review" ? (
            <>
              <div />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={goBack}>
                  Edit
                </Button>
                <Button type="button" onClick={handleAskAislix}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Ask Aislix
                </Button>
              </div>
            </>
          ) : phase === "wizard" ? (
            <>
              <div className="text-xs text-mp-muted">
                Step {stepIndex + 1} of {WIZARD_STEPS.length}
              </div>
              <div className="flex flex-wrap gap-2">
                {stepIndex > 0 ? (
                  <Button type="button" variant="outline" onClick={goBack}>
                    Back
                  </Button>
                ) : null}
                {(currentStep === "location" ||
                  currentStep === "time" ||
                  currentStep === "additional") && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => (isLastStep ? void finishWizard() : goNext())}
                  >
                    Skip
                  </Button>
                )}
                <Button type="button" disabled={!canContinue()} onClick={handlePrimaryAction}>
                  {isLastStep ? "Build question" : "Continue"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
