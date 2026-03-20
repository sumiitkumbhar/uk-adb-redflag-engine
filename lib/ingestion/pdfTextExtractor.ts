import fs from "node:fs";
import path from "node:path";

export type ExtractedDocumentText = {
  sourcePath: string;
  fileName: string;
  contentType: "text" | "pdf" | "unknown";
  text: string;
};

function detectContentType(filePath: string): "text" | "pdf" | "unknown" {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".txt" || ext === ".md") return "text";
  if (ext === ".pdf") return "pdf";
  return "unknown";
}

/**
 * V1:
 * - real text files: reads directly
 * - pdf files: currently reads only if the PDF text has already been extracted externally
 *
 * This is intentional.
 * Do not pretend raw PDF binary is usable as text.
 */
export function extractDocumentText(filePath: string): ExtractedDocumentText {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const contentType = detectContentType(absolutePath);
  const fileName = path.basename(absolutePath);

  if (contentType === "text") {
    const text = fs.readFileSync(absolutePath, "utf8");
    return {
      sourcePath: absolutePath,
      fileName,
      contentType,
      text
    };
  }

  if (contentType === "pdf") {
    throw new Error(
      `PDF ingestion is not yet implemented in this V1 file. ` +
        `First convert the PDF to text, then run the pipeline on the extracted .txt file.`
    );
  }

  throw new Error(
    `Unsupported file type for V1 ingestion: ${fileName}. Use .txt or .md for now.`
  );
}