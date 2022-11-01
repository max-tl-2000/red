/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import MoneyTextBox from 'components/MoneyTextBox/MoneyTextBox';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['value', '?Number', '', 'The value of the MoneyTextBox. It must be a number or null'],
  ['moneySign', 'String', '$', 'The sign to show in the TextAffordance property of the underlying TextBox component'],
  [
    'onChange',
    'Function',
    '',
    `

  The callback to be called whenever the value of the TextBox changed.

  \`\`\`

    interface onChangeArgs {
      value: ?Number
    }

    function onChange(args: onChangeArgs):void

  \`\`\`
  `,
  ],
];

export default class MoneyTextBoxDemo extends Component {
  state = {
    val: null,
  };

  render() {
    return (
      <DemoPage title="MoneyTextBox">
        <PropertiesTable data={api} />
        <DemoSection title="MoneyTextBox">
          <MDBlock>
            {`
                A simple component that receive a number (or nullish) and return the changed value as a number or nullish.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <MoneyTextBox value={this.state.val} onChange={({ value }) => this.setState({ val: value })} />
        </DemoSection>
      </DemoPage>
    );
  }
}
