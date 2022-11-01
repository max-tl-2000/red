/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

const regex = /^\s+/;

/**
 * given an array of lines find the first not empty and return the left padding found
 *
 * @param      {array}  lines   an array of lines
 * @return     {number}  { the padding found or 0 if no lines have padding }
 */
const findLeftPadding = lines => {
  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i];
    if (line.trim()) {
      const result = line.match(regex);
      if (result && result[0].length > 0) {
        return result[0].length;
      }
    }
  }
  return 0;
};

/**
 * Text in markdown blocks are usually indented to maintain the indentation with the overall structure
 * But that indentation causes issues in the formatting of the text. It is even worse if we plan to use
 * that text as an input for a markdown parser because there the indentation actually has meaning.
 *
 * So to avoid this we reduce the padding of the text on the left side. In short it will conver this
 *
 * ```
 *          long text
 *          with some padding on the left
 *            here is another line
 *            with more text here
 * ```
 *
 * to
 *
 * ```
 * long text
 * with some padding on the left
 *   here is another line
 *   with more text here
 * ```
 * @param      {<type>}  text    The text
 * @return     {<type>}  { description_of_the_return_value }
 */
const reduceLeftPad = text => {
  if (!text) {
    return text;
  }
  const lines = text.split('\n');

  if (lines.length === 0) {
    return text;
  }

  const leftPadding = findLeftPadding(lines);
  if (!leftPadding) {
    return text;
  }

  const replacer = new RegExp(`^\\s{1,${leftPadding}}`);

  return lines.map(line => line.replace(replacer, '')).join('\n');
};

export default reduceLeftPad;
