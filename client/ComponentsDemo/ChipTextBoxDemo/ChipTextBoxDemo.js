/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { ChipTextBox } from 'components';
import { DemoPage, PropertiesTable, DemoSection, MDBlock, SubHeader, PrettyPrint } from '../DemoElements';

const API = [
  ['label', 'String', '', 'Label of the control'],
  ['placeholder', 'String', '', 'Placeholder of the control'],
  ['value', 'Array', '', 'Value of the control'],
  ['validator', 'Func or Regex', '', 'Function validates when an item is valid or Regex expression'],
  ['addItemKeyCodes', 'Array', '', 'Array with the keycodes to add an item. By default you can add Items with the keys ENTER, TAB, or COMMA'],
  ['onChange', 'Func', '', 'Triggerd when the value of the control change'],
  ['maxNumItems', 'Number', '', 'Set maximum number of items'],
];

const DEFAULT_VALUE = [
  { id: 1, text: 'aaaaa' },
  { id: 2, text: 'bbb' },
  { id: 3, text: 'aaaaa' },
];

const EMAIL_VALUE = [
  { id: 1, text: 'mail1@gmail.com' },
  { id: 2, text: 'mail2@outlook.io' },
  { id: 3, text: 'mail4@custom.net' },
];

const SPACE = 32;
const CUSTOM_KEY_CODES = [SPACE];

const EMAIL_REGEX = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;
const CUSTOM_VALIDATOR = text => text.length === 3;
const ON_CHANGE = ({ value }) => console.log({ value });

const ChipTextBoxDemo = () => (
  <DemoPage title="ChipTextBox">
    <PropertiesTable data={API} />
    <DemoSection title="Empty chipTextBox">
      <MDBlock>
        {`
        Empty chipTextBox
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <ChipTextBox />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox />
    </DemoSection>
    <DemoSection title="ChipTextBox with label">
      <MDBlock>
        {`
        ChipTextBox with label
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <ChipTextBox label="Label"/>
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox label="Label" />
    </DemoSection>
    <DemoSection title="ChipTextBox label + placeholder">
      <MDBlock>
        {`
        ChipTextBox with label and placeholder
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <ChipTextBox label="Label" placeholder="placeholder" />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox label="Label" placeholder="placeholder" />
    </DemoSection>
    <DemoSection title="ChipTextBox with error message">
      <MDBlock>
        {`
        ChipTextBox with error message. (Error message passed as props )
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <ChipTextBox errorMessage="error message" />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox errorMessage="error message" />
    </DemoSection>
    <DemoSection title="ChipTextBox with value">
      <MDBlock>
        {`
        Set initial value for ChipTextBox
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <ChipTextBox value={ DEFAULT_VALUE } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox value={DEFAULT_VALUE} />
    </DemoSection>
    <DemoSection title="ChipTextBox with regex validator">
      <MDBlock>
        {`
        Set a regex as validator for items in the ChipTextBox
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        const EMAIL_REGEX = /^\\w+@[a-zA-Z_]+?\\.[a-zA-Z]{2,3}$/;

        <ChipTextBox value={ EMAIL_VALUE } validator={ EMAIL_REGEX } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox value={EMAIL_VALUE} validator={EMAIL_REGEX} />
    </DemoSection>
    <DemoSection title="ChipTextBox custom validator">
      <MDBlock>
        {`
        Set a function as a custom validator
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        const CUSTOM_VALIDATOR = text => text.length === 3;

        <ChipTextBox validator={ CUSTOM_VALIDATOR } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox validator={CUSTOM_VALIDATOR} />
    </DemoSection>
    <DemoSection title="ChipTextBox add items with custom keycodes">
      <MDBlock>
        {`
        Set custom key codes to add items
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        const CUSTOM_KEY_CODES = [
          SPACE,
        ];
        <ChipTextBox addItemKeyCodes={ CUSTOM_KEY_CODES } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox addItemKeyCodes={CUSTOM_KEY_CODES} />
    </DemoSection>
    <DemoSection title="ChipTextBox onChange event">
      <MDBlock>
        {`
        Event triggers when the value of the control change
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
          const ON_CHANGE = ({ value }) =>  console.log({ value });
          <ChipTextBox value={ DEFAULT_VALUE } onChange={ ON_CHANGE } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox value={DEFAULT_VALUE} onChange={ON_CHANGE} />
    </DemoSection>
    <DemoSection title="ChipTextBox maxNumItems">
      <MDBlock>
        {`
        Set maximum number of items
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
          <ChipTextBox maxNumItems={ 2 } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <ChipTextBox maxNumItems={2} />
    </DemoSection>
  </DemoPage>
);

export default ChipTextBoxDemo;
