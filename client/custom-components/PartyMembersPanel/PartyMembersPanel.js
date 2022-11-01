/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Section, Button, MsgBox, Typography } from 'components';
import Immutable from 'immutable';

import RemoveMemberDialog from 'custom-components/ResidentPanel/RemoveMemberDialog';
import CreateEditResidentForm from 'custom-components/CreateEditResidentForm/CreateEditResidentForm';
import ResidentContextMenu from 'custom-components/ResidentPanel/ResidentContextMenu';
import CommonPersonCard from 'custom-components/Persons/CommonPersonCard';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { t } from 'i18next';
import { observer } from 'mobx-react';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './PartyMembersPanel.scss';
import { isApplicationApprovable } from '../../../common/helpers/quotes';
import { isCorporateParty as _isCorporateParty, getPartyTypeDisabledReason, isResident, isOccupant, isGuarantor } from '../../../common/helpers/party-utils';
import LinkPartyMember from './LinkPartyMember';
import { getEnhancedPerson } from '../../../common/helpers/person-helper';
import ClosePartyDialog from '../../containers/ProspectDetailPage/ClosePartyDialog';
import { areOccupantsAllowed, isPartyLevelGuarantor } from '../../helpers/party';
import { toLowerCaseTransKey } from '../../../common/helpers/i18next-utils';
import DialogModel from '../../containers/PartyPageUnified/DialogModel';
import { CommunicationContext } from '../../../common/enums/communicationTypes';

const { Text } = Typography;

@observer
export default class PartyMembersPanel extends Component {
  static propTypes = {
    partyId: PropTypes.string,
    memberType: PropTypes.string.isRequired,
    partyMembers: PropTypes.object,
    panelMembers: PropTypes.array.isRequired,
    addGuest: PropTypes.func.isRequired,
    updatePerson: PropTypes.func.isRequired,
    mergePersons: PropTypes.func.isRequired,
    allowLinkMembers: PropTypes.bool,
    onNavigateToPersonPage: PropTypes.func.isRequired,
    quotePromotions: PropTypes.object,
    processPartyMemberLinkAction: PropTypes.func,
    updatePartyMember: PropTypes.func,
    demoteApplication: PropTypes.func,
    startExpandedForAdd: PropTypes.bool,
    enableAdvancedActions: PropTypes.bool,
    displayDuplicatePersonNotification: PropTypes.bool,
    isLeasePublishedOrExecuted: PropTypes.bool,
    isLeaseDraft: PropTypes.bool,
    isCorporateParty: PropTypes.bool,
    isPartyInPhaseI: PropTypes.bool,
    onChangePartyType: PropTypes.func,
    addDisabled: PropTypes.bool,
    updateParty: PropTypes.func,
    isActiveLeaseParty: PropTypes.bool,
    partyClosedOrArchived: PropTypes.bool,
    sendResidentAppInvite: PropTypes.func,
    isPartyInActiveState: PropTypes.bool,
  };

  static defaultProps = {
    allowLinkMembers: true,
    partyMembers: new Immutable.Map(),
    quotePromotions: new Immutable.Map(),
    startExpandedForAdd: false,
    enableAdvancedActions: true,
    isPartyInPhaseI: false,
  };

  constructor(props) {
    super(props);
    this.dlgLimitOneGuarantor = new DialogModel();
    this.state = {
      selectedPerson: {},
      editedPerson: {},
      selectedPartyMember: null,
      isAddMemberOpen: props.memberToOpen || props.startExpandedForAdd || false,
      memberContextMenuOpen: false,
      isCorporateParty: props.isCorporateParty,
    };
  }

  componentDidMount() {
    this._mounted = true;
    this.handleOpenMatch(this.props);
  }

  componentWillUnmount() {
    this._mounted = false;
  }

  componentWillReceiveProps(nextProps) {
    this.handleOpenMatch(nextProps);

    if (this.props.partyId !== nextProps.partyId) this.setState({ isAddMemberOpen: false });
  }

  handleOpenMatch = data => {
    if (data.isCorporateParty !== this.state.isCorporateParty) this.handlerTogglePartyType(true);

    if (!data.panelMembers || !data.panelMembers.length || !data.memberToOpen) return;

    const selectedMember = data.panelMembers.find(m => m.personId === data.memberToOpen.personId);
    if (selectedMember) this.setState({ editedPerson: selectedMember.person, isAddMemberOpen: true });
  };

