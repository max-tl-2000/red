/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import FilterToolbar from 'components/FilterToolbar/FilterToolbar';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['className', 'String', '', 'The className of the component'],
  [
    'items',
    'Array',
    '',
    `
  An array of items to render as tabs, they follow the following interface: FilterToolbarDemo.js
  \`\`\`
  interface FilterItem {
    id: String, // or Number
    text: String, // The text for this tab option
  }
  \`\`\`

  the \`id\` will be used to identify which option is currently selected.
  `,
  ],
  ['textPlaceholder', 'String', '', 'The placeholder for the TextBox in the FilterToolbar in text mode'],
  ['textValue', 'String', '', 'The value of the TextBox in the FilterToolbar in text mode'],
  ['textIconName', 'String', 'magnify', 'The icon to use for the TextBox affordance and to switch to `text` mode'],
  ['filterIconName', 'String', 'filter-variant', 'The icon to use to switch to the `filters` mode'],
  ['selectedItem', 'Array', '', 'The ids of the selected items. Used to set the current selected items in the component'],
  ['onTextChange', 'Function', '', 'The callback to be fired when the TextBox value changes'],
  ['onSelectionChange', 'Function', '', 'The callback to be fired when the SelectionGroup selectedValue prop changes'],
  ['multiple', 'Boolean', '', 'A flag to determine if only one option can be selected at a time or multiple ones can be selected'],
];

export default class FilterToolbarDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      textValue: 'Hello world',
      selectedItem: null,
      items: [
        { id: 1, text: 'Tab 1' },
        { id: 2, text: 'Tab 2' },
        { id: 3, text: 'Tab 3' },
      ],
    };
  }

  updateSelectedItems(ids) {
    this.setState({ selectedItem: ids });
  }

  updateText(value) {
    this.setState({ textValue: value });
  }

  render() {
    const { textValue, selectedItem, items } = this.state;

    return (
      <DemoPage title="FilterToolbar">
        <PropertiesTable data={api} />
        <DemoSection title="How I render a FilterToolbar with single selection filters?">
          <MDBlock>
            {`
                  A FilterToolbar is a molecule that is made from 2 components, a \`TextBox\` and a \`SelectionGroup\`.

                  The \`TextBox\` can be used to enter some text value, when this value change the \`onTextChange\` event is raised.
                  The \`SelectionGroup\` can be used to render a list of options that can be selected. By default only one option
                  can be selected at a time, if more than one option can be selected pass the \`multiple\` flag. When the selection
                  changes the \`onSelectionChange\` will be raised. The current selected option can be set with the \`selectedItem\` prop
                  and the items to render the options can be provided using the \`items\` prop.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <FilterToolbar items={ items }
                              textPlaceholder="Find a unit"
                              textValue={ textValue }
                              textIconName="magnify"
                              filterIconName="filter-variant"
                              selectedItem={ selectedItem }
                              onSelectionChange={ ({ ids }) => this.updateSelectedItems(ids) }
                              onTextChange={ ({ value }) => this.updateText(value) } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <FilterToolbar
            items={items}
            textPlaceholder="Find a unit"
            textValue={textValue}
            textIconName="magnify"
            filterIconName="filter-variant"
            selectedItem={selectedItem}
            onSelectionChange={({ ids }) => this.updateSelectedItems(ids)}
            onTextChange={({ value }) => this.updateText(value)}
          />
          <SubHeader>State</SubHeader>
          <div>
            <pre>
              <code>
                textValue: {JSON.stringify(textValue)}
                <br />
                selectedItem: {JSON.stringify(selectedItem)}
              </code>
            </pre>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}
