/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import { observer } from 'mobx-react';
import { DALTypes } from 'enums/DALTypes';
import FilterableList from '../../client/components/Filterable/FilterableList';
import * as T from '../../client/components/Typography/Typography';

const dummyItems = Object.keys(DALTypes.ClosePartyReasons).reduce((acc, key) => {
  acc.push({ id: key, text: DALTypes.ClosePartyReasons[key] });
  return acc;
}, []);

@observer
class Wrapper extends Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  doOnItemSelect = (item, args = {}) => {
    console.log(item);
    // prevent the selection of the item that match this id
    args.cancel = item.id === 'NO_LONGER_MOVING';
  };

  handleOnChange = selected => {
    this.setState({ selectedIds: selected.ids });
  };

  render() {
    const { selectedIds } = this.state;
    return (
      <div style={{ padding: '20px 25px' }}>
        <T.FormattedBlock>
          <T.Text>{`The following is an example of the FilterableList. This component presents to the end user a list of options which can
            be selected. The selection can be prevented by setting \`args.cancel=true\` on the \`onItemSelect(item, args)\` handler`}</T.Text>
          <T.Text>{'In this example you cannot select `CLOSE_PARTY_REASON_NO_LONGER_MOVING`'}</T.Text>
        </T.FormattedBlock>
        <FilterableList items={dummyItems} selectedIds={selectedIds} onItemSelect={this.doOnItemSelect} onChange={this.handleOnChange} />
        <pre>
          <code>{JSON.stringify(selectedIds, null, 2)}</code>
        </pre>
      </div>
    );
  }
}

storiesOf('FilterableList', module).addWithInfo('FilterableList', 'Simple Filterable List', () => <Wrapper />);