  setLoadingStateToFalse = () => this.setLoadingStateOnAddButton(false);

  setLoadingStateOnAddButton = loading => {
    if (!this._mounted) return;
    this.setState({ addButtonBusy: loading });
  };

  // For traditional parties we only have one promoted quote and one lease.
  getPendingApplicationApproval = () =>
    this.props.quotePromotions.find(promotion => promotion.partyId === this.props.partyId && isApplicationApprovable(promotion.promotionStatus));

  handleAddGuest = async guest => {
    guest.memberType = this.props.memberType;
    const personAlreadyAddedToParty = this.props.partyMembers.map(m => m.personId).find(p => p === guest.personId);
    if (personAlreadyAddedToParty) {
      this.setState({
        personAddedMsgBoxOpen: true,
      });
      return;
    }

    this.setLoadingStateOnAddButton(true);
    const p = this.props.addGuest(guest, this.props.partyId, this.props.memberType);
    p.then(this.setLoadingStateToFalse, this.setLoadingStateToFalse);
    await p;

    this._mounted && this.setState({ isAddMemberOpen: false });

    if (!this.state.isCorporateParty) {
      const quotePromotion = this.getPendingApplicationApproval();
      if (quotePromotion) this.props.demoteApplication(this.props.partyId, quotePromotion.id);
    }
  };

  getMemberTypeKey = memberType => {
    if (isGuarantor(memberType)) {
      return 'GUARANTORS';
    }

    if (isOccupant(memberType)) {
      return 'OCCUPANTS';
    }

    return 'RESIDENTS';
  };

  openPublishedLeaseMsgBox = memberType => {
    const { isLeaseDraft, isLeasePublishedOrExecuted, isActiveLeaseParty, partyClosedOrArchived } = this.props;
    const memberTypeKey = this.getMemberTypeKey(memberType);

    this.setState({
      actionNotAllowedMsgBoxOpen: true,
      actionNotAllowedMsgBoxTitle: t('CANNOT_ADD_MEMBERS', { memberType: toLowerCaseTransKey(memberTypeKey) }),
      actionNotAllowedMsgBoxText: partyClosedOrArchived
        ? t('CANNOT_ADD_MEMBERS_TEXT_CLOSED', { memberType: t(memberTypeKey) })
        : (isLeaseDraft && t('CANNOT_ADD_MEMBERS_TEXT_DRAFT_LEASE', { memberType: t(memberTypeKey) })) ||
          (isLeasePublishedOrExecuted && t('CANNOT_ADD_MEMBERS_TEXT', { memberType: t(memberTypeKey) })) ||
          (isActiveLeaseParty && t('CANNOT_ADD_MEMBERS_TEXT_ACTIVE_LEASE', { memberType: t(memberTypeKey) })),
    });
  };

  onRemoveMemberFromParty = personId => {
    const { partyMembers, isActiveLeaseParty, partyClosedOrArchived } = this.props;
    const selectedMember = partyMembers.find(pm => pm.personId === personId);
    const { memberType } = selectedMember;

    if (this.props.isLeasePublishedOrExecuted || this.props.isLeaseDraft || isActiveLeaseParty || partyClosedOrArchived) {
      this.openPublishedLeaseMsgBox(memberType);
      return;
    }

    if (partyMembers && partyMembers.size === 1) {
      this.setState({ isClosePartyOpen: true, memberToRemoveOnClose: selectedMember });
      return;
    }

    this.setState({ removeMemberDialogOpen: true, selectedPartyMember: selectedMember });
  };

  handleUpdatePerson = (person, dismissedMatches) => {
    const { isPartyInPhaseI, closeCreateEditResidentForm } = this.props;

    this.props.updatePerson(person, dismissedMatches);
    this.setState({ isAddMemberOpen: false });
    isPartyInPhaseI && closeCreateEditResidentForm();
  };

  onOpenLinkPartyMember = personId => {
    const enhancedPerson = getEnhancedPerson(this.props.partyMembers, personId);
    this.setState({ isLinkPartyMemberOpen: true, selectedPartyMember: enhancedPerson });
  };

