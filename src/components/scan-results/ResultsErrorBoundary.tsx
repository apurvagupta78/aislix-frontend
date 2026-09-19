import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  scanId?: string;
};

type State = {
  error: Error | null;
};

/** Keeps a single bad audit from crashing the whole /results route. */
export class ResultsErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Results render failed", error, info);
    reportLovableError(error, {
      boundary: "results_error_boundary",
      scan_id: this.props.scanId,
      component_stack: info.componentStack,
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.scanId !== this.props.scanId && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="card-surface flex flex-col items-center gap-4 px-6 py-14 text-center"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Couldn&apos;t render this audit</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The audit data loaded, but part of the report failed to display. You can retry or open
              audit history while we fix the view.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="brand"
              size="sm"
              className="rounded-xl"
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </Button>
            <Button type="button" variant="subtle" size="sm" className="rounded-xl" asChild>
              <a href="/history">Audit history</a>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
