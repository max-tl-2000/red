/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import clsc from 'helpers/coalescy';
import sortBy from 'lodash/sortBy';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, Dropdown, Typography as T, DialogActions, DialogHeader, PreloaderBlock, RedList } from 'components';
import { addPropertyToUnitFilters } from 'redux/modules/unitsFilter';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { getAssignedTeamOwner } from 'helpers/party';
import $ from 'jquery';
import { getContactEventTypes, getReadOnlyContactEventTypes } from '../../../common/helpers/contactEventTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './PropertySelectionDialog.scss';
import { partyCreationAllowedTeams } from '../../../common/enums/partyTypes';
const { MainSection, ListItem } = RedList;

const leaseTypeOptions = { NEW_LEASE: 'newLease', TRANSFER_LEASE: 'transferLease' };

@connect(
  state => ({
    propertiesByTeamsLoading: state.globalStore.get('globalDataIsLoading'),
    teamPropertyMap: state.globalStore.get('propertiesByTeams'),
    enableRenewals: state.auth.user.features.enableRenewals,
    enableTransfers: state.auth.user.features.enableTransfers,
  }),
  dispatch =>
    bindActionCreators(
      {
        addPropertyToUnitFilters,
      },
      dispatch,
    ),
)
export class PropertySelectionDialog extends Component {
  constructor(props) {
    super(props);
    const { party, properties } = props;
    const firstContactChannel = ((party && party.metadata) || {}).firstContactChannel;

    this.state = {
      assignedPropertyId: this.props.propertyId,
      ownerTeamId: this.props.teamId,
      contactChannel: firstContactChannel,
      teamDropdownItems: [],
      hasOneProperty: properties.length === 1,
      leaseTypes: [],
      isTransferLease: false,
    };
  }

  static propTypes = {
    open: PropTypes.bool,
    onSubmit: PropTypes.func,
    propertyId: PropTypes.string,
    properties: PropTypes.arrayOf(PropTypes.object),
    teams: PropTypes.arrayOf(PropTypes.object),
    closeOnEscape: PropTypes.bool,
    onClose: PropTypes.func,
    showCancelButton: PropTypes.bool,
    displayPartyCohort: PropTypes.bool,
    titleText: PropTypes.string,
    contentText: PropTypes.string,
    shouldDisplayTeamAndContactChannel: PropTypes.bool,
    fieldToDisplayForProperty: PropTypes.string,
  };

  static defaultProps = {
    closeOnEscape: true,
    showCancelButton: false,
    shouldDisplayTeamAndContactChannel: true,
    fieldToDisplayForProperty: 'displayName',
  };

  componentWillReceiveProps(nextProps) {
    if (!this.props.teamPropertyMap.equals(nextProps.teamPropertyMap)) {
      this.props.shouldDisplayTeamAndContactChannel && this.populateTeamsDropdown(this.state.assignedPropertyId, nextProps.teamId, nextProps.teamPropertyMap);
    }
  }

  componentDidMount() {
    this.props.shouldDisplayTeamAndContactChannel && this.populateTeamsDropdown(this.state.assignedPropertyId, this.props.teamId, this.props.teamPropertyMap);
  }

  get isSubmitDisabled() {
    const { props, state } = this;
    const { party, shouldDisplayTeamAndContactChannel } = props;
    const { assignedPropertyId, ownerTeamId, contactChannel, partyWorkflow } = state;
    const noAssignedPropertyOrOwnerTeamId = shouldDisplayTeamAndContactChannel ? !assignedPropertyId || !ownerTeamId : !assignedPropertyId;

    if (party) {
      return noAssignedPropertyOrOwnerTeamId;
    }

    return noAssignedPropertyOrOwnerTeamId || (!contactChannel && shouldDisplayTeamAndContactChannel) || !partyWorkflow;
  }

  getLeaseTypesForTeam = team => {
    const leaseTypes = [];
    if (!team) return leaseTypes;

    const { disableNewLeasePartyCreation = false } = team.metadata.features || {};

    const newLeaseItem = { id: leaseTypeOptions.NEW_LEASE, text: t('NEW_LEASE') };
    const transferLeaseItem = { id: leaseTypeOptions.TRANSFER_LEASE, text: t('TRANSFER_LEASE') };

    if (!disableNewLeasePartyCreation) leaseTypes.push(newLeaseItem);
    if (this.props.enableTransfers) leaseTypes.push(transferLeaseItem);
    return leaseTypes;
  };

  getTeamsByPropertyId = (propertyId, teamPropertyMap) => {
    const teamsForProperty = teamPropertyMap.get(propertyId) || [];
    const { teams } = this.props;
    return teamsForProperty.reduce((acc, item) => {
      const team = teams.find(tm => tm.id === item.teamId);
      if (team) return [...acc, team];
      return acc;
    }, []);
  };

