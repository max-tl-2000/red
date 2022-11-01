/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { FullScreenDialog, DialogTitle, Section, Card, CardActions, Button, MsgBox, Typography as T } from 'components';

import { ChildrenCollection, ChildrenStore } from 'custom-components/PartyAdditionalInfo/Children';
import { PetCollection, PetStore } from 'custom-components/PartyAdditionalInfo/Pet';
import { VehicleCollection, VehicleStore } from 'custom-components/PartyAdditionalInfo/Vehicle';
import PartyMembersPanel from 'custom-components/PartyMembersPanel/PartyMembersPanel';
import CompanyCard from 'custom-components/Companies/CompanyCard';
import EditCompanyContextMenu from 'custom-components/Companies/EditCompanyContextMenu';
import AddCompanyDialog from 'custom-components/Companies/AddCompanyDialog';

import { t } from 'i18next';
import { addGuest, updatePartyMember, processPartyMemberLinkAction } from 'redux/modules/memberStore';
import { updateUnitFiltersBedrooms } from 'redux/modules/unitsFilter';
import { updateParty, enableUpdatePartyTypeAction } from 'redux/modules/partyStore';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import sleep from 'helpers/sleep';
import { updatePerson, mergePersons } from 'redux/modules/personsStore';
import { clearResults } from 'redux/modules/search';
import { demoteApplication } from 'redux/modules/quotes';
import isEqual from 'lodash/isEqual';
import mediator from 'helpers/mediator';
import Icon from '../../components/Icon/Icon';
import { cf } from './ManagePartyPage.scss';
import { client } from '../../apiClient';
import { areRequiredFieldsFilled } from '../../helpers/models/party';
import { isCorporateGroupProfile, getPartyTypeDisabledReason, getPartyMembersGroupedByType } from '../../../common/helpers/party-utils';
import { createQualificationQuestionsModel } from '../../helpers/models/qualificationQuestionsModel';
import {
  getPartyTimezone,
  getSummaryQualificationAnswers,
  getLeaseTermsForAssignedProperty,
  getPropertyAppSettings,
} from '../../redux/selectors/partySelectors';
import { areOccupantsAllowed, partyIsNotActive, getLeaseTypeQualificationAnswer } from '../../helpers/party';
import { DALTypes } from '../../../common/enums/DALTypes';
import QualificationQuestionsSummary from '../../custom-components/QualificationQuestions/QualificationQuestionsSummary';
import QualificationQuestions from '../../custom-components/QualificationQuestions/QualificationQuestions';
import eventTypes from '../../../common/enums/eventTypes';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { sendResidentAppInvite } from '../../redux/modules/personsStore';

@observer
export class ManagePartyPageComponent extends Component {
  static propTypes = {
    params: PropTypes.object,
    party: PropTypes.object,
    partyMembers: PropTypes.object,
    open: PropTypes.bool,
    ManagePartyPage: PropTypes.func,
    partyId: PropTypes.string,
    onNavigateToPersonPage: PropTypes.func,
    updatePerson: PropTypes.func,
    clearResults: PropTypes.func,
    properties: PropTypes.arrayOf(PropTypes.object),
    handleMergeParties: PropTypes.func,
    displayDuplicatePersonNotification: PropTypes.bool,
    isLeasePublishedOrExecuted: PropTypes.bool,
    isLeaseDraft: PropTypes.bool,
    isCorporateParty: PropTypes.bool,
    isActiveLeaseParty: PropTypes.bool,
    isNewLeaseParty: PropTypes.bool,
    isRenewalParty: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    const { party: { qualificationQuestions = {} } = {} } = props;
    const childrenModel = new ChildrenStore({ apiClient: client, partyId: props.partyId, loadItems: true });
    const petsModel = new PetStore({ apiClient: client, partyId: props.partyId, loadItems: true });
    const vehicleModel = new VehicleStore({ apiClient: client, partyId: props.partyId, loadItems: true });

    this.state = {
      childrenModel,
      petsModel,
      vehicleModel,
      isQualificationCardExpanded: false,
      openCompanyDialog: false,
      openUneditableCompanyDialog: false,
      openMissingCompanyNameDialog: false,
      qualificationQuestions,
      qualificationQuestionsModel: createQualificationQuestionsModel(qualificationQuestions),
    };
  }

