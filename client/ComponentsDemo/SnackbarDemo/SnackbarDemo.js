/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import snackbar from 'helpers/snackbar/snackbar';
import TextBox from 'components/TextBox/TextBox';
import Button from 'components/Button/Button';
import Form from 'components/Form/Form';
import Field from 'components/Form/Field';
import FormActions from 'components/Form/FormActions';

import { createModel } from 'helpers/Form/FormModel';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['text', 'String', '', 'The text to be shown in the snackbar message'],
  [
    'buttonLabel',
    'String',
    '',
    'The label for the button that will be shown at the right. If the buttonLabel is not provided no button will be rendered at all',
  ],
  ['duration', 'Number', '', 'The time in milliseconds the message will be displayed until automatically hide'],
  [
    'onButtonClick',
    'Function',
    '',
    'A callback to be invoked when the button is clicked. By default after clicking the button the snack message will be hidden',
  ],
];

export default class MyComponent extends Component { // eslint-disable-line
  constructor(props, context) {
    super(props, context);
    const model = createModel({
      text: 'A short and nice snack message',
      duration: 5000,
      buttonLabel: 'Launch',
    });

    this.state = {
      model,
    };
  }

  showSnack = () => {
    const { model } = this.state;
    snackbar.show({
      ...model.serializedData,
      onButtonClick: () => console.log('button clicked!'),
    });
  };

  renderField(label, field) {
    return (
      <Field columns={8}>
        <TextBox wide label={label} value={field.value} onChange={({ value }) => field.setValue(value)} />
      </Field>
    );
  }

  render() {
    const { model } = this.state;
    const { fields } = model;
    const { text, buttonLabel, duration } = fields;

    return (
      <DemoPage title="Snackbar">
        <PropertiesTable data={api} />
        <DemoSection title="Snackbar">
          <MDBlock>
            {`
                    A snackbar is a small toast message that can be used to provide some feedback to the user about some action

                    It is by nature very small and should not contain tons of text. The component will truncate the text with a fade
                    effect in case the text is bigger than the container.

                    Use the form shown below to play with the different properties of the snackbar helper
                `}
          </MDBlock>
          <PrettyPrint className="javascript">
            {`
                    import snackbar from 'helpers/snackbar/snackbar';
                    snackbar.show({ text: 'The Text', buttonLabel: 'Go', onButtonClick: () => console.log('do something here!') });
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Form>
            {this.renderField('Text', text)}
            {this.renderField('Button', buttonLabel)}
            {this.renderField('Duration', duration)}
            <FormActions>
              <Button label="Snack time!" onClick={this.showSnack} />
            </FormActions>
          </Form>
        </DemoSection>
      </DemoPage>
    );
  }
}
