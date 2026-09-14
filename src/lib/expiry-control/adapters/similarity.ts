/** Perceptual similarity — review signal only, not fraud accusation. */

export type SimilaritySignal = {
  flagged: boolean;
  score: number | null;
  simulated: boolean;
  message: string;
};

export interface SimilarityAdapter {
  compare(_a: Blob, _b: Blob): Promise<SimilaritySignal>;
}

export class StubSimilarityAdapter implements SimilarityAdapter {
  async compare(): Promise<SimilaritySignal> {
    return {
      flagged: false,
      score: null,
      simulated: true,
      message: "Similarity check not configured — development stub.",
    };
  }
}
