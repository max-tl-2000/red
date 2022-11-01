/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Dropdown, RedList, Typography, RedTable } from 'components';
import { t } from 'i18next';
import { periodText, groupLeaseTermsByPeriod, getTermsByGroup } from 'helpers/quotes';
import { cf } from './LeaseLength.scss';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';

const { Money, Row, Cell } = RedTable;
const { MainSection, ListItem } = RedList;
const { Text } = Typography;

export default class LeaseLength extends Component {
  static propTypes = {
    leaseTerms: PropTypes.arrayOf(PropTypes.object).isRequired,
    leaseTermsSelected: PropTypes.arrayOf(PropTypes.string),
    renderSpecialsAndDates: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
  };

  static defaultProps = {
    renderSpecialsAndDates: true,
  };

  formatSelectedLeaseTerms = dropdownElements => {
    const leaseTerm = dropdownElements.selected[0].originalItem;
    let formattedPeriod = periodText(leaseTerm);

    if (dropdownElements.selected.length > 1) {
      formattedPeriod = periodText({ period: leaseTerm.period, termLength: 2 });
    }

    const commaSeparatedTerms = dropdownElements.selected
      .sort((a, b) => (a.originalItem.termLength > b.originalItem.termLength ? 1 : -1))
      .map(i => i.originalItem.termLength)
      .join(', ');

    return t('LEASE_TERMS_SELECTED', { commaSeparatedTerms, period: formattedPeriod });
  };

  renderDropdownItem = ({ item, selectAffordance }) => {
    const { originalItem } = item;
    const { adjustedMarketRent, overwrittenBaseRent } = originalItem;
    const { renderSpecialsAndDates } = this.props;
    const rent = overwrittenBaseRent || adjustedMarketRent;
    const dataId = `${originalItem.text.replace(/\s/g, '_')}_leaseTerm`;

    return (
      <ListItem>
        {selectAffordance}
        <MainSection>
          <Row className={cf('term-row')} noDivider>
            <Cell className={cf('term-cell')}>
              <Text data-id={dataId}>
                {originalItem.text}{' '}
                {renderSpecialsAndDates && originalItem.specials && (
                  <Text inline highlight>
                    (specials)
                  </Text>
                )}
              </Text>
            </Cell>
            {rent && (
              <Cell textAlign="right" className={cf('term-cell')}>
                <Money secondary inline amount={rent} dataId={`${dataId}_rentAmount`} />
              </Cell>
            )}
          </Row>
          {renderSpecialsAndDates && originalItem.endDate && (
            <Text data-id={`${dataId}_endDate`} inline secondary>
              {originalItem.endDate.format(MONTH_DATE_YEAR_FORMAT) || ''}
            </Text>
          )}
        </MainSection>
      </ListItem>
    );
  };

  render({ leaseTerms, leaseTermsSelected, onChange, label, placeholder, renderSpecialsAndDates, disabled, ...rest } = this.props) {
    const groupedItems = groupLeaseTermsByPeriod(leaseTerms);
    const dataItems = groupedItems.map((group, index) => getTermsByGroup(index, group.periodName, group.array));

    return (
      <Dropdown
        id="dropdownLeaseTerms"
        items={dataItems}
        multiple
        disabled={disabled}
        formatSelected={this.formatSelectedLeaseTerms}
        selectedValue={leaseTermsSelected}
        renderItem={this.renderDropdownItem}
        placeholder={placeholder}
        label={label}
        onChange={onChange}
        {...rest}
      />
    );
  }
}
