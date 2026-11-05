"use client";

/**
 * The formatted-copy editor.
 *
 * Every long-form field in this panel used to be a bare textarea, which meant
 * an author writing a job description or an SDK page had to know markdown, or
 * do without formatting entirely. This is the same field with the formatting
 * controls in the box, where the writing happens.
 *
 * It produces HTML, and the API cleans that HTML on write against an
 * allowlist - `app/core/richtext.py` - which is deliberately the shape of the
 * toolbar below. The two have to move together: a control added here that the
 * allowlist does not know about will appear to work and then vanish on save,
 * which is worse than not offering it.
 *
 * Tables are included even though the toolbar barely touches them. The SDK
 * docs carry an events table, and TipTap drops nodes it has no extension for
 * while parsing - so leaving the extension out would silently delete that
 * table the first time somebody opened the page and pressed save.
 */

import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Highlight } from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import dart from "highlight.js/lib/languages/dart";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import objectivec from "highlight.js/lib/languages/objectivec";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { useEffect, useId, useRef } from "react";

import { cx } from "@/components/ui";
import { FontSize, SIZE_STEPS, type SizeStep } from "./rich-text/font-size";
import { Toolbar } from "./rich-text/Toolbar";

/**
 * The same grammars the public site loads, so a block is coloured here the way
 * it will be coloured there. Only these: the full bundle is around 900KB for a
 * field that shows one snippet.
 */
const lowlight = createLowlight();
for (const [name, grammar] of [
  ["kotlin", kotlin],
  ["java", java],
  ["swift", swift],
  ["objectivec", objectivec],
  ["typescript", typescript],
  ["javascript", javascript],
  ["dart", dart],
  ["bash", bash],
  ["json", json],
  ["xml", xml],
] as const) {
  lowlight.register(name, grammar);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 220,
  invalid,
  id,
  "aria-describedby": describedBy,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
}) {
  const fallbackId = useId();
  const editorId = id ?? fallbackId;

  // What we last handed upward. Used to tell a parent's echo of our own value
  // apart from a genuine outside change - without it, every keystroke round
  // trips through the parent and resets the cursor to the start of the field.
  const lastEmitted = useRef(value);

  const editor = useEditor({
    // Rendering on the server and then hydrating gives React a DOM that
    // ProseMirror has already rewritten, and it complains about every node.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Only the levels the sanitiser keeps. Offering h1 would produce a
        // second first-level heading on a page that already has one.
        heading: { levels: [2, 3, 4] },
        link: false,
        // Replaced below by the highlighting one, which also carries the
        // language. StarterKit's plain block cannot, and a code sample with
        // no language arrives on the site in one flat colour.
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "kotlin",
        languageClassPrefix: "language-",
      }),
      Underline,
      Highlight,
      TextStyle,
      FontSize,
      Link.configure({
        openOnClick: false,
        autolink: true,
        // Matches the API's allowlist. Anything else is stripped on save, and
        // an editor that accepts what the server rejects teaches distrust.
        protocols: ["http", "https", "mailto", "tel"],
      }),
      TableKit.configure({ table: { resizable: false } }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        id: editorId,
        class: "rt-surface",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate({ editor }) {
      // An empty document serialises as <p></p>. Passing that up means a
      // "cleared" field is stored as a paragraph containing nothing, which is
      // not the same as empty and reads as a stray blank line on the page.
      const html = editor.isEmpty ? "" : editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  // Outside changes: loading a record, switching rows, a reset after save.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    // Same box, so the form does not jump when the editor mounts.
    return (
      <div
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{ minHeight: minHeight + 44 }}
      />
    );
  }

  return (
    <div
      className={cx(
        "overflow-hidden rounded-[var(--radius-md)] border bg-[var(--color-surface)]",
        "focus-within:border-[var(--color-accent)] focus-within:ring-2 focus-within:ring-[var(--color-accent)]/20",
        invalid ? "border-[var(--color-danger)]" : "border-[var(--color-border)]",
      )}
    >
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        data-placeholder={placeholder}
      />
    </div>
  );
}

export { SIZE_STEPS };
export type { SizeStep, Editor };
