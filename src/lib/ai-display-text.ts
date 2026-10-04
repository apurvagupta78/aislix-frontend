/**
 * Aislix never shows AI model names to customers. Model-written prose (analysis answers,
 * Ask Aislix replies, QC notes) can still mention them, so it passes through here first.
 * Only apply to narrative text — product names read from labels (e.g. a "LUNA" bar) must stay intact.
 */

const MODEL_ID = /\b(?:chat)?gpt[-\s]?\d+(?:\.\d+)*(?:[-\s](?:astra|luna|terra|mini|nano|pro|turbo|vision))?\b/gi;
const MODEL_NAME = /\b(?:Astra|Luna|ChatGPT|OpenAI|Gemini|Claude|Anthropic)(?:['’]s)?\b/g;

export function hideModelNames(text: string): string {
  if (!text) return text;
  return text
    .replace(MODEL_ID, "AI")
    .replace(MODEL_NAME, "AI")
    .replace(/\bAI(?:\s*(?:\/|\+|and|&)\s*AI)+\b/g, "AI")
    .replace(/\bAI\s+AI\b/g, "AI");
}
