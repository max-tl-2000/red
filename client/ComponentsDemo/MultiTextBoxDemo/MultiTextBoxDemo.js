/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';
import MultiTextBox from '../../components/MultiTextBox/MultiTextBox';

import Button from '../../components/Button/Button';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['className', 'String', '', 'The className of the component'],
  ['label', 'String', '', 'The label for the component as a whole'],
  [
    'values',
    'Array<IMultiTextItem>',
    '[]',
    `
  The values for each TextBox component. It is an object like:

  \`\`\`
  interface IMultiTextItem {
     id: Guid, // unique identifier for the item
     value: String
   }
  \`\`\`
  `,
  ],
  ['itemLabel', 'String', '', 'The value of the label to be used per each one of the TextBox components'],
  ['itemPlaceholder', 'String', '', 'The placeholder to show on each field'],
  ['itemValidation', 'Function', '', 'The validation function to be executed on each TextBox instance'],
  ['defaultError', 'String', '', 'Default error to show if validation does not return an error object or an object with an error key'],
  ['errorMessage', 'String', '', 'The error message for the overall component'],
  ['onChange', 'Function', '', 'The callback to be called whenever a value in the MultiTextBox component changes'],
  ['raiseChangeThreshold', 'Number', '', 'The threshold to fire the `onChange` Event'],
];

export default class MultiTextBoxDemo extends Component {
  constructor(props) {
    super(props);

    this.state = {
      phones: [
        { id: 1, value: '+13223421232' },
        { id: 2, value: '+121323123121' },
      ],
    };
  }

  updatePhones = ({ phones }) => {
    this.setState({ phones });
  };

  removeEmpty = async () => {
    await this.multitxt.validate();

    if (!this.multitxt.valid) return;

    const nonEmpty = this.multitxt.nonEmptyValues;

    // update the component
    // IMPORTANT: This cannot be done using props, because props changes are ignored
    // during render the prop values are only used during the construction of the component
    // This is to avoid circular updates.
    this.multitxt.values = nonEmpty;

    // update the values in the state
    this.setState({ phones: nonEmpty });
  };

  render() {
    return (
      <DemoPage title="MultiTextBox">
        <PropertiesTable data={api} />
        <DemoSection title="How to render a MultiTextBox component?">
          <MDBlock>
            {`
                  A MultiTextBox component can be used to render a list of fields
                  that share the same type. The value
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                    <MultiTextBox ref={ ref => (this.multitxt = ref) }
                      label="Phones"
                      values={ this.state.phones }
                      itemValidation={ text => !!text }
                      onChange={ ({ values }) => this.updatePhones({ phones: values })  }
                      itemPlaceholder="Enter your phone"
                      defaultError="Please enter a valid phone" />
                    <Button label="Save" onClick={ this.removeEmpty } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <MultiTextBox
            ref={ref => (this.multitxt = ref)}
            label="Phones"
            values={this.state.phones}
            itemValidation={text => !!text}
            onChange={({ values }) => this.updatePhones({ phones: values })}
            itemPlaceholder="Enter your phone"
            defaultError="Please enter a valid phone"
          />
          <Button label="Save" onClick={this.removeEmpty} />
          <SubHeader>State</SubHeader>
          <pre>
            <code>{JSON.stringify(this.state.phones, null, 2)}</code>
          </pre>
        </DemoSection>
      </DemoPage>
    );
  }
}
