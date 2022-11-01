/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import nullish from 'helpers/nullish';

import { RedTable, CheckBox, IconButton, Radio, Dropdown } from 'components';

import FlyOutAmountEditor from 'components/FlyOutEditors/FlyOutAmountEditor';
import genArr from '../../DemoHelpers/genArr';

const quantityData = genArr(5).map(i => ({ value: i, content: i }));

const { Table, Header, Title, Row, RowHeader, Cell, TextPrimary, Money, RowFooter, GroupTitle, TextSecondary } = RedTable;

@observer
export default class GroupTable extends Component {
  renderRows(group) {
    const { rows, selectionMode, selectedValue } = group;

    return rows.map(row => {
      let checkC;

      if (row.mandatory) {
        checkC = <IconButton iconName="check" />;
      } else if (!selectionMode) {
        checkC = (
          <CheckBox
                   onChange={(selected) => row.selected = selected} // eslint-disable-line
            checked={row.selected}
          />
        );
      } else if (selectionMode === 'singleSelection') {
        checkC = (
          <Radio
            checked={row === selectedValue}
                    onClick={() => group.selectedValue = row} // eslint-disable-line
          />
        );
      }

      return (
        <Row key={row.id} selected={row.selected || row === selectedValue}>
          <Cell width={50} type="ctrlCell">
            {checkC}
          </Cell>
          <Cell>
            <TextPrimary inline>{row.title}</TextPrimary>
            {row.description && <TextSecondary inline>({row.description})</TextSecondary>}
          </Cell>
          <Cell width={100} textAlign="right">
            {!nullish(row.quantity) && !row.mandatory && (
              <Dropdown
                items={quantityData}
                selectedValue={row.quantity}
                positionArgs={{ my: 'right top', at: 'right top' }}
                textField="content"
                styled={false}
                valueField="value"
                onChange={args => {
                  row.quantity = args.item.value;
                }}
              />
            )}
          </Cell>
          <Cell width={120} textAlign="right">
            <FlyOutAmountEditor value={row.amount} max={300} moneySign="$/Month" periodic period={12} onChange={({ value }) => (row.amount = value)} />
          </Cell>
        </Row>
      );
    });
  }

  renderGroups() {
    const { data } = this.props;
    return data.groups.map(group =>
      !group.title ? (
        this.renderRows(group)
      ) : (
        <div key={group.id}>
          <GroupTitle>{group.title}</GroupTitle>
          {this.renderRows(group)}
        </div>
      ),
    );
  }

  render() {
    const { data, headerActions, lblTotalCharges, lblDescriptionTitle, lblTitle } = this.props;

    return (
      <Table>
        <Header key="h1">
          <Title>{lblTitle}</Title>
          {headerActions}
        </Header>
        <RowHeader key="r-1">
          <Cell width={50} type="ctrlCell">
            <CheckBox
                    onChange={(selected) => selected ? data.checkAll() : data.unCheckAll() } // eslint-disable-line
              type="checkAll"
              checked={data.allSelected}
            />
          </Cell>
          <Cell>{lblDescriptionTitle}</Cell>
          <Cell width={100} textAlign="right">
            Quantity
          </Cell>
          <Cell width={120} textAlign="right">
            Amount
          </Cell>
        </RowHeader>
        {this.renderGroups()}
        <RowFooter key="footer">
          <Cell type="ctrlCell" />
          <Cell>
            <TextPrimary>{lblTotalCharges}</TextPrimary>
          </Cell>
          <Cell textAlign="right" />
          <Cell textAlign="right">
            <Money amount={data.subTotal} />
          </Cell>
        </RowFooter>
      </Table>
    );
  }
}
