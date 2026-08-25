/**
 * The languages a code block can be written in.
 *
 * Exactly the ones the public site has registered a highlighter for. Offering
 * more here would produce blocks that look right while writing and arrive on
 * the site in one flat colour, and the API drops an unknown `language-` class
 * on save anyway - `app/core/richtext.py`. The three lists have to move
 * together.
 */

export const CODE_LANGUAGES = [
  { value: "kotlin", label: "Kotlin" },
  { value: "java", label: "Java" },
  { value: "swift", label: "Swift" },
  { value: "objectivec", label: "Objective-C" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "dart", label: "Dart" },
  { value: "bash", label: "Shell" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "XML or HTML" },
  { value: "plaintext", label: "Plain text" },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["value"];
