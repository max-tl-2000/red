/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import Dropdown from 'components/Dropdown/Dropdown';
import Field from 'components/Form/Field';
import * as T from 'components/Typography/Typography';
import { DALTypes } from 'enums/DALTypes';
import Block from '../helpers/Block';

const items = Object.keys(DALTypes.ClosePartyReasons).reduce((acc, key) => {
  acc.push({ id: key, text: DALTypes.ClosePartyReasons[key] });
  return acc;
}, []);

class Wrapper extends Component {
  state = {
    value: [],
  };

  handleChange = ({ ids }) => {
    this.setState({ value: ids });
  };

  render() {
    const { value } = this.state;
    return (
      <Block>
        <T.FormattedBlock>
          <T.Title>Dropdown scrolling affordances</T.Title>
        </T.FormattedBlock>
        <Field noMargin>
          <Dropdown wide label="Please select a value" items={items} selectedValue={value} onChange={this.handleChange} />
        </Field>
        <Field noMargin>
          <pre>
            <code>{JSON.stringify(value, null, 2)}</code>
          </pre>
        </Field>
      </Block>
    );
  }
}

storiesOf('Dropdown', module).addWithInfo('Dropdown', 'Simple Dropdown Demo', () => <Wrapper />, {
  propTables: [Dropdown],
});
