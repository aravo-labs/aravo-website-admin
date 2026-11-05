"use client";

/**
 * The formatting controls, in the box with the text.
 *
 * Grouped the way the work happens: what the block is, then how the words look,
 * then lists, then the things that interrupt a paragraph. Every control shows
 * whether it is currently on, because a toolbar that cannot tell you the state
 * of the cursor is a row of guesses.
 *
 * The set is exactly what the API's allowlist keeps. Adding a control here
 * without adding the tag there produces the worst possible behaviour: it works
 * until you save.
 */

import { useEditorState, type Editor } from "@tiptap/react";
import { useCallback, useState } from "react";

import { cx } from "@/components/ui";
import { CODE_LANGUAGES } from "./languages";
import { LinkDialog } from "./LinkDialog";
import { SIZE_STEPS, type SizeStep } from "./font-size";

function Button({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cx(
        "grid h-7 min-w-7 place-items-center rounded-[var(--radius-sm)] px-1.5",
        "text-[13px] transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-[var(--color-accent)] text-white"
          : "text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-[var(--color-border)]" />;
}

export function Toolbar({ editor }: { editor: Editor }) {
  // One subscription for the whole toolbar. Reading `editor.isActive(...)`
  // directly in render does not re-run when the selection moves, so the
  // buttons would show the state of wherever the cursor was last time React
  // happened to render.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      code: editor.isActive("code"),
      highlight: editor.isActive("highlight"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      h4: editor.isActive("heading", { level: 4 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      codeBlock: editor.isActive("codeBlock"),
      codeLanguage: (editor.getAttributes("codeBlock").language as string | undefined) ?? "kotlin",
      link: editor.isActive("link"),
      size: (editor.getAttributes("fontSize").step as SizeStep | undefined) ?? "rt-base",
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  const [linking, setLinking] = useState(false);

  const applyLink = useCallback(
    (href: string) => {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      setLinking(false);
    },
    [editor],
  );

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinking(false);
  }, [editor]);

  const block = state.h2 ? "h2" : state.h3 ? "h3" : state.h4 ? "h4" : "p";

  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-0.5 border-b border-[var(--color-border)]",
        "bg-[var(--color-surface-sunken)] px-2 py-1.5",
      )}
    >
      <select
        aria-label="Paragraph style"
        value={block}
        onChange={(e) => {
          const next = e.target.value;
          const chain = editor.chain().focus();
          if (next === "p") chain.setParagraph().run();
          else chain.setHeading({ level: Number(next.slice(1)) as 2 | 3 | 4 }).run();
        }}
        className="h-7 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[12px] text-[var(--color-text)]"
      >
        <option value="p">Body</option>
        <option value="h2">Heading</option>
        <option value="h3">Subheading</option>
        <option value="h4">Small heading</option>
      </select>

      <select
        aria-label="Text size"
        value={state.size}
        onChange={(e) =>
          editor.chain().focus().setFontSize(e.target.value as SizeStep).run()
        }
        className="h-7 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[12px] text-[var(--color-text)]"
      >
        {SIZE_STEPS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <Divider />

      <Button label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <strong className="font-semibold">B</strong>
      </Button>
      <Button label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <em className="font-serif">I</em>
      </Button>
      <Button label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </Button>
      <Button label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Button>
      <Button label="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>
        <span className="font-mono">{"</>"}</span>
      </Button>
      <Button
        label="Highlight"
        active={state.highlight}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
      >
        <span className="rounded-[2px] bg-[#fde68a] px-1 text-[var(--color-text)]">H</span>
      </Button>

      <Divider />

      <Button label="Bulleted list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <BulletIcon />
      </Button>
      <Button label="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <NumberIcon />
      </Button>
      <Button label="Quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <span className="text-[15px] leading-none">&rdquo;</span>
      </Button>
      <Button label="Code block" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <span className="font-mono text-[11px]">{"{ }"}</span>
      </Button>

      {/* Only while the cursor is in one. A language control that is always
          visible invites setting the language of the paragraph you are in. */}
      {state.codeBlock && (
        <select
          aria-label="Code language"
          value={state.codeLanguage}
          onChange={(e) =>
            editor.chain().focus().updateAttributes("codeBlock", { language: e.target.value }).run()
          }
          className="h-7 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 text-[12px] text-[var(--color-text)]"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      )}

      <Divider />

      <Button
        label={state.link ? "Edit link" : "Add link"}
        active={state.link}
        onClick={() => setLinking(true)}
      >
        <LinkIcon />
      </Button>
      <Button label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <span className="text-[15px] leading-none">&mdash;</span>
      </Button>
      <Button
        label="Clear formatting"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
      >
        <span className="text-[13px]">A&#8202;&#x2717;</span>
      </Button>

      <Divider />

      <Button label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>
        <UndoIcon />
      </Button>
      <Button label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>
        <UndoIcon flipped />
      </Button>

      <LinkDialog
        open={linking}
        initial={(editor.getAttributes("link").href as string | undefined) ?? undefined}
        onClose={() => setLinking(false)}
        onSubmit={applyLink}
        onRemove={removeLink}
      />
    </div>
  );
}

/* ---- icons: drawn rather than imported, so the toolbar carries no font ---- */

function BulletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="2.5" cy="4" r="1.2" fill="currentColor" />
      <circle cx="2.5" cy="8" r="1.2" fill="currentColor" />
      <circle cx="2.5" cy="12" r="1.2" fill="currentColor" />
      <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function NumberIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <text x="0" y="5.5" fontSize="5" fill="currentColor">1</text>
      <text x="0" y="10" fontSize="5" fill="currentColor">2</text>
      <text x="0" y="14.5" fontSize="5" fill="currentColor">3</text>
      <path d="M6 4h8M6 8.5h8M6 13h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2-2a2.47 2.47 0 0 0-3.5-3.5l-.8.8M9.5 6.5a2.5 2.5 0 0 0-3.5 0l-2 2A2.47 2.47 0 0 0 7.5 12l.8-.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UndoIcon({ flipped }: { flipped?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={flipped ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M6 4 3 7l3 3M3 7h6.5A3.5 3.5 0 0 1 13 10.5v0A3.5 3.5 0 0 1 9.5 14H7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
