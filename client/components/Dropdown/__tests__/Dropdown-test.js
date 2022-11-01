/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { mount } from 'enzyme';
import * as overrider from 'test-helpers/overrider';
import * as globals from '../../../../common/helpers/globals';
import Dropdown from '../Dropdown';

const items = [
  {
    id: 1,
    name: 'Test item',
  },
  {
    id: 2,
    name: 'Test item 2',
  },
  {
    id: 3,
    name: 'Test item 3',
  },
];

const baseProps = {
  textField: 'name',
  valueField: 'id',
  items,
};

describe('Dropdown', () => {
  beforeEach(() => {
    overrider.override(globals, {
      setTimeout: fn => fn(),
    });
  });

  afterEach(() => overrider.restore());
  it('should mount the component without throwing', () => {
    const mountedDropdown = () => mount(<Dropdown {...baseProps} />);
    expect(mountedDropdown).not.toThrow();
  });

  const cssSelectorWhenDropdownIsOpened = '.flyout-container.open';
  const cssSelectorOfDropdownItems = '.list-item';
  const cssSelectorOfDropdownItemsValues = '.text';

  const compareDisplayedValues = (dropdownItems, itemsValues) => {
    const dropdownItemsTextTags = dropdownItems.find(cssSelectorOfDropdownItemsValues);

    // This has to be a regular for because the only way to access the children of dropdownItemsTextTags is with a get()
    for (let i = 0; i < dropdownItemsTextTags.length; i++) {
      const itemValue = dropdownItemsTextTags.get(i).children[0].data;
      expect(itemsValues).toContain(itemValue);
    }
  };

  describe('when showListOnFocus is set to true and the Dropdown is focused', () => {
    it('should display 3 Dropdown items', () => {
      const props = {
        autocomplete: true,
        multiple: true,
        showListOnFocus: true,
      };

      const mountedDropdown = mount(<Dropdown {...baseProps} {...props} />);

      mountedDropdown.setState({ focused: true });
      const renderedDropdown = mountedDropdown.render().children().first();

      expect(renderedDropdown.find(cssSelectorWhenDropdownIsOpened).length).toBe(1);
      expect(renderedDropdown.find(cssSelectorOfDropdownItems).length).toBe(3);
    });
  });

  describe('when showListOnFocus is set to true and the Dropdown is not focused', () => {
    it('should not display any Dropdown items', () => {
      const props = {
        autocomplete: true,
        multiple: true,
        showListOnFocus: true,
      };

      const mountedDropdown = mount(<Dropdown {...baseProps} {...props} />);

      mountedDropdown.setState({ focused: false });
      const renderedDropdown = mountedDropdown.render().children().first();

      expect(renderedDropdown.find(cssSelectorWhenDropdownIsOpened).length).toBe(0);
    });
  });

  describe('when showListOnFocus is set to true, there is one item selected and the Dropdown is focused', () => {
    it('should display 2 Dropdown items', () => {
      const props = {
        autocomplete: true,
        multiple: true,
        showListOnFocus: true,
        selectedValue: 1,
      };

      const itemsValues = [items[1].name, items[2].name];

      const mountedDropdown = mount(<Dropdown {...baseProps} {...props} />);

      mountedDropdown.setState({ focused: true });
      const renderedDropdown = mountedDropdown.render().children().first();

      const dropdownItems = renderedDropdown.find(cssSelectorOfDropdownItems);

      compareDisplayedValues(dropdownItems, itemsValues);
      expect(renderedDropdown.find(cssSelectorWhenDropdownIsOpened).length).toBe(1);
      expect(dropdownItems.length).toBe(itemsValues.length);
    });
  });

  describe('when showListOnFocus is not set or is false, there is none item selected and the Dropdown is focused', () => {
    it('should display 3 Dropdown items', () => {
      const props = {
        autocomplete: true,
        multiple: true,
      };

      const mountedDropdown = mount(<Dropdown {...baseProps} {...props} />);

      mountedDropdown.setState({ focused: true });
      const renderedDropdown = mountedDropdown.render().children().first();

      expect(renderedDropdown.find(cssSelectorWhenDropdownIsOpened).length).toBe(1);
      expect(renderedDropdown.find(cssSelectorOfDropdownItems).length).toBe(3);
    });
  });

  describe('when showListOnFocus is not set or is false, there is none item selected and the Dropdown is not focused', () => {
    it('should display 3 Dropdown items', () => {
      const props = {
        autocomplete: true,
        multiple: true,
      };

      const mountedDropdown = mount(<Dropdown {...baseProps} {...props} />);

      mountedDropdown.setState({ focused: false });
      const renderedDropdown = mountedDropdown.render().children().first();

      expect(renderedDropdown.find(cssSelectorWhenDropdownIsOpened).length).toBe(0);
    });
  });

  describe('when showListOnFocus is not set or is false, there is one item selected and the Dropdown is focused', () => {
    it('should not display the Dropdown items and the items to select should be 0 because the items are being loaded lazily', () => {
      const props = {
        autocomplete: true,
        multiple: true,
        selectedValue: 2,
      };

      const itemsValues = [items[0].name, items[2].name];

      const mountedDropdown = mount(<Dropdown {...baseProps} {...props} />);

      mountedDropdown.setState({ focused: true });
      const renderedDropdown = mountedDropdown.render().children().first();

      const dropdownItems = renderedDropdown.find(cssSelectorOfDropdownItems);

      compareDisplayedValues(dropdownItems, itemsValues);
      expect(renderedDropdown.find(cssSelectorWhenDropdownIsOpened).length).toBe(0);
      expect(dropdownItems.length).toBe(2);
    });
  });
});
