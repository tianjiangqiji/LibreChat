import type { Element } from 'hast';
import { markdownUrlTransform } from '../markdownUrlTransform';

const createImageNode = (): Element => ({
  type: 'element',
  tagName: 'img',
  properties: {},
  children: [],
});

describe('markdownUrlTransform', () => {
  it('preserves base64 data images for markdown image nodes', () => {
    const url = 'data:image/png;base64,abc123==';

    expect(markdownUrlTransform(url, 'src', createImageNode())).toBe(url);
  });

  it('continues to reject non-image data URLs', () => {
    expect(markdownUrlTransform('data:text/html;base64,abc123==', 'src', createImageNode())).toBe(
      '',
    );
  });

  it('continues to reject javascript URLs', () => {
    expect(markdownUrlTransform('javascript:alert(1)', 'src', createImageNode())).toBe('');
  });
});
