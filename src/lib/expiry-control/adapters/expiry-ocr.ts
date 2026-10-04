/** Expiry date OCR adapter — replace with real provider in production. */

export type ExpiryOcrInput = {
  imageBlob: Blob;
  dateTypeHint?: string;
};

export type ExpiryOcrResult = {
  rawText: string;
  suggestedDate: string | null;
  dateType: string;
  confidence: number | null;
  simulated: boolean;
  label?: string;
};

export interface ExpiryOcrAdapter {
  readonly name: string;
  readDate(input: ExpiryOcrInput): Promise<ExpiryOcrResult>;
}

/** Development-only simulated OCR — never presented as production AI. */
export class SimulatedExpiryOcrAdapter implements ExpiryOcrAdapter {
  readonly name = "simulated";

  async readDate(_input: ExpiryOcrInput): Promise<ExpiryOcrResult> {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const iso = future.toISOString().slice(0, 10);
    return {
      rawText: iso.split("-").reverse().join("/"),
      suggestedDate: iso,
      dateType: "expiry",
      confidence: 0.75,
      simulated: true,
      label: "Simulated — development only",
    };
  }
}

export class ManualExpiryOcrAdapter implements ExpiryOcrAdapter {
  readonly name = "manual";

  async readDate(): Promise<ExpiryOcrResult> {
    return {
      rawText: "",
      suggestedDate: null,
      dateType: "unknown",
      confidence: null,
      simulated: false,
      label: "Manual transcription — review required",
    };
  }
}

/** AI reads the printed date; the auditor still confirms it before it is recorded. */
export class AiExpiryOcrAdapter implements ExpiryOcrAdapter {
  readonly name = "ai";

  async readDate(input: ExpiryOcrInput): Promise<ExpiryOcrResult> {
    const { readExpiryDateFromPhoto } = await import("@/lib/audit-engine/expiry-read-client");
    try {
      const reading = await readExpiryDateFromPhoto(input.imageBlob);
      return {
        rawText: reading.rawText,
        suggestedDate: reading.date,
        dateType: reading.kind === "derived_from_mfg" ? "expiry" : reading.kind === "unknown" ? input.dateTypeHint ?? "expiry" : reading.kind,
        confidence: reading.confidence,
        simulated: false,
        label: reading.date ? "AI reading — confirm the date" : "AI couldn't read the date — type it",
      };
    } catch {
      return {
        rawText: "",
        suggestedDate: null,
        dateType: input.dateTypeHint ?? "unknown",
        confidence: null,
        simulated: false,
        label: "AI reading unavailable — type the date",
      };
    }
  }
}

let activeAdapter: ExpiryOcrAdapter = new AiExpiryOcrAdapter();

export function getExpiryOcrAdapter(): ExpiryOcrAdapter {
  return activeAdapter;
}

export function setExpiryOcrAdapter(adapter: ExpiryOcrAdapter): void {
  activeAdapter = adapter;
}
