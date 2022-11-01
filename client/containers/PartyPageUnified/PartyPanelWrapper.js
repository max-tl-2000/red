/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import PartyMembersPanel from 'custom-components/PartyMembersPanel/PartyMembersPanel';
import { DALTypes } from 'enums/DALTypes';
import { isDuplicatePersonNotificationEnabled, canMergeParties } from 'redux/selectors/userSelectors';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { getPartyMembers } from 'redux/selectors/partySelectors';
import { addParty, enableUpdatePartyTypeAction, updateParty } from 'redux/modules/partyStore';
import { updatePerson, mergePersons } from 'redux/modules/personsStore';
import { addGuest } from 'redux/modules/memberStore';
import { openMergePartyFlyout } from 'redux/modules/mergePartiesStore';
import { observer, inject } from 'mobx-react';
import { saveContactEvent } from 'redux/modules/communication';
import $ from 'jquery';
import { userHasPropertyAndTeamAndChannelSelections } from '../../redux/selectors/userSelectors';

@connect(
  (state, props) => ({
    partyMembers: getPartyMembers(state, props),
    displayDuplicatePersonNotification: isDuplicatePersonNotificationEnabled(state, props),
    selectedPropertyId: state.propertyStore.selectedPropertyId,
    ownerTeamId: state.propertyStore.ownerTeamId,
    contactChannel: state.partyStore.contactChannel,
    partyWorkflow: state.partyStore.partyWorkflow,
    isTransferLease: state.partyStore.isTransferLease,
    currentUser: state.auth.user,
    isMergedPartyEnabled: canMergeParties(state, props),
    hasPropertyAndTeamAndChannel: userHasPropertyAndTeamAndChannelSelections(state),
  }),
  dispatch =>
    bindActionCreators(
      {
        addParty,
        updatePerson,
        mergePersons,
        addGuest,
        openMergePartyFlyout,
        enableUpdatePartyTypeAction,
        saveContactEvent,
        updateParty,
      },
      dispatch,
    ),
  null,
  { withRef: true },
)
@inject('leasingNavigator')
@observer
export default class PartyPanelWrapper extends Component {
  getAssignedPropertyId = () => {
    const { selectedPropertyId, currentUser } = this.props;
    if (selectedPropertyId) return selectedPropertyId;
    if (!currentUser) return undefined;

    const properties = currentUser.associatedProperties || [];
    return properties.length === 1 ? properties[0].id : undefined;
  };

  getOwnerTeamId = () => {
    const { ownerTeamId, currentUser } = this.props;
    if (ownerTeamId) return ownerTeamId;

    if (!currentUser) return undefined;

    return currentUser.teams && currentUser.teams[0].id;
  };

  handleChangePartyType = ({ allowAction, partyType, partyTypeDisabledReason, clientUpdate }) => {
    if (!allowAction && partyTypeDisabledReason) {
      this.props.enableUpdatePartyTypeAction(false, partyTypeDisabledReason);
      return;
    }

    const { onChangePartyType } = this.props;
    onChangePartyType && onChangePartyType({ partyType, clientUpdate });
  };

  addGuest = async (guest, partyId) => {
    guest.memberState = DALTypes.PartyStateType.CONTACT;
    const isExistingPerson = !!guest.personId;

    const { props, isRenewalParty } = this;

    if (!partyId) {
      const propertyId = this.getAssignedPropertyId();
      const ownerTeamId = this.getOwnerTeamId();

      const { qualificationQuestions: qualificationQuestionsFromAdditionalData, storedUnitsFilters } =
        (props.getAdditionalData && props.getAdditionalData()) || {};

      const payload = {
        assignedPropertyId: propertyId,
        ownerTeam: ownerTeamId,
        contactChannel: this.props.contactChannel,
        qualificationQuestions: qualificationQuestionsFromAdditionalData || {},
        storedUnitsFilters,
        guest,
        saveInitialContactEvent: true,
        workflowName: props.partyWorkflow,
        isTransferLease: props.isTransferLease,
        company: props.company,
      };

      const party = await props.addParty(payload);
      props.leasingNavigator.navigateToParty(party.id, {
        openMergeParties: isExistingPerson,
        isCorporateParty: props.isCorporateParty,
        personId: guest.personId,
      });
    } else {
      await props.addGuest(guest, partyId);
      const shouldOpenMergePartiesDialog = isExistingPerson && !isRenewalParty() && !props.isCorporateParty;
      if (shouldOpenMergePartiesDialog) this.handleMergePartyDialogOpen(guest.personId);
    }
  };

  handleMergePersons = async mergeData => {
    const { props } = this;
    const {
      data: { id: resultPersonId },
    } = await props.mergePersons(mergeData);
    this.props.closeCreateEditResidentForm();
    !props.isCorporateParty && this.handleMergePartyDialogOpen(resultPersonId);
  };

  handleUpdatePerson = (person, dismissedMatches) => {
    const { props } = this;
    props.updatePerson(person, dismissedMatches);
    props.onPersonUpdate && props.onPersonUpdate();
  };

  onNavigateToPersonPage = personId => {
    personId && this.props.leasingNavigator.navigateToPerson(personId);
  };

  handleMergePartyDialogOpen = personId => {
    const { props } = this;
    const { isMergedPartyEnabled, partyId } = props;

    isMergedPartyEnabled &&
      props.openMergePartyFlyout({
        partyId,
        personId,
        mergeContext: personId ? DALTypes.MergePartyContext.PERSON : DALTypes.MergePartyContext.PARTY,
      });
  };

  focus() {
    const { partyMembersPanelRef } = this;
    const $panel = $(findDOMNode(partyMembersPanelRef));

    const $txt = $panel.find('[data-component="textbox"]:visible:first input');
    $txt.focus();
  }

  storePartyMembersPanelRef = ref => {
    this.partyMembersPanelRef = ref;
  };

  isRenewalParty = () => {
    const { party } = this.props;
    return party && party.workflowName === DALTypes.WorkflowName.RENEWAL;
  };

  render() {
    const { props } = this;
    const {
      partyId,
      partyMembers,
      displayDuplicatePersonNotification,
      isCorporateParty,
      memberToOpen,
      isPartyInPhaseI,
      hasPropertyAndTeamAndChannel,
      party,
      closeCreateEditResidentForm,
      company,
    } = props;
    const corporatePartyMember = isCorporateParty && partyMembers.find(p => p.memberType === DALTypes.MemberType.RESIDENT);

    return (
      <PartyMembersPanel
        ref={this.storePartyMembersPanelRef}
        memberType={DALTypes.MemberType.RESIDENT}
        partyId={partyId}
        startExpandedForAdd={!partyId}
        allowLinkMembers={false}
        enableAdvancedActions={false}
        panelMembers={[...partyMembers.values()]}
        partyMembers={partyMembers}
        addGuest={this.addGuest}
        updatePerson={this.handleUpdatePerson}
        mergePersons={this.handleMergePersons}
        onNavigateToPersonPage={this.onNavigateToPersonPage}
        memberToOpen={memberToOpen}
        formDisabled={!party && !hasPropertyAndTeamAndChannel}
        displayDuplicatePersonNotification={displayDuplicatePersonNotification}
        isCorporateParty={isCorporateParty}
        company={company}
        isPartyInPhaseI={!this.isRenewalParty() && isPartyInPhaseI}
        onChangePartyType={this.handleChangePartyType}
        updateParty={this.props.updateParty}
        closeCreateEditResidentForm={closeCreateEditResidentForm}
        corporatePartyMember={corporatePartyMember}
      />
    );
  }
}
