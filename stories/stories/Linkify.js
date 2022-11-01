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
import Linkify from 'components/Linkify/Linkify';
import * as T from 'components/Typography/Typography';
import Block from '../helpers/Block';

class Wrapper extends Component {
  state = {
    value: 'abc',
  };

  handleChange = ({ value }) => {
    const div = document.createElement('div');
    div.innerHTML = value;
    const textContent = div.textContent;

    this.setState({ value: textContent });
  };

  render() {
    const { value } = this.state;

    return (
      <Block>
        <T.FormattedBlock>
          <T.Title>Linkify</T.Title>
        </T.FormattedBlock>
        <Field noMargin>
          <TextBox multiline wide value={value} onChange={this.handleChange} />
        </Field>
        <Field noMargin>
          <Linkify>{value}</Linkify>
        </Field>
      </Block>
    );
  }
}

storiesOf('Linkify', module).addWithInfo('apply linkify to a div', 'Linkify demo', () => <Wrapper />, {
  propTables: [Linkify],
});