  getPropertiesToDisplay = properties => {
    const { teamPropertyMap, teams, party } = this.props;
    const isPartyWithUserAndNoProperty = party?.userId && party.teams.length && !party.assignedPropertyId;
    const filteredProperties = properties.filter(p => {
      const teamDropdownItems = isPartyWithUserAndNoProperty
        ? teams
        : this.getTeamsByPropertyId(p.id, teamPropertyMap).filter(({ module }) => partyCreationAllowedTeams.includes(module));
      return !!teamDropdownItems.length;
    });
    return sortBy(filteredProperties, 'displayName');
  };

  populateTeamsDropdown = (propertyId, savedTeamId, teamPropertyMap = []) => {
    const { party, teams } = this.props;
    const isPartyWithUserAndNoProperty = party?.userId && party.teams.length && !party.assignedPropertyId;
    const teamDropdownItems = isPartyWithUserAndNoProperty
      ? teams
      : this.getTeamsByPropertyId(propertyId, teamPropertyMap).filter(({ module }) => partyCreationAllowedTeams.includes(module));

    const hasOneTeam = teamDropdownItems.length === 1;
    const ownerTeamId = savedTeamId || getAssignedTeamOwner(hasOneTeam, teamDropdownItems);
    const hasOnePropertyAndTeamDDLItems = this.state.hasOneProperty && teamDropdownItems.length !== 0;
    const isPropertyNotSelectedOrHasOneProperty = !this.state.assignedPropertyId || hasOnePropertyAndTeamDDLItems;

    const ownerTeam = teamDropdownItems.find(tm => tm.id === ownerTeamId);
    const leaseTypes = this.getLeaseTypesForTeam(ownerTeam);
    leaseTypes.length === 1 && this.handleLeaseTypeChange(leaseTypes[0]);

    const newState = {
      teamDropdownItems,
      ownerTeamId,
      hasOneTeam: isPropertyNotSelectedOrHasOneProperty ? hasOneTeam : null,
      leaseTypes,
    };
    this.setState(newState);
  };

  handlePropertyChange = async item => {
    const { shouldDisplayTeamAndContactChannel } = this.props;
    this.setState({ assignedPropertyId: item.id });
    shouldDisplayTeamAndContactChannel && this.populateTeamsDropdown(item.id, null, this.props.teamPropertyMap);
  };

  handleTeamChange = item => {
    const { item: selectedTeam } = item;
    const leaseTypes = this.getLeaseTypesForTeam(selectedTeam);
    leaseTypes.length === 1 && this.handleLeaseTypeChange(leaseTypes[0]);
    this.setState({ ownerTeamId: item.id, leaseTypes });
  };

  handleChannelChange = item => this.setState({ contactChannel: item.id });

  handleLeaseTypeChange = ({ id: selectedLeaseType }) => {
    const isTransferLease = selectedLeaseType === leaseTypeOptions.TRANSFER_LEASE;
    this.setState({ partyWorkflow: DALTypes.WorkflowName.NEW_LEASE, isTransferLease });
  };

  handleOnSubmit = () => {
    const { onSubmit } = this.props;

    const { assignedPropertyId, ownerTeamId, contactChannel, partyWorkflow, isTransferLease } = this.state;

    onSubmit && onSubmit({ assignedPropertyId, ownerTeamId, contactChannel, partyWorkflow, isTransferLease });
    this.props.addPropertyToUnitFilters(this.state.assignedPropertyId);
  };

  handleOnClose = () => {
    const { onClose } = this.props;
    onClose && onClose();
  };

  handleOpen = () => {
    const { dialogOverlayRef } = this;
    if (!dialogOverlayRef) return;
    const dialogOverlayDOM = findDOMNode(dialogOverlayRef); // eslint-disable-line react/no-find-dom-node

    $(dialogOverlayDOM).find('[data-component="dropdown"]:first > [data-trigger="true"]').focus();
  };

  storeDialogOverlayRef = ref => {
    this.dialogOverlayRef = ref;
  };

  handleFocusRequest = dialogOverlayDom => {
    const dropdown = $(dialogOverlayDom).find('[data-component="dropdown"]:first > [data-trigger="true"]');
    dropdown.focus();
  };

  renderContactChannel = () => {
    const { party, shouldDisplayTeamAndContactChannel } = this.props;

    const { contactChannel } = this.state;
    const firstContactChannelItems = sortBy(getContactEventTypes({ excludeSelfBook: true }).concat(party ? getReadOnlyContactEventTypes() : []), 'text');

    if (shouldDisplayTeamAndContactChannel) {
      return (
        <div>
          <T.Text className={cf('label')}>{t('FIRST_CONTACT_CHANNEL_LABEL')}</T.Text>
          <Dropdown
            placeholder={t('FIRST_CONTACT_CHANNEL_PLACEHOLDER')}
            wide
            textField="text"
            valueField="id"
            id="firstContactChannelDropdown"
            onChange={this.handleChannelChange}
            selectedValue={contactChannel}
            items={firstContactChannelItems}
            disabled={!!party}
          />
        </div>
      );
    }
    return <noscript />;
  };

