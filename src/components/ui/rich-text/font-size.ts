/**
 * Text size, as a named step rather than a pixel value.
 *
 * The obvious implementation is an inline `style="font-size: 18px"`, and it is
 * the wrong one twice over. The API cannot allow a `style` attribute narrowly
 * - permitting font-size permits position, z-index and background-image in the
 * same breath - so an inline style would be stripped on save and the author's
 * work would disappear. And loose pixel values drift out of the site's type
 * scale, so a page ends up with four sizes of nearly-the-same text.
 *
 * Four steps, written as a class the sanitiser holds to a closed set. They are
 * relative units on the site, so a step stays proportional wherever it sits.
 */

import { Mark, mergeAttributes } from "@tiptap/core";

export const SIZE_STEPS = [
  { value: "rt-sm", label: "Small" },
  { value: "rt-base", label: "Normal" },
  { value: "rt-lg", label: "Large" },
  { value: "rt-xl", label: "Extra large" },
] as const;

export type SizeStep = (typeof SIZE_STEPS)[number]["value"];

const VALUES = SIZE_STEPS.map((s) => s.value) as readonly string[];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (step: SizeStep) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Mark.create({
  name: "fontSize",

  addAttributes() {
    return {
      step: {
        default: null as string | null,
        parseHTML: (element) => {
          const found = Array.from(element.classList).find((c) => VALUES.includes(c));
          return found ?? null;
        },
        renderHTML: (attributes) =>
          attributes.step ? { class: attributes.step as string } : {},
      },
    };
  },

  parseHTML() {
    // Only spans that carry one of our steps. Without the guard this would
    // claim every span in a pasted document.
    return [
      {
        tag: "span",
        getAttrs: (element) =>
          Array.from((element as HTMLElement).classList).some((c) => VALUES.includes(c))
            ? null
            : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize:
        (step) =>
        ({ commands }) =>
          // "Normal" is the absence of a step, not a step of its own: marking
          // it would litter the document with spans that do nothing.
          step === "rt-base"
            ? commands.unsetMark(this.name)
            : commands.setMark(this.name, { step }),
      unsetFontSize:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
