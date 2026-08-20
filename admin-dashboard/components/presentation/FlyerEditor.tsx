"use client";

import { useRef } from "react";
import type { FlyerContent } from "@/lib/presentation/templates";
import { AiRewriteControl } from "./AiRewriteControl";
import { FlyerCanvas } from "./FlyerCanvas";

interface Props {
  content: FlyerContent;
  onChange: (content: FlyerContent) => void;
  sourceText: string;
}

/** Canva-style single-page editor for the "flyer" format - no thumbnail rail (there's
 * only one page), every field edited directly on FlyerCanvas, plus one AI-rewrite
 * control for the whole page since a flyer is one unit rather than a sequence like a
 * deck's slides. Owns the hero-photo upload (FlyerCanvas just renders whatever
 * content.imageUrl is and asks to pick/remove one) the same way DeckEditor.tsx owns
 * image uploads for deck elements. */
export function FlyerEditor({ content, onChange, sourceText }: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  async function aiRewrite(instruction: string) {
    const response = await fetch("/api/presentation/ai-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "flyer", instruction, sourceText, content }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `Request failed: ${response.status}`);
    onChange(body.content as FlyerContent);
  }

  function handleImagePick(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange({ ...content, imageUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <AiRewriteControl label="Rewrite this flyer" onApply={aiRewrite} />
      </div>
      <div className="w-full overflow-x-auto">
        <div className="mx-auto w-fit rounded-md border border-border bg-white shadow-sm">
          <FlyerCanvas
            headline={content.headline}
            subheadline={content.subheadline}
            body={content.body}
            cta={content.cta}
            footer={content.footer}
            imageUrl={content.imageUrl}
            editable
            onHeadlineChange={(headline) => onChange({ ...content, headline })}
            onSubheadlineChange={(subheadline) => onChange({ ...content, subheadline })}
            onBodyChange={(i, value) => onChange({ ...content, body: content.body.map((b, j) => (j === i ? value : b)) })}
            onBodyAdd={() => onChange({ ...content, body: [...content.body, "New line"] })}
            onBodyRemove={(i) => onChange({ ...content, body: content.body.filter((_, j) => j !== i) })}
            onCtaChange={(cta) => onChange({ ...content, cta })}
            onFooterChange={(footer) => onChange({ ...content, footer })}
            onImageChange={(imageUrl) => onChange({ ...content, imageUrl })}
            onImagePick={() => imageInputRef.current?.click()}
          />
        </div>
      </div>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImagePick(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