  renderPropertyItem = ({ item: { originalItem } }) => {
    const { id, displayName, partyCohortName } = originalItem;
    return (
      <ListItem key={id}>
        <MainSection>
          <T.Text>{displayName}</T.Text>
          {this.props.displayPartyCohort && <T.Text secondary>{partyCohortName}</T.Text>}
        </MainSection>
      </ListItem>
    );
  };

  render() {
    const {
      id,
      open,
      properties,
      closeOnEscape,
      showCancelButton,
      propertiesByTeamsLoading,
      party,
      titleText,
      contentText,
      shouldDisplayTeamAndContactChannel,
      enableRenewals,
      enableTransfers,
      fieldToDisplayForProperty,
    } = this.props;
    const theId = clsc(id, this.id);
    const sortedProperties = this.getPropertiesToDisplay(properties);
    const sortedTeams = sortBy(this.state.teamDropdownItems, 'displayName');

    const partyAlreadyExists = !!party;
    const { hasOneProperty, hasOneTeam } = this.state;

    // forceFocusOnDialog will prevent losing the focus when pressing tab repeatedly in the page
    // this should be the default behavior for "modal" dialogs but in order to avoid possible
    // regressions by the inclusion of this new feature it is better to make it "opt in" so we can
    // enable and test it on a case by case basis
    return (
      <Dialog
        open={open}
        id={theId}
        forceFocusOnDialog={true}
        closeOnEscape={closeOnEscape}
        onOpen={this.handleOpen}
        onClose={this.handleOnClose}
        onFocusRequest={this.handleFocusRequest}>
        <DialogOverlay ref={this.storeDialogOverlayRef} className={cf('property-selection-dialog')} container={false}>
          <DialogHeader title={titleText || t('PROPERTY_AND_TEAM_SELECTION_TITLE')} />
          <T.Text className={cf('info-text')}>{contentText || t('PROPERTY_AND_TEAM_SELECTION_INFO_TEXT')}</T.Text>
          {(!hasOneProperty || partyAlreadyExists) && (
            <div>
              {shouldDisplayTeamAndContactChannel && <T.Text className={cf('label')}>{t('SELECT_PROPERTY_LABEL')}</T.Text>}
              <Dropdown
                placeholder={t('SELECT_PROPERTY_PLACEHOLDER')}
                wide
                onChange={this.handlePropertyChange}
                textField={fieldToDisplayForProperty}
                selectedValue={this.state.assignedPropertyId}
                valueField="id"
                id="assignedProperty"
                renderItem={this.renderPropertyItem}
                items={sortedProperties}
                disabled={hasOneProperty && !!this.state.assignedPropertyId}
              />
            </div>
          )}
          {(!hasOneTeam || partyAlreadyExists) && shouldDisplayTeamAndContactChannel && (
            <div>
              <T.Text className={cf('label')}>{t('SELECT_TEAM_LABEL')}</T.Text>
              <Dropdown
                placeholder={t('SELECT_TEAM_PLACEHOLDER')}
                wide
                textField="displayName"
                valueField="id"
                id="teamDropdown"
                onChange={this.handleTeamChange}
                selectedValue={this.state.ownerTeamId}
                items={sortedTeams}
                disabled={this.state.teamDropdownItems.length === 1}
              />
            </div>
          )}
          {(enableRenewals || enableTransfers) && !partyAlreadyExists && (
            <div>
              <T.Text className={cf('label')}>{t('TYPE_OF_LEASE')}</T.Text>
              <Dropdown
                placeholder={t('TYPE_OF_LEASE_PLACEHOLDER')}
                wide
                textField="text"
                valueField="id"
                id="newLeaseType"
                onChange={this.handleLeaseTypeChange}
                selectedValue={this.state.partyWorkflow}
                items={this.state.leaseTypes}
                disabled={this.state.leaseTypes.length === 1}
              />
            </div>
          )}
          {this.renderContactChannel()}
          <DialogActions className={cf('actions')}>
            {showCancelButton && <Button id="cancelAssignedPropertyBtn" type="flat" btnRole="secondary" onClick={this.handleOnClose} label={t('CANCEL')} />}
            <Button
              type="flat"
              id="submitAssignedProperty"
              onClick={this.handleOnSubmit}
              label={!party && shouldDisplayTeamAndContactChannel ? t('SELECT_TEAM_AND_PROPERTY_BUTTON') : t('DONE')}
              disabled={this.isSubmitDisabled}
            />
          </DialogActions>
          {propertiesByTeamsLoading && <PreloaderBlock modal />}
        </DialogOverlay>
      </Dialog>
    );
  }
}
