import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PromptEditorFieldsProps {
  descriptionPrompt: string;
  onDescriptionPromptChange: (value: string) => void;
  questionPrompt: string;
  onQuestionPromptChange: (value: string) => void;
}

export function PromptEditorFields({
  descriptionPrompt,
  onDescriptionPromptChange,
  questionPrompt,
  onQuestionPromptChange,
}: PromptEditorFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>默认描述提示词</Label>
        <Textarea
          className="min-h-32"
          value={descriptionPrompt}
          onChange={(event) => onDescriptionPromptChange(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>默认问题提示词</Label>
        <Textarea
          className="min-h-32"
          value={questionPrompt}
          onChange={(event) => onQuestionPromptChange(event.target.value)}
        />
      </div>
    </>
  );
}
