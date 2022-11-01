/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { render } from 'react-dom';
import { expect, getSandBoxDiv } from 'test-helpers';
import $ from 'jquery';
import { _highlightMatches, getHighlightSegments } from '../highlightMatches';

const validateElementContent = (element, content) => expect($(element).text()).to.equal(content);

const validateElementClass = (element, className) => expect($(element).attr('class')).to.contain(className);

describe('Highlight matching elements', () => {
  describe('when the query is not provided', () => {
    it('should return a Text element with the provided info', () => {
      const textValue = 'Random text value';
      const element = _highlightMatches(textValue);
      const sandBoxDiv = getSandBoxDiv();
      render(element, sandBoxDiv);
      expect($('[data-component="text"]').text()).to.equal(textValue);
      expect($('[data-component="text"]').children().length).to.equal(0);
    });
  });

  describe('when the query is provided but it does not match', () => {
    it('should return a Text element with a span element inside that matches the text value', () => {
      const textValue = 'Random text value';
      const query = 'wyz';
      const element = _highlightMatches(textValue, query);

      const sandBoxDiv = getSandBoxDiv();
      render(element, sandBoxDiv);

      const $textEle = $(sandBoxDiv).find('[data-component="text"]');

      expect($textEle.text()).to.equal(textValue);
      // const spanChildren = $(sandBoxDiv).find('[data-component="text"]').children();
      // expect(spanChildren.length).to.equal(1);
      // validateElementContent(spanChildren.get(0), textValue);
    });
  });

  describe('when the query is provided and it does match', () => {
    it('should return a Text element with children spans that highlight the match', () => {
      const textValue = 'Random text value';
      const query = 'dom';
      const element = _highlightMatches(textValue, query);
      const highlightClassName = 'highlight';

      const sandBoxDiv = getSandBoxDiv();
      render(element, sandBoxDiv);

      const $span = $(sandBoxDiv).find('span[data-component="text"]');
      expect($span.length).to.equal(1);
      validateElementContent($span, 'dom');
      validateElementClass($span, highlightClassName);
    });
  });

  describe('when the query is provided and it matches multiple times', () => {
    it('should return the highlighted segments', () => {
      const textValue = '(800) 800-1111';
      const query = ['(801) 800-2222'];
      const segments = getHighlightSegments(textValue, query);
      expect(segments).to.deep.equal([
        [1, 3],
        [6, 3],
      ]);
    });

    it('should return a Text element with children spans that highlight the match', () => {
      const textValue = '(800) 800-1111';
      const query = ['(801) 800-2222'];
      const element = _highlightMatches(textValue, query);
      const highlightClassName = 'highlight';

      const sandBoxDiv = getSandBoxDiv();
      render(element, sandBoxDiv);

      const $span = $(sandBoxDiv).find('span[data-component="text"]');
      expect($span.length).to.equal(2);
      validateElementContent($span, '800800');
      validateElementClass($span, highlightClassName);
    });
  });

  describe('when the query is provided and exactMatch option is enabled', () => {
    it('should match exactMatches', () => {
      const textValue = '(800) 800-1111';
      const query = ['(801) 820-4444', textValue, '(900) 909-3453'];
      const element = _highlightMatches(textValue, query, {}, true);
      const highlightClassName = 'highlight';

      const sandBoxDiv = getSandBoxDiv();
      render(element, sandBoxDiv);

      const $span = $(sandBoxDiv).find('span[data-component="text"]');
      expect($span.length).to.equal(1);
      validateElementContent($span, textValue);
      validateElementClass($span, highlightClassName);
    });

    it('should not match partial matches', () => {
      const textValue = '(800) 800-1111';
      const query = ['(801) 800-4444', '(800) 909-1111'];
      const element = _highlightMatches(textValue, query, {}, true);

      const sandBoxDiv = getSandBoxDiv();
      render(element, sandBoxDiv);

      const $span = $(sandBoxDiv).find('span[data-component="text"]');
      expect($span.length).to.equal(0);
    });
  });
});
