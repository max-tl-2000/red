/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import injectProps from 'helpers/injectProps';
import { RedTable, FlyOut, FlyOutOverlay, FlyOutActions, Button, Typography as T } from 'components';

import { loadInventoryByQuery } from 'redux/modules/inventoryStore';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { observer } from 'mobx-react';
import { formatInventoryItems } from 'helpers/quotes';
import InventorySelector from '../InventorySelector/InventorySelector';
import UnavailableItemsDialog from './UnavailableItemsDialog';
import { cf } from './InventorySelection.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { toMoment } from '../../../common/helpers/moment-utils';

const { Money } = RedTable;

const { Text } = T;

const buildEndpointUrl = (inventoryGroupId, selectedInventories = []) => {
  if (selectedInventories.length) {
    const inventoriesToInclude = selectedInventories.map(inv => `&inventoryToInclude=${inv.id}`).join('');
    return `/inventories?inventoryGroupId=${inventoryGroupId}${inventoriesToInclude}`;
  }
  return `/inventories?inventoryGroupId=${inventoryGroupId}`;
};

const inventoryItemUnavailable = (inventory, leaseStartDate, exportEnabled, timezone) => {
  if (!exportEnabled) return false;

  switch (inventory.state) {
    case DALTypes.InventoryState.OCCUPIED:
    case DALTypes.InventoryState.DOWN:
    case DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED:
    case DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED:
    case DALTypes.InventoryState.VACANT_READY_RESERVED:
      return true;
    default:
      if (toMoment(inventory.stateStartDate, { timezone }).isAfter(toMoment(leaseStartDate, { timezone }))) {
        return true;
      }
      return false;
  }
};

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        loadInventoryByQuery,
      },
      dispatch,
    ),
)
@observer
class InventorySelection extends React.Component {
  static propTypes = {
    fee: PropTypes.object,
    selectedInventories: PropTypes.array,
    setSelectedInventories: PropTypes.func,
    pickItemSelectorId: PropTypes.string,
    flyOutOverlayName: PropTypes.string,
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      inventoriesSource: [],
      selectedTextInventories: [],
      unavailableItemsDialogOpen: false,
    };
  }

  openUnavailableItemsDialog = () => this.setState({ unavailableItemsDialogOpen: true });

  closeUnavailableItemsDialog = () => this.setState({ unavailableItemsDialogOpen: false });

  async componentDidMount() {
    const endpointUrl = buildEndpointUrl(this.props.fee.inventoryGroupId, this.props.selectedInventories);
    const inventoryResults = (await this.props.loadInventoryByQuery(endpointUrl)) || [];
    const { leaseStartDate, exportEnabled, timezone } = this.props;
    const inventoriesSource = inventoryResults.map(inventory => {
      const buildingText = inventory.buildingShorthand ? `${inventory.buildingShorthand}-${inventory.name}` : inventory.name;
      const textItem = `${buildingText} ($${inventory.marketRent})`;
      return { ...inventory, buildingText, textItem, unavailable: inventoryItemUnavailable(inventory, leaseStartDate, exportEnabled, timezone) };
    });

    const ids = (this.props.selectedInventories || []).map(i => i.id);
    this.handleChange({ ids, inventoriesSource }, false);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.leaseStartDate && nextProps.leaseStartDate !== this.props.leaseStartDate) {
      const ids = this.state.selectedTextInventories?.map(i => i.id);
      const selectedTextInventories = this.handleChange({ ids, newLeaseStartDate: nextProps.leaseStartDate });
      this.shouldOpenUnavailableItemsDialog(selectedTextInventories);
    }
  }

  handleFlyoutClose = () => this.shouldOpenUnavailableItemsDialog() && this.openUnavailableItemsDialog();

  shouldOpenUnavailableItemsDialog = selectedInventories => {
    const { handleUnavailableRentableItemsSelected, handleNoRentableItemsSelected, fee } = this.props;
    const { selectedTextInventories } = this.state;
    const selectedInventoriesToCheck = selectedInventories || selectedTextInventories;
    if (!selectedInventoriesToCheck.length) {
      handleNoRentableItemsSelected && handleNoRentableItemsSelected(true, fee.id);
      handleUnavailableRentableItemsSelected && handleUnavailableRentableItemsSelected(false, fee.id);
      return false;
    }
    const unavailableInventoriesSelected = selectedInventoriesToCheck.filter(inventory => inventory.unavailable);
    if (unavailableInventoriesSelected.length) {
      handleUnavailableRentableItemsSelected && handleUnavailableRentableItemsSelected(true, fee.id);
      handleNoRentableItemsSelected && handleNoRentableItemsSelected(false, fee.id);
      return true;
    }

    handleNoRentableItemsSelected && handleNoRentableItemsSelected(false, fee.id);
    handleUnavailableRentableItemsSelected && handleUnavailableRentableItemsSelected(false, fee.id);
    return false;
  };

  handleChange = ({ ids, inventoriesSource, newLeaseStartDate }, somethingChanged) => {
    const { leaseStartDate, exportEnabled, timezone } = this.props;
    somethingChanged = typeof somethingChanged === 'undefined';
    const selectedTextInventories = (inventoriesSource || this.state.inventoriesSource)
      .filter(inventory => ids.some(id => id === inventory.id))
      .map(inventory => ({
        id: inventory.id,
        buildingText: `${inventory.buildingText}`,
        marketRent: inventory.marketRent,
        state: inventory.state,
        stateStartDate: inventory.stateStartDate,
        unavailable: inventoryItemUnavailable(inventory, newLeaseStartDate || leaseStartDate, exportEnabled, timezone),
      }));

    const newInventoriesSource = (inventoriesSource || this.state.inventoriesSource).map(i => ({
      ...i,
      unavailable: inventoryItemUnavailable(i, newLeaseStartDate || leaseStartDate, exportEnabled, timezone),
    }));

    const states = { selectedTextInventories, inventoriesSource: newInventoriesSource };

    if (this.inventorySelectorRef) {
      this.setState({ ...states });
      this.props.setSelectedInventories(this.props.fee, selectedTextInventories, somethingChanged);
    }

    return selectedTextInventories;
  };

  formatChipText = item => (
    <Text inline>
      {`${item.originalItem.buildingText} `}
      <Text inline secondary>
        (<Money secondary noDecimals amount={item.originalItem.marketRent} />)
      </Text>
    </Text>
  );

  storeRef = ref => {
    this.inventorySelectorRef = ref;
  };

  @injectProps
  render() {
    const { inventoriesSource, selectedTextInventories } = this.state;
    const { backendName, timezone, selectedInventories, leaseStartDate } = this.props;

    const selectedValues = (selectedInventories || []).map(i => i.id);
    return (
      <div className={cf('parent')}>
        {this.state.unavailableItemsDialogOpen && (
          <UnavailableItemsDialog
            id="unavailableItemsDialog"
            open={this.state.unavailableItemsDialogOpen}
            onCloseRequest={this.closeUnavailableItemsDialog}
            backendName={backendName}
            timezone={timezone}
            selectedInventories={selectedTextInventories}
            leaseStartDate={leaseStartDate}
          />
        )}
        <FlyOut
          overTrigger
          positionArgs={{ my: 'left top', at: 'left-10 top-27' }}
          expandTo="bottom-right"
          ref={this.storeRef}
          onClose={this.handleFlyoutClose}>
          {do {
            if (selectedTextInventories.length) {
              <T.Link className={cf('flyout-link')}>
                {selectedTextInventories.map((inventory, index, list, lastIndex = list.length - 1) => {
                  // TODO: Why is the index needed here?
                  // eslint-disable-next-line react/no-array-index-key
                  const key = `${index}${inventory.id}`;
                  return (
                    <span key={key} className={cf({ unavailable: inventory.unavailable })}>
                      {`${inventory.buildingText} `}(<Money noDecimals amount={inventory.marketRent} className={cf('marketRent')} />)
                      {index !== lastIndex && ', '}
                    </span>
                  );
                })}
              </T.Link>;
            } else {
              <T.Link uppercase bold className={cf('flyout-link')} id={this.props.pickItemSelectorId}>
                {t('INV_SELECTION_LINK')}
              </T.Link>;
            }
          }}
          <FlyOutOverlay container className={cf('flyout')} id={`${this.props.flyOutOverlayName}_flyOutContainer`}>
            <InventorySelector
              items={formatInventoryItems(inventoriesSource, DALTypes.InventorySelectorCases.INVENTORY_SELECTION)}
              selectedValue={selectedValues}
              handleChange={this.handleChange}
              formatChipText={this.formatChipText}
              selectedChipText="textItem"
              placeholder={t('INV_SELECTION_PLACEHOLDER')}
              marketRent="simple"
              templateType={DALTypes.InventorySelectorCases.INVENTORY_SELECTION}
              inventorySelectorId={this.props.inventorySelectorId}
            />
            <FlyOutActions>
              <Button id={`${this.props.flyOutOverlayBtn}_DoneBtn`} type="flat" label={t('DONE')} data-action="close" />
            </FlyOutActions>
          </FlyOutOverlay>
        </FlyOut>
      </div>
    );
  }
}

export default InventorySelection;
