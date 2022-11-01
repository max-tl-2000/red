/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import { mountToJson } from 'enzyme-to-json';
import { renderStringWithMatch } from '../string-matcher';

describe('renderStringWithMatch', () => {
  describe('when a null value is provided', () => {
    it('should render the list and not throw', () => {
      const props = {
        value: null,
        className: 'myClass',
        bold: true,
        inline: false,
        ellipsis: false,
        searchQueryValue: 'Some value',
        id: '1',
      };

      const mountPoint = mount(<div>{renderStringWithMatch(props)}</div>);
      expect(mountToJson(mountPoint)).toMatchSnapshot();
    });
  });

  describe('when a non null value is provided and a searchQueryValue is provided', () => {
    it('should highlight the matches', () => {
      const props = {
        value: 'Peter Parker',
        className: 'myClass',
        bold: true,
        inline: false,
        ellipsis: false,
        searchQueryValue: 'Pet',
        id: '1',
      };

      const mountPoint = mount(<div>{renderStringWithMatch(props)}</div>);
      expect(mountToJson(mountPoint)).toMatchSnapshot();
    });
  });

  describe('when searchQuery is not found in value', () => {
    it('should render the string without highlight matches', () => {
      const props = {
        value: 'Bruce wayne',
        className: 'myClass',
        bold: true,
        inline: false,
        ellipsis: false,
        searchQueryValue: 'Pet',
        id: '1',
      };

      const mountPoint = mount(<div>{renderStringWithMatch(props)}</div>);
      expect(mountToJson(mountPoint)).toMatchSnapshot();
    });
  });
});