  onCloseLinkPartyMember = () => this.setState({ isLinkPartyMemberOpen: false });

  onDoneLinkPartyMember = list => {
    const { selectedPartyMember } = this.state;
    this.setState({ isLinkPartyMemberOpen: false });
    this.props.processPartyMemberLinkAction(this.props.partyId, selectedPartyMember, list, DALTypes.ManageMembersActions.LINK);
  };

  handleRemoveLinkPartyMember = () => {
    const { selectedPartyMember } = this.state;
    this.setState({ isLinkPartyMemberOpen: false });
    this.props.processPartyMemberLinkAction(this.props.partyId, selectedPartyMember, [], DALTypes.ManageMembersActions.REMOVE_LINK);
  };

  onMoveTo = (personId, memberType) => {
    const partyHasGuarantors = this.props.partyMembers.some(isGuarantor);
    if (isPartyLevelGuarantor && isGuarantor(memberType) && partyHasGuarantors) {
      this.dlgLimitOneGuarantor.open();
      return;
    }
    const { isLeasePublishedOrExecuted, isLeaseDraft, isActiveLeaseParty, partyClosedOrArchived } = this.props;
    if (isLeasePublishedOrExecuted || isLeaseDraft || isActiveLeaseParty || partyClosedOrArchived) {
      this.setState({
        actionNotAllowedMsgBoxOpen: true,
        actionNotAllowedMsgBoxTitle: t('CANNOT_MOVE_MEMBERS'),
        actionNotAllowedMsgBoxText: partyClosedOrArchived
          ? t('CANNOT_MOVE_MEMBERS_TEXT_CLOSED')
          : (isLeaseDraft && t('CANNOT_MOVE_MEMBERS_TEXT_DRAFT_LEASE')) ||
            (isLeasePublishedOrExecuted && t('CANNOT_MOVE_MEMBERS_TEXT')) ||
            (isActiveLeaseParty && t('CANNOT_MOVE_MEMBERS_TEXT_ACTIVE_LEASE')),
      });
      return;
    }
    const selectedMember = this.props.partyMembers.find(pm => pm.personId === personId);
    selectedMember.memberType = memberType;
    this.props.updatePartyMember(selectedMember, this.props.partyId);
  };

  showContextMenu = (e, partyMember) => {
    e.preventDefault();
    this.setState({
      trigger: e.target,
      selectedPerson: partyMember.person,
      selectedMember: partyMember,
      memberContextMenuOpen: true,
    });
  };

  closeContextMenu = e => {
    if (e.button === 2) return; // ignore right click to not mess with the context menu
    this.setState({ trigger: null, memberContextMenuOpen: false });
  };

  handleContextMenuAction = ({ action, $item } = {}) => {
    switch (action) {
      case 'open': {
        const personId = this.state.selectedPerson && this.state.selectedPerson.id;
        this.props.onNavigateToPersonPage && this.props.onNavigateToPersonPage(personId);
        break;
      }
      case 'edit': {
        this.setState({ isAddMemberOpen: true, editedPerson: this.state.selectedPerson });
        break;
      }
      case 'remove-from-party': {
        this.onRemoveMemberFromParty(this.state.selectedPerson.id);
        break;
      }
      case 'moveTo': {
        const memberType = $item.attr('data-member-type');
        this.onMoveTo(this.state.selectedPerson.id, memberType);
        break;
      }
      case 'link': {
        this.onOpenLinkPartyMember(this.state.selectedPerson.id);
        break;
      }
      case 'send-resident-app-invite': {
        this.setState({ sendAppInviteDialogOpen: true });
        break;
      }
      case 'cannot-send-app-invite': {
        this.setState({ cannotSendAppInviteDialogOpen: true, isAddMemberOpen: true, editedPerson: this.state.selectedPerson });
        break;
      }
      default: {
        console.warn('Unknown action triggered: ', action);
        break;
      }
    }
  };

  clearSelectedPerson = () => this.setState({ selectedPerson: {}, editedPerson: {} });

