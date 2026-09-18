import { Button } from "@/components/ui/button";

export function AskAislixFollowUps({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) {
  if (!questions.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q) => (
        <Button key={q} type="button" variant="secondary" size="sm" onClick={() => onSelect(q)}>
          {q}
        </Button>
      ))}
    </div>
  );
}
