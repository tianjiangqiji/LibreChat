import type { ContentPart } from '../types/stream';

/**
 * Result of extracting base64 images from text
 */
export interface ExtractedContent {
  /** Array of content parts (text and/or image_url) */
  content: ContentPart[];
  /** Whether any images were extracted */
  hasImages: boolean;
}

/**
 * Regex pattern to match markdown images with base64 data URLs
 * Matches: ![alt](data:image/xxx;base64,yyy)
 */
const BASE64_IMAGE_REGEX = /!\[([^\]]*)\]\((data:image\/([^;]+);base64,([A-Za-z0-9+/=]+))\)/g;

/**
 * Extracts base64 images from markdown text and converts them to structured content parts.
 * Text without images is returned as a single text part.
 * Text with images is split into alternating text and image_url parts.
 *
 * @param text - The text that may contain markdown base64 images
 * @returns Object with content array and hasImages flag
 *
 * @example
 * // Text without images
 * extractBase64Images('Hello world')
 * // Returns: { content: [{ type: 'text', text: 'Hello world' }], hasImages: false }
 *
 * @example
 * // Text with one image
 * extractBase64Images('Here is an image: ![img](data:image/png;base64,abc123)')
 * // Returns: {
 * //   content: [
 * //     { type: 'text', text: 'Here is an image: ' },
 * //     { type: 'image_url', image_url: { url: 'data:image/png;base64,abc123' } }
 * //   ],
 * //   hasImages: true
 * // }
 */
export function extractBase64Images(text: string): ExtractedContent {
  if (!text || typeof text !== 'string') {
    return { content: [{ type: 'text', text: '' }], hasImages: false };
  }

  const parts: ContentPart[] = [];
  let lastIndex = 0;
  let hasImages = false;

  // Reset regex state
  BASE64_IMAGE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = BASE64_IMAGE_REGEX.exec(text)) !== null) {
    hasImages = true;
    const [fullMatch, _alt, dataUrl] = match;
    const matchStart = match.index;

    // Add text before this image (if any)
    if (matchStart > lastIndex) {
      const textBefore = text.slice(lastIndex, matchStart);
      if (textBefore) {
        parts.push({ type: 'text', text: textBefore });
      }
    }

    // Add the image
    parts.push({
      type: 'image_url' as const,
      image_url: { url: dataUrl },
    });

    lastIndex = matchStart + fullMatch.length;
  }

  // Handle the case where no images were found
  if (!hasImages) {
    return { content: [{ type: 'text', text }], hasImages: false };
  }

  // Add any remaining text after the last image
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText) {
      parts.push({ type: 'text', text: remainingText });
    }
  }

  // If parts is empty (shouldn't happen), return original text
  if (parts.length === 0) {
    return { content: [{ type: 'text', text }], hasImages: false };
  }

  return { content: parts, hasImages: true };
}

/**
 * Processes message content to extract base64 images from text.
 * If content is already an array, processes each text part.
 * If content is a string, extracts images and returns structured content.
 *
 * @param content - The message content (string or array of content parts)
 * @returns Processed content with base64 images extracted
 */
export function processContentForBase64Images(
  content: string | ContentPart[] | undefined | null,
): ContentPart[] {
  if (!content) {
    return [{ type: 'text', text: '' }];
  }

  // If content is a string, extract images
  if (typeof content === 'string') {
    const { content: parts } = extractBase64Images(content);
    return parts;
  }

  // If content is already an array, process each text part
  if (Array.isArray(content)) {
    const result: ContentPart[] = [];

    for (const part of content) {
      if (part.type === 'text' && typeof part.text === 'string') {
        // Extract images from this text part
        const { content: extractedParts } = extractBase64Images(part.text);
        result.push(...extractedParts);
      } else {
        // Keep non-text parts as-is
        result.push(part);
      }
    }

    return result;
  }

  return [{ type: 'text', text: String(content) }];
}
