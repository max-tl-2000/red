/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createElement } from 'react';
import trim from 'helpers/trim';
import Text from '../components/Typography/Text';

// split by space, -, (, )
const getHighlightTokens = query =>
  query
    .map(q =>
      trim(q)
        .toLowerCase()
        .split(/\s+|-|\(|\)/)
        .filter(c => c.trim()),
    )
    .reduce((splits, tokens) => {
      tokens.forEach(token => splits.add(token));
      return splits;
    }, new Set());

// add match to set if not existing or matched word length bigger than existing
const addMatch = (acc, { indexMatch, wordLength, minMatchLength } = {}) => {
  if (indexMatch >= 0 && wordLength >= minMatchLength) {
    acc.push([indexMatch, wordLength]);
  }
};

// tokenize the word to be highlighted
const getAllMatchingIntervals = ({ textToTokenize, tokens, minMatchLength } = {}) =>
  [...tokens].reduce((acc, queryPart) => {
    let matcher = queryPart;
    let wordLength = queryPart.length;
    let indexMatch = 0;
    // check if multiple matches for the same matcher
    while (indexMatch >= 0 && wordLength >= minMatchLength) {
      indexMatch = textToTokenize.indexOf(matcher, indexMatch);
      if (indexMatch >= 0) {
        addMatch(acc, { indexMatch, wordLength, minMatchLength });
        indexMatch += 1;
      } else {
        // try with a smaller matcher
        while (indexMatch === -1 && wordLength >= minMatchLength) {
          // match at least 3 characters
          wordLength -= 1;
          matcher = queryPart.substr(0, wordLength);
          indexMatch = textToTokenize.indexOf(matcher);
        }
        addMatch(acc, { indexMatch, wordLength, minMatchLength });
      }
    }

    return acc;
  }, []);

// merge intersecting intervals
const mergeIntervals = (intervals = []) =>
  intervals.reduce((acc, [index, length]) => {
    if (acc.length > 0) {
      const [lastIndex, lastLength] = acc[acc.length - 1];
      if (index > lastIndex + lastLength) {
        acc.push([index, length]);
        return acc;
      }

      if (index >= lastIndex && index <= lastIndex + lastLength && index + length > lastIndex + lastLength) {
        acc.pop();
        acc.push([lastIndex, index + length - lastIndex]);
        return acc;
      }
    } else {
      acc.push([index, length]);
    }
    return acc;
  }, []);

export const getHighlightSegments = (text, query, minMatchLength = 3) => {
  text = trim(text); // ensure text is a string

  const textToTokenize = text.toLowerCase();
  const tokens = getHighlightTokens(query);

  // tokenize the word to be highlighted
  const matchingIntervals = getAllMatchingIntervals({ textToTokenize, tokens: [...tokens], minMatchLength });

  // sort all matches by index in the string
  const intervals = Array.from(matchingIntervals).sort(([startIndex1, _wordLength1], [startIndex2, _wordLength2]) => startIndex1 - startIndex2);

  // merge intervals
  const mergedIntervals = mergeIntervals(intervals);
  return mergedIntervals;
};

export const _highlightMatches = (
  text,
  _query,
  { Component = Text, minMatchLength, innerProps, inline = true, highlight = true, ...props } = {},
  exactMatch = false,
) => {
  if (!_query || _query.length === 0) {
    return createElement(Component, props, text);
  }
  const query = Array.isArray(_query) ? _query : [_query];

  if (exactMatch) {
    if (query.find(q => q === text)) {
      return createElement(Component, { ...props, inline, highlight }, text);
    }
    return createElement(Component, props, text);
  }

  const mergedIntervals = getHighlightSegments(text, query, minMatchLength);

  let firstIndex = 0;
  // render highlights based on found matches
  const result = mergedIntervals.reduce((acc, [indexMatch, wordLength]) => {
    const lastIndex = indexMatch + wordLength;
    const firstPart = text.substring(firstIndex, indexMatch);
    const currentPart = text.substring(indexMatch, lastIndex);
    acc.push(firstPart);
    acc.push(
      createElement(
        Component,
        {
          key: `${currentPart}_${firstIndex}`,
          inline: true,
          highlight: true,
          ...innerProps,
        },
        currentPart,
      ),
    );
    firstIndex = lastIndex;
    return acc;
  }, []);

  result.push(text.substr(firstIndex));
  return createElement(Component, props, result);
};