  handleClickAddMember = () => {
    const { memberType, panelMembers, isActiveLeaseParty, partyClosedOrArchived } = this.props;
    if (isPartyLevelGuarantor && isGuarantor(memberType) && panelMembers.length === 1) {
      this.dlgLimitOneGuarantor.open();
      return;
    }
    this.props.isLeasePublishedOrExecuted || this.props.isLeaseDraft || isActiveLeaseParty || partyClosedOrArchived
      ? this.openPublishedLeaseMsgBox(memberType)
      : this.setState({ selectedPerson: {}, editedPerson: {}, isAddMemberOpen: true });
  };

  handlerTogglePartyType = (clientUpdate = true) => {
    const { partyId, quotePromotions, onChangePartyType } = this.props;
    const newIsCorporatePartyValue = !this.state.isCorporateParty;
    const partyType = newIsCorporatePartyValue ? DALTypes.PartyTypes.CORPORATE : DALTypes.PartyTypes.TRADITIONAL;

    const requestChangeToCorporate = !this.state.isCorporateParty && _isCorporateParty({ leaseType: partyType });
    if (requestChangeToCorporate && this.props.partyMembers.size >= 1) {
      const partyMembers = this.props.partyMembers.toArray();
      const allowOccupants = areOccupantsAllowed({ leaseType: partyType });
      const partyTypeDisabledReason = getPartyTypeDisabledReason({ id: partyId, partyMembers }, partyType, quotePromotions, allowOccupants);
      if (partyTypeDisabledReason) {
        onChangePartyType({ allowAction: false, partyTypeDisabledReason });
        return;
      }

      let clearAndCloseDialog = this.state.isAddMemberOpen;
      if (partyMembers.length === 1) {
        const [partyMember] = partyMembers;
        const { id: personId } = partyMember.person || {};
        const companyName = this.props.company?.companyName;
        clearAndCloseDialog = (this.state.editedPerson || {}).id !== personId && !!companyName;
        !companyName &&
          this.setState(
            {
              selectedPerson: partyMember.person,
              selectedMember: partyMember,
            },
            () => this.handleContextMenuAction({ action: 'edit' }),
          );
      }

      if (clearAndCloseDialog) {
        this.clearSelectedPerson();
        this.setState({ isAddMemberOpen: false });
      }
    }

    this.setState({ isCorporateParty: newIsCorporatePartyValue });
    onChangePartyType && onChangePartyType({ allowAction: true, partyType, clientUpdate });
  };

  renderCorporatePartyButton = () => {
    if (!this.props.isPartyInPhaseI) return null;
    const transToken = !this.state.isCorporateParty ? 'CHANGE_TO_CORPORATE' : 'CHANGE_TO_TRADITIONAL';
    return <Button data-id="changePartyTypeBtn" label={t(transToken)} type="flat" btnRole="primary" onClick={() => this.handlerTogglePartyType(false)} />;
  };

  isPointOfContact = () => this.state.isCorporateParty && isResident(this.props);

  getSectionTitle = () => {
    if (this.isPointOfContact()) return t('POINT_OF_CONTACT');

    return t(this.props.memberType.toUpperCase(), { count: 2 });
  };

  shouldDisplayOccupants = () => {
    const { isCorporateParty } = this.state;
    const leaseType = isCorporateParty ? DALTypes.PartyTypes.CORPORATE : DALTypes.PartyTypes.TRADITIONAL;
    return areOccupantsAllowed({ leaseType });
  };

  isAddMemberAllowed = () => {
    const { isAddMemberOpen, isCorporateParty } = this.state;
    const { corporatePartyMember } = this.props;
    if (isAddMemberOpen) return false;
    if (isCorporateParty && !corporatePartyMember) return true;

    const { memberType } = this.props;
    if (!isOccupant(memberType)) return !isCorporateParty;

    return this.shouldDisplayOccupants();
  };

  handleSendAppInvite = async () =>
    await this.props.sendResidentAppInvite({
      partyId: this.props.partyId,
      personIds: [this.state.selectedPerson.id],
      context: CommunicationContext.PREFER_EMAIL,
    });