  getAdditionalInfo = (e, { partyId, type }) => {
    if (partyId !== this.props.partyId) return;
    switch (type) {
      case AdditionalInfoTypes.CHILD:
        this.state.childrenModel.loadItems();
        break;
      case AdditionalInfoTypes.PET:
        this.state.petsModel.loadItems();
        break;
      case AdditionalInfoTypes.VEHICLE:
        this.state.vehicleModel.loadItems();
        break;
      default:
    }
  };

  componentWillUnmount() {
    mediator.off(eventTypes.PARTY_UPDATED, this.getAdditionalInfo);
  }

  matcherFunction({ resource }) {
    return resource.match(/_\/parties\//);
  }

  componentWillMount = () => {
    mediator.on(eventTypes.PARTY_UPDATED, this.getAdditionalInfo);
    this.loadPartyMembersGroupedByType(this.props);
  };

  componentWillReceiveProps = nextProps => {
    const { party: { qualificationQuestions = {} } = {}, open } = nextProps;
    this.setState({ qualificationQuestions });
    this.restoreQualificationQuestionsModel(qualificationQuestions);
    this.loadPartyMembersGroupedByType(nextProps);
    if (open && !this.props.open) {
      const corporatePartyMember = this.props.isCorporateParty && this.props.partyMembers.find(p => p.memberType === DALTypes.MemberType.RESIDENT);
      if (this.props.isCorporateParty && !corporatePartyMember?.displayName) this.setState({ openMissingCompanyNameDialog: true });
    }
  };

  loadPartyMembersGroupedByType = props => {
    const { residents, occupants, guarantors } = getPartyMembersGroupedByType(props.partyMembers);

    this.setState({
      residents,
      occupants,
      guarantors,
    });
  };

  handleQuestionsAnswered = (answers, filters) => this.setState({ qualificationQuestions: answers, storedUnitsFilters: filters });

  restoreQualificationQuestionsModel = qualificationQuestions => {
    const { qualificationQuestionsModel } = this.state;
    if (isEqual(qualificationQuestions, qualificationQuestionsModel.qualificationQuestions)) return;

    qualificationQuestionsModel.restoreData(qualificationQuestions);
  };

  tryEnableQualificationQuestionWarningMode = (enable = true) => {
    const { qualificationQuestionsModel } = this.state;
    const { party, partyMembers, quotePromotions } = this.props;
    const isWarningModeEnable = enable && qualificationQuestionsModel.shouldShowWarning;
    const allowOccupants = areOccupantsAllowed({ leaseType: qualificationQuestionsModel.leaseTypeForParty });
    const partyTypeDisabledReason = getPartyTypeDisabledReason(
      { id: party.id, partyMembers: partyMembers.toArray() },
      qualificationQuestionsModel.leaseTypeForParty,
      quotePromotions,
      allowOccupants,
    );
    isWarningModeEnable && partyTypeDisabledReason && this.props.enableUpdatePartyTypeAction(false, partyTypeDisabledReason);
    qualificationQuestionsModel.setWarningMode(isWarningModeEnable);
    return isWarningModeEnable;
  };

  handleSaveQuestionsRequest = () => {
    if (this.tryEnableQualificationQuestionWarningMode(true)) return;
    this.handleSaveQuestions();
  };

  handleSaveQuestions = async () => {
    const { qualificationQuestions, storedUnitsFilters, qualificationQuestionsModel } = this.state;
    const success = await this.props.updateParty({ id: this.props.partyId, qualificationQuestions, storedUnitsFilters });
    this.hideQualificationPanel(!success);
    success && qualificationQuestionsModel.updateInitialGroupProfile(qualificationQuestions.groupProfile);
    success && this.props.updateUnitFiltersBedrooms(qualificationQuestions.numBedrooms);
  };

  hideQualificationPanel = (isPanelExpanded = false) => {
    const { party: { qualificationQuestions = {} } = {} } = this.props;
    this.tryEnableQualificationQuestionWarningMode(false);
    this.restoreQualificationQuestionsModel(qualificationQuestions);
    this.setState({ isQualificationCardExpanded: isPanelExpanded, qualificationQuestions });
  };

  revealQualificationPanel = async () => {
    this.setState({ isQualificationCardExpanded: true });
    // why is the delay needed?
    await sleep(300);
  };

  renderRevealingQualificationQuestions = () => {
    const { isQualificationCardExpanded, qualificationQuestions } = this.state;
    const { party, isRenewalParty } = this.props;
    const readOnly = partyIsNotActive(party);

    return (
      <div style={{ minWidth: '55%' }}>
        {!isQualificationCardExpanded && (
          <Button data-id="updateAnswersButton" type="flat" label={t('UPDATE_ANSWERS')} onClick={this.revealQualificationPanel} />
        )}
        <Card container={false} className={cf('card', { open: isQualificationCardExpanded, corporate: isCorporateGroupProfile(qualificationQuestions) })}>
          <QualificationQuestions
            timezone={this.props.timezone}
            onQuestionsAnswered={this.handleQuestionsAnswered}
            onSubmitAction={this.handleSaveQuestions}
            model={this.state.qualificationQuestionsModel}
            leaseTerms={this.props.leaseTerms}
            readOnly={readOnly}
            isRenewalParty={isRenewalParty}
          />
          <CardActions textAlign="right">
            <Button
              id="cancelQualificationQuestionsBtn"
              label={t('CANCEL')}
              btnRole="secondary"
              type="flat"
              onClick={() => this.hideQualificationPanel(false)}
            />
            <Button
              id="updateQualificationQuestionsBtn"
              disabled={!areRequiredFieldsFilled(qualificationQuestions, isRenewalParty)}
              label={t('DONE')}
              type="flat"
              onClick={this.handleSaveQuestionsRequest}
            />
          </CardActions>
        </Card>
      </div>
    );
  };

  handleAddGuest = async (guest, partyId) => {
    const isExistingPerson = !!guest.personId;

    await this.props.addGuest(guest, partyId);
    if (isExistingPerson && !this.props.isCorporateParty) {
      await this.props.handleMergeParties({ personId: guest.personId });
    }
  };

  handleMergePersons = async mergeData => {
    const mergeResult = await this.props.mergePersons(mergeData);

    if (!mergeResult.error) {
      const resultPersonId = mergeResult.data.id;
      this.props.closeCreateEditResidentForm();
      !this.props.isCorporateParty && this.props.handleMergeParties({ personId: resultPersonId });
    }
  };

  getMemberToOpen = (panelMemberType, member) => (member && member.memberType === panelMemberType ? member : null);

  handlePersonUpdate = (...args) => {
    const { props } = this;
    props.updatePerson && props.updatePerson(...args);
    props.onPersonUpdate && props.onPersonUpdate();
  };

  renderMembersPanel = ({
    memberType,
    panelMembers,
    allowLinkMembers,
    displayDuplicatePersonNotification,
    isActiveLeaseParty,
    id,
    partyClosedOrArchived,
    companyName,
    corporatePartyMember,
  }) => {
    const isPartyInActiveState = this.props.party.workflowState === DALTypes.WorkflowState.ACTIVE;
    return (
      <PartyMembersPanel
        id={id}
        isPartyInActiveState={isPartyInActiveState}
        memberType={memberType}
        partyId={this.props.partyId}
        panelMembers={panelMembers}
        partyMembers={this.props.partyMembers}
        quotePromotions={this.props.quotePromotions}
        addGuest={this.handleAddGuest}
        updatePerson={this.handlePersonUpdate}
        mergePersons={this.handleMergePersons}
        updatePartyMember={this.props.updatePartyMember}
        processPartyMemberLinkAction={this.props.processPartyMemberLinkAction}
        demoteApplication={this.props.demoteApplication}
        allowLinkMembers={allowLinkMembers}
        onNavigateToPersonPage={this.props.onNavigateToPersonPage}
        memberToOpen={this.getMemberToOpen(memberType, this.props.memberToOpen)}
        displayDuplicatePersonNotification={displayDuplicatePersonNotification}
        isLeasePublishedOrExecuted={this.props.isLeasePublishedOrExecuted}
        isLeaseDraft={this.props.isLeaseDraft}
        enableAdvancedActions={!this.props.isCorporateParty}
        isCorporateParty={this.props.isCorporateParty}
        isActiveLeaseParty={isActiveLeaseParty}
        partyClosedOrArchived={partyClosedOrArchived}
        sendResidentAppInvite={this.props.sendResidentAppInvite}
        propertyAppSettings={this.props.propertyAppSettings}
        isNewLeaseParty={this.props.isNewLeaseParty}
        company={companyName}
        corporatePartyMember={corporatePartyMember}
      />
    );
  };

  handleOpenAddCompanyDialog = shouldOpenDialog => {
    this.setState({ openCompanyDialog: shouldOpenDialog });
  };

  handleOpenUneditableCompanyDialog = shouldOpenDialog => {
    this.setState({ openUneditableCompanyDialog: shouldOpenDialog });
  };

  handleOpenMissingCompanyNameDialog = shouldOpenDialog => {
    this.setState({ openMissingCompanyNameDialog: shouldOpenDialog });
  };

  handleContextMenuAction = () => {
    const { isActiveLeaseParty } = this.props;
    this.setState({ contextOpen: false });
    isActiveLeaseParty ? this.handleOpenUneditableCompanyDialog(true) : this.handleOpenAddCompanyDialog(true);
  };

  renderContextMenu = () => (
    <EditCompanyContextMenu
      defaultActions={true}
      open={this.state.contextOpen}
      onSelect={this.handleContextMenuAction}
      positionArgs={{
        my: 'left top',
        at: 'left top',
        of: this.state.trigger,
      }}
      onCloseRequest={this.closeContextMenu}
      editLabel={t('EDIT_COMPANY_DETAILS')}
    />
  );

  showContextMenu = (e, item) => {
    e.preventDefault();
    this.setState({ trigger: e.target, editingItem: item, contextOpen: true });
  };

  renderCompanySection = partyMember => {
    const companyName = partyMember?.displayName;
    const companyId = partyMember?.companyId;

    return (
      <Section title={t('COMPANY_DETAILS')} data-id="companySection">
        {!companyName && (
          <div>
            <div className={cf('missingCompanyContent')}>
              <Icon name="alert" className={cf('alert-icon')} />
              <T.Text className={cf('missingCompanyText')}>{t('COMPANY_DETAILS_LABEL')}</T.Text>
            </div>
            <Button data-id="addCompanyBtn" btnRole={'primary'} type={'flat'} label={t('ADD_COMPANY')} onClick={() => this.handleOpenAddCompanyDialog(true)} />
          </div>
        )}
        {companyName && <CompanyCard companyId={companyId} companyName={companyName} pointOfContact={partyMember} onItemSelected={this.showContextMenu} />}
        {this.renderContextMenu()}
      </Section>
    );
  };

  render() {
    const { residents, occupants, guarantors, childrenModel, vehicleModel, isQualificationCardExpanded, petsModel } = this.state;
    const {
      open,
      party,
      onCloseRequest,
      qualificationAnswers,
      displayDuplicatePersonNotification,
      isLeasePublishedOrExecuted,
      isLeaseDraft,
      isCorporateParty,
      isActiveLeaseParty,
      isNewLeaseParty,
      isRenewalParty,
      partyClosedOrArchived,
      handleSaveCompany,
      handleLoadSuggestions,
      handleUpdatePartyMember,
    } = this.props;
    const allowLinkMembers = !isCorporateParty && !!guarantors.length;
    const allowOccupants = areOccupantsAllowed(party);
    const leaseTypeQualificationAnswer = getLeaseTypeQualificationAnswer(qualificationAnswers);
    const leaseTypeQualificationQuestion = { groupProfile: party.qualificationQuestions.groupProfile };

    const corporatePartyMember = isCorporateParty && this.props.partyMembers.find(p => p.memberType === DALTypes.MemberType.RESIDENT);
    const company = corporatePartyMember?.companyId && { id: corporatePartyMember?.companyId, displayName: corporatePartyMember?.displayName };

    return (
      <FullScreenDialog
        id="manage-party-details-dialog"
        open={open}
        onCloseRequest={onCloseRequest}
        title={[
          <DialogTitle lighter key="title">
            {t('MANAGE_PARTY_DETAILS')}
          </DialogTitle>,
        ]}>
        <div style={{ paddingBottom: 60 }}>
          {isNewLeaseParty && (
            <Section title={t('QUALIFICATION_QUESTIONS')}>
              {!isQualificationCardExpanded && <QualificationQuestionsSummary qualificationAnswers={qualificationAnswers} />}
              <div className={cf('cards-section')}>{this.renderRevealingQualificationQuestions(party.qualificationQuestions)}</div>
            </Section>
          )}
          {isRenewalParty && (
            <Section title={t('QUALIFICATION_QUESTIONS')}>
              {!isQualificationCardExpanded && <QualificationQuestionsSummary qualificationAnswers={leaseTypeQualificationAnswer} />}
              <div className={cf('cards-section')}>{this.renderRevealingQualificationQuestions(leaseTypeQualificationQuestion)}</div>
            </Section>
          )}
          {isCorporateParty && corporatePartyMember && this.renderCompanySection(corporatePartyMember)}
          {this.renderMembersPanel({
            memberType: DALTypes.MemberType.RESIDENT,
            panelMembers: residents,
            allowLinkMembers,
            displayDuplicatePersonNotification,
            id: 'residentsSection',
            isActiveLeaseParty,
            partyClosedOrArchived,
            companyName: corporatePartyMember?.displayName,
            corporatePartyMember,
          })}
          {allowOccupants &&
            this.renderMembersPanel({
              memberType: DALTypes.MemberType.OCCUPANT,
              panelMembers: occupants,
              allowLinkMembers,
              displayDuplicatePersonNotification,
              id: 'occupantsSection',
              isActiveLeaseParty,
              partyClosedOrArchived,
            })}
          {!isCorporateParty &&
            this.renderMembersPanel({
              memberType: DALTypes.MemberType.GUARANTOR,
              panelMembers: guarantors,
              allowLinkMembers,
              displayDuplicatePersonNotification,
              id: 'guarantorsSection',
              isActiveLeaseParty,
              partyClosedOrArchived,
            })}
          <Section title={t('MINORS')} data-id="childSection">
            <ChildrenCollection
              viewModel={childrenModel}
              useRevealingPanel={true}
              restrictAddOrRemoveItems={isActiveLeaseParty || partyClosedOrArchived}
              partyClosedOrArchived={partyClosedOrArchived}
            />
          </Section>
          <Section title={t('PETS_AND_ASSISTANCE_ANIMALS')} data-id="petSection">
            <PetCollection
              viewModel={petsModel}
              useRevealingPanel={true}
              restrictAddOrRemoveItems={isLeasePublishedOrExecuted || isLeaseDraft || isActiveLeaseParty || partyClosedOrArchived}
              isLeaseDraft={isLeaseDraft}
              isLeasePublishedOrExecuted={isLeasePublishedOrExecuted}
              partyClosedOrArchived={partyClosedOrArchived}
            />
          </Section>
          <Section title={t('VEHICLE_plural')} data-id="vehicleSection">
            <VehicleCollection
              viewModel={vehicleModel}
              useRevealingPanel={true}
              restrictAddOrRemoveItems={isActiveLeaseParty || partyClosedOrArchived}
              partyClosedOrArchived={partyClosedOrArchived}
            />
          </Section>
        </div>
        {isCorporateParty && this.state.openCompanyDialog && (
          <AddCompanyDialog
            open={this.state.openCompanyDialog}
            companyId={corporatePartyMember?.companyId}
            companyName={corporatePartyMember?.displayName}
            partyMember={corporatePartyMember}
            companySuggestions={company ? [company] : []}
            handleShowDialog={this.handleOpenAddCompanyDialog}
            handleSaveCompany={handleSaveCompany}
            handleLoadSuggestions={handleLoadSuggestions}
            handleUpdatePartyMember={handleUpdatePartyMember}
          />
        )}
        {this.state.openUneditableCompanyDialog && (
          <MsgBox
            open={this.state.openUneditableCompanyDialog}
            onCloseRequest={() => this.handleOpenUneditableCompanyDialog(false)}
            onOKClick={() => this.handleOpenUneditableCompanyDialog(false)}
            lblOK={t('OK_GOT_IT')}
            lblCancel=""
            title={t('CANNOT_EDIT_COMPANY_DETAILS')}
            content={t('CANNOT_EDIT_COMPANY_DETAILS_MESSAGE')}
          />
        )}

        {this.state.openMissingCompanyNameDialog && (
          <MsgBox
            open={this.state.openMissingCompanyNameDialog}
            onCloseRequest={() => this.handleOpenMissingCompanyNameDialog(false)}
            onOKClick={() => this.handleOpenMissingCompanyNameDialog(false)}
            lblOK={t('MANAGE_PARTY_LINK_MSG')}
            title={t('MISSING_COMPANY_NAME_TITLE')}
            content={t('MISSING_COMPANY_NAME_MESSAGE')}
          />
        )}
      </FullScreenDialog>
    );
  }
}

export default connect(
  (state, props) => ({
    userToken: state.auth.token,
    qualificationAnswers: getSummaryQualificationAnswers(state, props),
    quotePromotions: state.dataStore.get('quotePromotions'),
    leaseTerms: getLeaseTermsForAssignedProperty(state, props),
    timezone: getPartyTimezone(state, props),
    propertyAppSettings: getPropertyAppSettings(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        addGuest,
        updateParty,
        updatePerson,
        mergePersons,
        updatePartyMember,
        clearResults,
        demoteApplication,
        processPartyMemberLinkAction,
        enableUpdatePartyTypeAction,
        updateUnitFiltersBedrooms,
        sendResidentAppInvite,
      },
      dispatch,
    ),
)(ManagePartyPageComponent);
