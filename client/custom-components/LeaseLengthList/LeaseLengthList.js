/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { ICON_CELL_WIDTH } from 'helpers/tableConstants';
import { RedTable, Typography, CheckBox, SelectionGroup } from 'components';
import { t } from 'i18next';
import { groupLeaseTermsByPeriod, getTermsByGroup } from 'helpers/quotes';
import { cf } from './LeaseLengthList.scss';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';

const { Table, RowHeader, Money, Row, Cell } = RedTable;
const { Text } = Typography;

export default class LeaseLengthList extends Component {
  static propTypes = {
    leaseTerms: PropTypes.arrayOf(PropTypes.object).isRequired,
    leaseTermsSelected: PropTypes.arrayOf(PropTypes.string),
    renderSpecialsAndDates: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
  };

  static defaultProps = {
    renderSpecialsAndDates: true,
  };

  groupTemplate = () => <div />;

  renderListItem = ({ item, selected }) => {
    const { originalItem } = item;
    const { adjustedMarketRent, overwrittenBaseRent, text, endDate } = originalItem;
    const { renderSpecialsAndDates } = this.props;
    const rent = overwrittenBaseRent || adjustedMarketRent;
    const endDateText = endDate ? ` (${t('ENDS_ON')} ${endDate.format(MONTH_DATE_YEAR_FORMAT)})` : '';

    return (
      <Row className={cf('row-header-custom')}>
        <Cell noSidePadding width={ICON_CELL_WIDTH}>
          <CheckBox checked={selected} />
        </Cell>
        <Cell noSidePadding>
          <Text>
            {text}
            {renderSpecialsAndDates && (
              <Text inline secondary>
                {endDateText}
              </Text>
            )}
          </Text>
        </Cell>
        {rent && (
          <Cell textAlign="right">
            <Money amount={rent} />
          </Cell>
        )}
      </Row>
    );
  };

  render({ leaseTerms, leaseTermsSelected, onChange, label, placeholder, renderSpecialsAndDates, disabled, ...rest } = this.props) {
    const filteredLeaseTerms = leaseTerms.filter(leaseTerm => leaseTerm.adjustedMarketRent);
    const groupedItems = groupLeaseTermsByPeriod(filteredLeaseTerms);
    const dataItems = groupedItems.map((group, index) => getTermsByGroup(index, group.periodName, group.array));

    return (
      <Table>
        <RowHeader className={cf('row-header-custom')}>
          <Cell noSidePadding>{t('RENEWAL_TERM')} </Cell>
          <Cell textAlign="right">{t('BASE_RENT')}</Cell>
        </RowHeader>
        <SelectionGroup
          id="LeaseTermsList"
          items={dataItems}
          multiple
          disabled={disabled}
          selectedValue={leaseTermsSelected}
          itemTemplate={this.renderListItem}
          label={label}
          onChange={onChange}
          columns={1}
          groupTemplate={this.groupTemplate}
          {...rest}
        />
      </Table>
    );
  }
}
