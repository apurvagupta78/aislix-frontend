import type { AskAislixResponse } from "@/lib/ask-aislix/ask-aislix.types";
import { AskAislixActions } from "./AskAislixActions";
import { AskAislixFollowUps } from "./AskAislixFollowUps";
import { AskAislixVisual } from "./AskAislixVisual";

export function AskAislixAnswerPanel({
  response,
  onFollowUp,
}: {
  response: AskAislixResponse;
  onFollowUp: (question: string) => void;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-line bg-white p-5 shadow-card md:p-6">
      <div>
        <p className="text-base font-semibold text-navy">{response.answer}</p>
        {response.summary ? <p className="mt-2 text-sm text-mp-muted">{response.summary}</p> : null}
      </div>

      {response.metrics?.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {response.metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-line bg-muted/20 px-3 py-3">
              <p className="text-xs text-mp-muted">{m.label}</p>
              <p className="mt-1 text-lg font-semibold text-navy">
                {m.value}
                {m.unit ? ` ${m.unit}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <AskAislixVisual visual={response.visual} />

      {response.table?.rows?.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-mp-muted">
              <tr>
                {response.table.columns.map((col) => (
                  <th key={col} className="px-3 py-2">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {response.table.rows.map((row, i) => (
                <tr key={i} className="border-t border-line">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2">
                      {cell ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {response.insights?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-mp-muted">
          {response.insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
        </ul>
      ) : null}

      <AskAislixActions actions={response.actions} />
      <AskAislixFollowUps questions={response.follow_up_questions ?? []} onSelect={onFollowUp} />
    </section>
  );
}
