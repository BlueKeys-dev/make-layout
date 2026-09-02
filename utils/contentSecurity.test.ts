import assert from 'node:assert/strict';
import test from 'node:test';
import { isUnsafeSvgAttribute } from './contentSecurity';

test('rejects unsafe attributes shared by SVG and foreignObject content', () => {
  assert.equal(isUnsafeSvgAttribute('onclick', 'run()'), true);
  assert.equal(isUnsafeSvgAttribute('href', 'https://example.com'), true);
  assert.equal(isUnsafeSvgAttribute('style', 'width: expression(run())'), true);
  assert.equal(isUnsafeSvgAttribute('style', 'background: url(https://example.com/image.png)'), true);
});

test('keeps safe presentation attributes and fragment references', () => {
  assert.equal(isUnsafeSvgAttribute('class', 'node-label'), false);
  assert.equal(isUnsafeSvgAttribute('style', 'color: #111827'), false);
  assert.equal(isUnsafeSvgAttribute('fill', 'url(#gradient)'), false);
  assert.equal(isUnsafeSvgAttribute('href', '#node-1'), false);
});
