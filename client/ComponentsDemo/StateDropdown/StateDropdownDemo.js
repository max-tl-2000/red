/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import StateDropdown from 'custom-components/StateDropdown/StateDropdown';
import { Field } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';

export default class StateDropdownDemo extends Component { // eslint-disable-line
  render() {
    return (
      <DemoPage title="State Dropdown">
        <DemoSection title="A very simple State selector">
          <MDBlock>
            {`
                Use this custom components to display a list of States and let the user select one.

                The state list contains objects like
                \`\`\`
                interface IStateElement {
                  text: String, // the stateName
                  id: String, // short state identifier (like CA, NW, etc)
                }
                \`\`\`

                A simple pattern matching has been implemented here, the lookup is done from the start of the text and id
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <Field columns={ 6 }><StateDropdown /></Field>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>

          <Field columns={6}>
            <StateDropdown />
          </Field>
        </DemoSection>
      </DemoPage>
    );
  }
}
