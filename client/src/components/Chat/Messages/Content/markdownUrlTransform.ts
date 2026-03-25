import { defaultUrlTransform } from 'react-markdown';
import type { UrlTransform } from 'react-markdown';

const DATA_IMAGE_PREFIX = 'data:image/';

export const markdownUrlTransform: UrlTransform = (url, key, node) => {
  const trimmedUrl = url.trim();

  if (
    key === 'src' &&
    node.tagName === 'img' &&
    trimmedUrl.toLowerCase().startsWith(DATA_IMAGE_PREFIX)
  ) {
    return trimmedUrl;
  }

  return defaultUrlTransform(trimmedUrl);
};
