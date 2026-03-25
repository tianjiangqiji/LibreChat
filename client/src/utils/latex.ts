// Pre-compile all regular expressions for better performance
const MHCHEM_CE_REGEX = /\$\\ce\{/g;
const MHCHEM_PU_REGEX = /\$\\pu\{/g;
const MHCHEM_CE_ESCAPED_REGEX = /\$\\\\ce\{[^}]*\}\$/g;
const MHCHEM_PU_ESCAPED_REGEX = /\$\\\\pu\{[^}]*\}\$/g;
const CURRENCY_REGEX =
  /(?<![\\$])\$(?!\$)(?=\d+(?:,\d{3})*(?:\.\d+)?(?:[KMBkmb])?(?:\s|$|[^a-zA-Z\d]))/g;
const SINGLE_DOLLAR_REGEX = /(?<!\\)\$(?!\$)((?:[^$\n]|\\[$])+?)(?<!\\)(?<!`)\$(?!\$)/g;

/**
 * Escapes mhchem package notation in LaTeX by converting single dollar delimiters to double dollars
 * and escaping backslashes in mhchem commands.
 *
 * @param text - The input text containing potential mhchem notation
 * @returns The processed text with properly escaped mhchem notation
 */
function escapeMhchem(text: string): string {
  // First escape the backslashes in mhchem commands
  let result = text.replace(MHCHEM_CE_REGEX, '$\\\\ce{');
  result = result.replace(MHCHEM_PU_REGEX, '$\\\\pu{');

  // Then convert single dollar mhchem to double dollar
  result = result.replace(MHCHEM_CE_ESCAPED_REGEX, (match) => `$${match}$`);
  result = result.replace(MHCHEM_PU_ESCAPED_REGEX, (match) => `$${match}$`);

  return result;
}

/**
 * Efficiently finds all code block regions in the content
 * @param content The content to analyze
 * @returns Array of code block regions [start, end]
 */
function findCodeBlockRegions(content: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  let inlineStart = -1;
  let multilineStart = -1;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    // Check for multiline code blocks
    if (
      char === '`' &&
      i + 2 < content.length &&
      content[i + 1] === '`' &&
      content[i + 2] === '`'
    ) {
      if (multilineStart === -1) {
        multilineStart = i;
        i += 2; // Skip the next two backticks
      } else {
        regions.push([multilineStart, i + 2]);
        multilineStart = -1;
        i += 2;
      }
    }
    // Check for inline code blocks (only if not in multiline)
    else if (char === '`' && multilineStart === -1) {
      if (inlineStart === -1) {
        inlineStart = i;
      } else {
        regions.push([inlineStart, i]);
        inlineStart = -1;
      }
    }
  }

  return regions;
}

/**
 * Checks if a position is inside any code block region using binary search
 * @param position The position to check
 * @param codeRegions Array of code block regions
 * @returns True if position is inside a code block
 */
function isInCodeBlock(position: number, codeRegions: Array<[number, number]>): boolean {
  let left = 0;
  let right = codeRegions.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const [start, end] = codeRegions[mid];

    if (position >= start && position <= end) {
      return true;
    } else if (position < start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return false;
}

/**
 * Extracts and protects base64 data URLs from content, returning placeholders and a restoration function.
 * This prevents LaTeX preprocessing from interfering with base64 image data.
 * @param content The input string that may contain base64 data URLs
 * @returns Object with protected content, placeholders map, and restoration function
 */
function protectBase64DataUrls(
  content: string,
): { protectedContent: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>();
  // Match markdown image syntax with base64 data URLs: ![alt](data:...)
  // Use a more robust regex that handles base64 data which may contain various characters
  const base64ImageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/g;
  let index = 0;
  const protectedContent = content.replace(base64ImageRegex, (match, alt, dataUrl) => {
    const placeholder = `__BASE64_IMAGE_PLACEHOLDER_${index}__`;
    placeholders.set(placeholder, `![${alt}](${dataUrl})`);
    index++;
    return placeholder;
  });
  return { protectedContent, placeholders };
}

/**
 * Restores base64 data URLs from placeholders.
 * @param content The content with placeholders
 * @param placeholders The map of placeholders to original content
 * @returns The content with restored base64 data URLs
 */
function restoreBase64DataUrls(content: string, placeholders: Map<string, string>): string {
  let result = content;
  for (const [placeholder, original] of placeholders) {
    result = result.replace(placeholder, original);
  }
  return result;
}

/**
 * Preprocesses LaTeX content by escaping currency indicators and converting single dollar math delimiters.
 * Optimized for high-frequency execution.
 * @param content The input string containing LaTeX expressions.
 * @returns The processed string with escaped currency indicators and converted math delimiters.
 */
export function preprocessLaTeX(content: string): string {
  // Early return for most common case
  if (!content.includes('$')) return content;

  // Protect base64 data URLs from LaTeX preprocessing
  const { protectedContent, placeholders } = protectBase64DataUrls(content);

  // If no placeholders were created, process normally
  if (placeholders.size === 0) {
    return processLaTeXInternal(content);
  }

  // Process the protected content, then restore base64 data URLs
  const processed = processLaTeXInternal(protectedContent);
  return restoreBase64DataUrls(processed, placeholders);
}

/**
 * Internal function to process LaTeX without base64 protection.
 * @param content The input string containing LaTeX expressions.
 * @returns The processed string.
 */
function processLaTeXInternal(content: string): string {
  // Process mhchem first (usually rare, so check if needed)
  let processed = content;
  if (content.includes('\\ce{') || content.includes('\\pu{')) {
    processed = escapeMhchem(content);
  }

  // Find all code block regions once
  const codeRegions = findCodeBlockRegions(processed);

  // First pass: escape currency dollar signs
  const parts: string[] = [];
  let lastIndex = 0;

  // Reset regex for reuse
  CURRENCY_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = CURRENCY_REGEX.exec(processed)) !== null) {
    if (!isInCodeBlock(match.index, codeRegions)) {
      parts.push(processed.substring(lastIndex, match.index));
      parts.push('\\$');
      lastIndex = match.index + 1;
    }
  }
  parts.push(processed.substring(lastIndex));
  processed = parts.join('');

  // Second pass: convert single dollar delimiters to double dollars
  const result: string[] = [];
  lastIndex = 0;

  // Reset regex for reuse
  SINGLE_DOLLAR_REGEX.lastIndex = 0;

  while ((match = SINGLE_DOLLAR_REGEX.exec(processed)) !== null) {
    if (!isInCodeBlock(match.index, codeRegions)) {
      result.push(processed.substring(lastIndex, match.index));
      result.push(`$$${match[1]}$$`);
      lastIndex = match.index + match[0].length;
    }
  }
  result.push(processed.substring(lastIndex));

  return result.join('');
}
