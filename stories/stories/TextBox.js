/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import TextBox from 'components/TextBox/TextBox';
import Field from 'components/Form/Field';
import * as T from 'components/Typography/Typography';
import Block from '../helpers/Block';

class Wrapper extends Component {
  state = {
    value: 'abc',
  };

  handleChange = ({ value }) => {
    this.setState({ value });
  };

  render() {
    const { value } = this.state;
    return (
      <Block>
        <T.FormattedBlock>
          <T.Title>Auto trim value</T.Title>
          <T.Text>The following is an example of a controlled textbox that will autotrim the value of the textbox on blur</T.Text>
          <T.Text>To make the spaces visible we're replacing the values by `*` during render</T.Text>
          <T.Text>Verify that when you blur the field the textbox is trimmed at the beginning and at the end</T.Text>
        </T.FormattedBlock>
        <Field noMargin>
          <TextBox value={value} onChange={this.handleChange} />
        </Field>
        <Field noMargin>
          <T.Text>Value: {value.replace(/\s/g, '*')}</T.Text>
        </Field>
      </Block>
    );
  }
}

storiesOf('TextBox', module).addWithInfo('TextBox', 'Simple TextBox Demo', () => <Wrapper />, {
  propTables: [TextBox],
});
