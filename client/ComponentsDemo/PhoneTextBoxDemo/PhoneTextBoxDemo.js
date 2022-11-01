/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { observer } from 'mobx-react';
import { createModel } from 'helpers/Form/FormModel';
import { validatePhone } from 'helpers/phone-utils';
import { t } from 'i18next';

import clsc from 'helpers/coalescy';
import { PhoneTextBox, Typography, Form, FormActions, Button } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const { Text, TextHeavy } = Typography;

const api = [
  [
    'value',
    'string',
    '',
    `
  The phone value. It must be a phone number starting with \`+\`.

  The phone will be displayed formatted as close to possible to the way
  used in the country where the phone belongs to.`,
  ],
  [
    'onChange',
    'function',
    '',
    `
  Fired when the phone number changes. It actually fires on blur, not
  after every change, this is by design, for performance reasons.

  **Method Signature**: \`function onChange({ value: String, displayValue }) => void\`

  - **value**: The new value after the change spaces and other not valid phone characters are removed
    For example if the number is \`+1 408 480 9389\` the value will be \`+14084809389\`
  - **displayValue**: The value shown in the PhoneTextBox, formatted as close as possible to the
    way the numbers are formatted in the country where this number belongs to. For example
    if the number is \`+1 408 4809389\` the displayValue will be \`(408) 480-9389\` without the
    country dial code.
  `,
  ],
];

@observer
export default class PhoneTextBoxDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.state = {
      phone: '+5115280353',
    };

    this.model = createModel(
      {
        phone: '+14084809389',
      },
      {
        phone: {
          fn: field => {
            const result = validatePhone(field.value);

            if (!result.valid) {
              return { error: t(result.reason) };
            }
            return true;
          },
        },
      },
    );
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);

    const { phone } = this.model.fields;

    return (
      <DemoPage id={theId} title="PhoneTextBox">
        <DemoSection title="Description">
          <MDBlock>
            {`
                  The PhoneTextBox can be used to display phone numbers. It internally uses libphone number to do the validation
                  of the phone numbers and also format the display value when the texbox is blurred.
                `}
          </MDBlock>
          <PropertiesTable data={api} />
          <PrettyPrint>
            {`
                  <PhoneTextBox label="Phone Demo"
                    value={ this.state.phone }
                    onChange={ ({ value }) =>
                      this.setState({ phone: value }) } />
                  <div>
                    <TextHeavy inline>phone value:</TextHeavy>
                    <Text inline>{ this.state.phone }</Text>
                  </div>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <PhoneTextBox label="Phone Demo" value={this.state.phone} onChange={({ value }) => this.setState({ phone: value })} />
          <div>
            <TextHeavy inline>phone value:</TextHeavy>
            <Text inline>{this.state.phone}</Text>
          </div>
        </DemoSection>

        <DemoSection title="Validation example">
          <MDBlock>
            {`
                  A custom function to validate phone numbers is also available this can be used
                  with the form helper to manage the validators.
                `}
          </MDBlock>

          <PrettyPrint>
            {`
                  import { createModel } from 'helpers/Form/FormModel';
                  import { validatePhone } from 'helpers/phone-utils';
                  import { t } from 'i18next';

                 /* ================================= */

                  this.model = createModel({ phone: '+14084809389' }, {
                    phone: {
                      fn: (field) => {
                        const result = validatePhone(field.value);
                        if (!result.valid) {
                          return { error: t(result.reason) };
                        }
                        return true;
                      },
                    },
                  });

                 /* ================================= */
                 <Form title="Demo Form">
                   <PhoneTextBox label="Phone Demo"
                      value={ phone.value }
                      errorMessage={ phone.errorMessage }
                      onChange={ ({ value }) => this.model.updateField('phone', value) } />
                   <FormActions>
                     <Button disabled={ !this.model.valid || !this.model.interacted } label="Do something" />
                   </FormActions>
                 </Form>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Form title="Demo Form">
            <PhoneTextBox
              label="Phone Demo"
              value={phone.value}
              errorMessage={phone.errorMessage}
              onChange={({ value }) => this.model.updateField('phone', value)}
            />
            <FormActions>
              <Button disabled={!this.model.valid || !this.model.interacted} label="Do something" />
            </FormActions>
          </Form>
        </DemoSection>
      </DemoPage>
    );
  }
}
