/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import TextBox from 'components/TextBox/TextBox';
import Dropdown from 'components/Dropdown/Dropdown';
import MsgBox from 'components/MsgBox/MsgBox';
import Button from 'components/Button/Button';
import Field from 'components/Form/Field';
import * as T from 'components/Typography/Typography';
import Block from '../helpers/Block';
import DateSelector from '../../client/components/DateSelector/DateSelector';

class Wrapper extends Component { // eslint-disable-line
  state = {};

  render() {
    return (
      <Block>
        <T.FormattedBlock>
          <T.Title>Alignments between form elements</T.Title>
        </T.FormattedBlock>
        <Field columns={3} inline>
          <TextBox wide label="Some label" />
        </Field>
        <Field columns={4} inline>
          <Dropdown
            wide
            label="Pick a value"
            items={[
              { id: 1, text: 'some nice text' },
              { id: 2, text: 'demo of something else' },
            ]}
          />
        </Field>
        <Field inline columns={3} last>
          <DateSelector wide label="Select a date" />
        </Field>
        <T.FormattedBlock>
          <T.Title>Alignments between form elements</T.Title>
        </T.FormattedBlock>
        <Field>
          <T.Text>DateSelector that shows completely (using `appendToBody` option)</T.Text>
          <MsgBox
            open={this.state.dialogOpen2}
            title="Pick a date"
            onCloseRequest={() => this.setState({ dialogOpen2: false })}
            lblOK="Use the date"
            lblCancel="No, Thanks!">
            <Field>
              <DateSelector appendToBody label="click to pick a date" />
            </Field>
          </MsgBox>
          <Button label="Open Dialog to pick a date" onClick={() => this.setState({ dialogOpen2: true })} />
        </Field>
      </Block>
    );
  }
}

storiesOf('Form Elements', module).addWithInfo('Form Elements alignment', 'Form elements alignment', () => <Wrapper />, {
  propTables: [TextBox, DateSelector, Dropdown],
});