  render(
    {
      id: sectionId,
      memberType,
      panelMembers,
      partyMembers,
      allowLinkMembers,
      enableAdvancedActions,
      displayDuplicatePersonNotification,
      closeCreateEditResidentForm,
      isPartyInPhaseI,
      propertyAppSettings,
      isNewLeaseParty,
      isLeasePublishedOrExecuted,
      isPartyInActiveState,
    } = this.props,
  ) {
    const {
      selectedPerson,
      memberToRemoveOnClose,
      editedPerson,
      isAddMemberOpen,
      isCorporateParty,
      memberContextMenuOpen,
      trigger,
      sendAppInviteDialogOpen,
      cannotSendAppInviteDialogOpen,
    } = this.state;
    const highlightedPersonId = (selectedPerson || {}).id || (editedPerson || {}).id;
    const { dlgLimitOneGuarantor } = this;

    const allowAccess = propertyAppSettings?.allowAccess;
    const appName = propertyAppSettings?.name;

    const isPartyEligibleForRxpInvite = !isNewLeaseParty || isLeasePublishedOrExecuted;
    const showSendResidentAppInvite = isPartyEligibleForRxpInvite && allowAccess && isPartyInActiveState;

    const { contactInfo = {}, commonUserEmail } = selectedPerson || {};
    const selectedPersonEmail = commonUserEmail ?? (contactInfo.emails?.find(e => e.id === contactInfo.defaultEmailId) || {}).value;
    const isOccupantsSection = memberType === DALTypes.MemberType.OCCUPANT;

    const panelCards = panelMembers.map(pm => (
      <CommonPersonCard
        key={pm.person.id}
        partyMember={{ ...pm.person, memberType, partyMembers: partyMembers.toArray(), memberId: pm.id, strongMatchCount: pm.person.strongMatchCount }}
        onItemSelected={e => this.showContextMenu(e, pm)}
        isSelected={pm.person.id === highlightedPersonId}
        displayDuplicatePersonNotification={displayDuplicatePersonNotification}
        displayCompanyName={false}
        isPartyLevelGuarantor={isPartyLevelGuarantor}
        vacateDate={pm.vacateDate}
      />
    ));

    const addLabelKey = this.isPointOfContact() ? 'ADD_POINT_OF_CONTACT' : `ADD_${memberType.toUpperCase()}`;
    const id = `add${memberType}Button`;

    return (
      <Section id={sectionId} title={this.getSectionTitle()} actionItems={this.renderCorporatePartyButton()}>
        <div data-id={`memberCards${memberType}Section`} className={cf('memberCardsSection')}>
          {panelCards}
        </div>
        {isAddMemberOpen && (
          <CreateEditResidentForm
            formDisabled={this.props.formDisabled}
            addButtonBusy={this.state.addButtonBusy}
            onAddPerson={this.handleAddGuest}
            onUpdatePerson={this.handleUpdatePerson}
            onMergePersons={this.props.mergePersons}
            onCancel={() => {
              this.clearSelectedPerson();
              this.setState({ isAddMemberOpen: false });
              isPartyInPhaseI && closeCreateEditResidentForm();
            }}
            person={this.state.editedPerson}
            partyId={this.props.partyId}
            hideCancelButton={!panelMembers.length && isResident(memberType)}
            displayDuplicatePersonNotification={displayDuplicatePersonNotification}
            associatedPartyTypes={new Set([isCorporateParty ? DALTypes.PartyTypes.CORPORATE : DALTypes.PartyTypes.TRADITIONAL])}
            isPointOfContact={this.isPointOfContact()}
          />
        )}
        {isOccupantsSection && !panelMembers.length && <EmptyMessage style={{ paddingLeft: '1.5rem', paddingTop: '0rem' }} message={t('NO_OCCUPANTS_ADDED')} />}
        <div>
          {this.isAddMemberAllowed() && (
            <Button
              className={cf('addMemberButton')}
              data-id={id}
              label={t(addLabelKey)}
              type={'flat'}
              btnRole={'primary'}
              onClick={this.handleClickAddMember}
            />
          )}
        </div>
        {selectedPerson.id && (
          <ResidentContextMenu
            open={memberContextMenuOpen}
            showExtended={enableAdvancedActions}
            selectedMember={this.state.selectedMember}
            members={this.props.partyMembers.toArray()}
            allowLinkMembers={allowLinkMembers}
            allowOccupants={this.shouldDisplayOccupants()}
            onSelect={this.handleContextMenuAction}
            positionArgs={{ my: 'left top', at: 'left top', of: trigger }}
            onCloseRequest={this.closeContextMenu}
            displayDuplicatePersonNotification={displayDuplicatePersonNotification}
            isPartyLevelGuarantor={isPartyLevelGuarantor}
            selectedPersonEmail={selectedPersonEmail}
            showSendResidentAppInvite={showSendResidentAppInvite}
            appName={appName}
          />
        )}

        {this.state.removeMemberDialogOpen && (
          <RemoveMemberDialog
            open={this.state.removeMemberDialogOpen}
            members={this.props.partyMembers.toArray()}
            member={this.state.selectedPartyMember}
            onCloseRequest={() => this.setState({ removeMemberDialogOpen: false })}
          />
        )}

        {sendAppInviteDialogOpen && (
          <MsgBox
            open={sendAppInviteDialogOpen}
            closeOnTapAway={false}
            id="sendAppInviteDialog"
            lblOK={t('SEND_APP_INVITE')}
            onOKClick={this.handleSendAppInvite}
            lblCancel={t('CANCEL')}
            onCancelClick={() => this.setState({ sendAppInviteDialogOpen: false })}
            title={t('SEND_INVITE_TO_JOIN_THE_APP', { appName })}
            onCloseRequest={() => this.setState({ sendAppInviteDialogOpen: false })}>
            <Text>{t('SEND_RESIDENT_APP_INVITE_DIALOG_DESCRIPTION', { fullName: selectedPerson.fullName, email: selectedPersonEmail })}</Text>
          </MsgBox>
        )}
        {cannotSendAppInviteDialogOpen && (
          <MsgBox
            open={cannotSendAppInviteDialogOpen}
            closeOnTapAway={false}
            id="cannotSendAppInviteDialog"
            lblOK={t('OK_GOT_IT')}
            hideCancelButton
            title={t('CANNOT_SEND_INVITE')}
            onCloseRequest={() => this.setState({ cannotSendAppInviteDialogOpen: false })}>
            <Text>{t('CANNOT_SEND_INVITE_DIALOG_DESCRIPTION', { fullName: selectedPerson.fullName, appName })}</Text>
          </MsgBox>
        )}

        {this.state.isClosePartyOpen && this.props.partyId && (
          <ClosePartyDialog
            open={this.state.isClosePartyOpen}
            partyId={this.props.partyId}
            onCloseRequest={() => this.setState({ isClosePartyOpen: false })}
            memberToRemoveOnClose={memberToRemoveOnClose}
          />
        )}

        {this.state.personAddedMsgBoxOpen && (
          <MsgBox
            id="personAlreadyAddedMsgBox"
            open={this.state.personAddedMsgBoxOpen}
            lblOK={t('OK_GOT_IT')}
            lblCancel=""
            onCloseRequest={() => this.setState({ personAddedMsgBoxOpen: false })}>
            <Text>{t('PERSON_ALREADY_ADDED_TO_PARTY')}</Text>
          </MsgBox>
        )}
        <MsgBox
          id="personAlreadyAddedMsgBox"
          open={dlgLimitOneGuarantor.isOpen}
          lblOK={t('OK_GOT_IT')}
          lblCancel=""
          title={t('LIMIT_ONE_PERSON')}
          onCloseRequest={dlgLimitOneGuarantor.close}>
          <Text>{t('ONLY_ONE_GUARANTOR_FOR_PARTY')}</Text>
        </MsgBox>
        {allowLinkMembers && this.state.isLinkPartyMemberOpen && (
          <LinkPartyMember
            open={this.state.isLinkPartyMemberOpen}
            onClose={this.onCloseLinkPartyMember}
            onCancel={this.onCloseLinkPartyMember}
            selectedPartyMember={this.state.selectedPartyMember}
            partyMembers={partyMembers.toArray()}
            onDone={this.onDoneLinkPartyMember}
            onRemoveLinkPartyMember={this.handleRemoveLinkPartyMember}
          />
        )}
        <MsgBox
          id="actionNotAllowedMsgBox"
          open={this.state.actionNotAllowedMsgBoxOpen}
          onCloseRequest={() => this.setState({ actionNotAllowedMsgBoxOpen: false })}
          lblOK={t('OK_GOT_IT')}
          lblCancel=""
          title={this.state.actionNotAllowedMsgBoxTitle}
          content={this.state.actionNotAllowedMsgBoxText}
        />
      </Section>
    );
  }
}
