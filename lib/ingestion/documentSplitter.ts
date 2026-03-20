export type DocumentSection = {
  id: string;
  title: string;
  text: string;
};

function cleanText(text: string): string {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLikelyHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 120) return false;

  if (/^(means of escape|compartmentation|fire spread|firefighting access|active fire protection systems|compliance summary|building overview|fire strategy)$/i.test(trimmed)) {
    return true;
  }

  if (/^[A-Z][A-Z0-9 /&(),.-]{3,}$/.test(trimmed)) {
    return true;
  }

  if (/^\d+(\.\d+)*\s+[A-Z]/.test(trimmed)) {
    return true;
  }

  return false;
}

export function splitDocumentIntoSections(text: string): DocumentSection[] {
  const cleaned = cleanText(text);
  if (!cleaned) return [];

  const lines = cleaned.split("\n");
  const sections: DocumentSection[] = [];

  let currentTitle = "Document Start";
  let currentBuffer: string[] = [];

  const flush = () => {
    const body = currentBuffer.join("\n").trim();
    if (!body) return;

    sections.push({
      id: `section-${sections.length + 1}`,
      title: currentTitle,
      text: body
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (isLikelyHeading(line)) {
      flush();
      currentTitle = line;
      currentBuffer = [];
      continue;
    }

    currentBuffer.push(rawLine);
  }

  flush();

  if (sections.length === 0) {
    sections.push({
      id: "section-1",
      title: "Full Document",
      text: cleaned
    });
  }

  return sections;
}