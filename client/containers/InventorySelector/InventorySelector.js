/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { connect } from 'react-redux';
import { Dropdown, RedList, Typography, FormattedMarkdown } from 'components';
import fuzzysearch from 'fuzzysearch';
import { formatToMoneyString } from 'helpers/quotes';
import { cf } from './InventorySelector.scss';
import { statesTranslationKeys } from '../../../common/enums/inventoryStates';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toHumanReadableString } from '../../../common/helpers/strings';
import { getStartingAtPriceText } from '../../../common/helpers/adjustmentText';
import { shouldDisplayInventoryState } from '../../../common/inventory-helper';

const { Text } = Typography;

@connect(
  state => ({
    currentUser: state.auth.user,
  }),
  null,
  null,
  { withRef: true },
)
class InventorySelector extends React.Component {
  static propTypes = {
    endpointUrl: PropTypes.string,
    placeholder: PropTypes.string,
    handleChange: PropTypes.func,
    selectedValue: PropTypes.array,
    items: PropTypes.array,
    meta: PropTypes.object,
    className: PropTypes.string,
    source: PropTypes.func,
    underlineOnEditOnly: PropTypes.bool,
    textRoleSecondary: PropTypes.bool,
    templateType: PropTypes.string,
    callSourceOnFocus: PropTypes.bool,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      isFromInventorySelection: props.templateType === DALTypes.InventorySelectorCases.INVENTORY_SELECTION,
      isFromScheduleAppointment: props.templateType === DALTypes.InventorySelectorCases.SCHEDULE_APPOINTMENT,
    };
  }

  renderGroupItem({ item }) {
    return (
      <Text secondary bold>
        {item.originalItem.name}
      </Text>
    );
  }

  formatMarketRent = (state, rent, adjustedMarketRent, leaseTerm) => {
    if (state === DALTypes.InventoryState.MODEL || !rent) return '';
    if (this.state.isFromScheduleAppointment) rent = adjustedMarketRent;
    const { marketRent } = this.props;

    if (marketRent === 'simple') return formatToMoneyString(rent);

    if (!leaseTerm) return '';

    const formattedMarkdown = (
      <FormattedMarkdown inline className={cf('price-secondary')}>
        {getStartingAtPriceText(rent, leaseTerm)}
      </FormattedMarkdown>
    );
    return formattedMarkdown;
  };

  formatBedsNumber = bedsNumber => t('BED', { count: bedsNumber });

  formatLayoutArea = area => {
    if (!area) return '';
    return t('UNIT_DETAILS_AREA', { area });
  };

  formatNames = (firstName, secondName) => {
    if (firstName) {
      if (secondName) return `${firstName},`;
      return firstName;
    }
    return '';
  };

  shouldDisplayState = (inventory, inventoryState) => inventoryState && shouldDisplayInventoryState(inventory);

  renderItem = ({ item, query, highlightMatches, index }) => {
    const { name, propertyDisplayName, state, layoutNoBedrooms, adjustedMarketRent, leaseTerm } = item.originalItem;
    let { buildingName, layoutDisplayName, marketRent, additionalTag, fullQualifiedName, layoutSurfaceArea } = item.originalItem;
    const { isFromInventorySelection, isFromScheduleAppointment } = this.state;
    const inventoryName = highlightMatches(this.formatNames(name, buildingName || propertyDisplayName), query);
    const inventoryState = t(statesTranslationKeys[state]);
    const bedsNumber = layoutNoBedrooms ? `${this.formatBedsNumber(layoutNoBedrooms)},` : '';
    layoutSurfaceArea = layoutSurfaceArea ? `${this.formatLayoutArea(layoutSurfaceArea)},` : '';
    fullQualifiedName = fullQualifiedName && `${fullQualifiedName},`;
    buildingName = highlightMatches(this.formatNames(buildingName, propertyDisplayName), query);
    additionalTag = additionalTag && !!additionalTag.length && toHumanReadableString(additionalTag, t('AND'));
    marketRent = this.formatMarketRent(state, marketRent, adjustedMarketRent, leaseTerm);
    layoutDisplayName = this.formatNames(layoutDisplayName, marketRent);

    const firtLine = (
      <div className={cf('dropdown-wrapper-item')} id="inventorySelectorFirstLine">
        {inventoryName && (
          <Text className={cf('dropdown-item')} inline>
            {inventoryName}
          </Text>
        )}
        {buildingName && (
          <Text className={cf('dropdown-item')} inline>
            {buildingName}
          </Text>
        )}
        {propertyDisplayName && <Text inline>{propertyDisplayName}</Text>}
      </div>
    );

    const secondLine = (
      <div className={cf('dropdown-wrapper-item')} id="inventorySelectorSecondLine">
        {fullQualifiedName && (
          <Text secondary uppercase inline className={cf('dropdown-item')}>
            {fullQualifiedName}
          </Text>
        )}
        {this.shouldDisplayState(item.originalItem, inventoryState) && (
          <Text secondary inline>
            {inventoryState}
          </Text>
        )}
      </div>
    );
    const thirdLine = (
      <div className={cf('dropdown-wrapper-item')} id="inventorySelectorThirdLine">
        {bedsNumber && isFromScheduleAppointment && (
          <Text className={cf('dropdown-item')} secondary inline>
            {bedsNumber}
          </Text>
        )}
        {layoutSurfaceArea && isFromInventorySelection && (
          <Text className={cf('dropdown-item')} secondary inline>
            {layoutSurfaceArea}
          </Text>
        )}
        {layoutDisplayName && (
          <Text className={cf('dropdown-item')} secondary inline>
            {layoutDisplayName}
          </Text>
        )}
        {marketRent && (
          <Text secondary inline>
            {marketRent}
          </Text>
        )}
      </div>
    );

    const fourthLine = additionalTag && isFromScheduleAppointment && (
      <div className={cf('dropdown-wrapper-item')} id="inventorySelectorFourthLine">
        <Text className={cf('tags-box')} secondary inline>
          {additionalTag}
        </Text>
      </div>
    );

    return (
      <RedList.ListItem data-id={`inventoryItem_${index}`} rowStyle="mixed">
        <RedList.MainSection>
          <div>
            {firtLine}
            {secondLine}
            {thirdLine}
            {fourthLine}
          </div>
        </RedList.MainSection>
      </RedList.ListItem>
    );
  };

  matchQuery(query, { originalItem: item }) {
    if (item.items) {
      return false;
    }
    return (
      fuzzysearch(query, item.name.toLowerCase()) ||
      (item.buildingName && fuzzysearch(query, item.buildingName.toLowerCase())) ||
      (item.buildingDisplayName && fuzzysearch(query, item.buildingDisplayName.toLowerCase()))
    );
  }

  focus() {
    this.ddRef && this.ddRef.focus();
  }

  storeDDRef = ref => {
    this.ddRef = ref;
  };

  render() {
    const {
      placeholder,
      underlineOnEditOnly,
      handleChange,
      selectedValue,
      items,
      meta,
      className,
      source,
      textRoleSecondary,
      formatChipText,
      selectedChipText,
      callSourceOnFocus,
      showFooter,
      inventorySelectorId,
    } = this.props;

    return (
      <Dropdown
        id={inventorySelectorId}
        placeholder={placeholder}
        ref={this.storeDDRef}
        autocomplete
        closeOnSelection
        multiple
        wide
        showListOnFocus
        showFooter={showFooter}
        overlayClassName={cf('inventory-overlay')}
        textRoleSecondary={textRoleSecondary}
        underlineOnEditOnly={underlineOnEditOnly}
        source={source}
        formatChipText={formatChipText}
        textField={selectedChipText || 'name'}
        valueField="id"
        matchQuery={this.matchQuery}
        renderItem={this.renderItem}
        renderGroupItem={this.renderGroupItem}
        groupItemClassName={cf('item-list-header')}
        onChange={handleChange}
        selectedValue={selectedValue}
        meta={meta}
        items={items}
        className={className}
        callSourceOnFocus={callSourceOnFocus}
        queryMinLength={1}
      />
    );
  }
}

export default InventorySelector;
