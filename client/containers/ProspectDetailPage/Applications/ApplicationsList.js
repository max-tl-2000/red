/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import GroupTitle from 'components/Table/GroupTitle';
import { getImpersonationToken, processPartyMemberLinkAction } from 'redux/modules/memberStore';
import { waiveApplicationFee } from 'redux/modules/application';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import snackbar from 'helpers/snackbar/snackbar';
import pick from 'lodash/pick';
import { windowOpen } from 'helpers/win-open';
import { MsgBox, FormattedMarkdown, TextBox } from 'components';
import LinkPartyMember from 'custom-components/PartyMembersPanel/LinkPartyMember';
import { updatePersonApplication } from 'redux/modules/partyStore';
import { sendCommunication } from 'redux/modules/communication';
import { getDisplayName, getEnhancedPerson } from '../../../../common/helpers/person-helper';
import { getPartyMembersGroupedByType } from '../../../../common/helpers/party-utils';
import { getApplyNowUrl, getEditApplicationUrl } from '../../../helpers/resolve-url';
import { DALTypes } from '../../../../common/enums/DALTypes';
import ApplicationCard from './ApplicationCard';
import { isApplicationPaid } from '../../../../common/helpers/applicants-utils';
import { areOccupantsAllowed } from '../../../helpers/party';
import { getPersonIdsWithQuoteComms } from '../../../helpers/quotes';
import SetSsnDialog from './SetSsnDialog';
import { TemplateNames } from '../../../../common/enums/templateTypes';
import { CommunicationContext } from '../../../../common/enums/communicationTypes';

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        getImpersonationToken,
        waiveApplicationFee,
        processPartyMemberLinkAction,
        updatePersonApplication,
        sendCommunication,
      },
      dispatch,
    ),
)
export default class ApplicationsList extends Component {
  static propTypes = {
    partyMembers: PropTypes.object,
    communications: PropTypes.object,
    propertiesAssignedToParty: PropTypes.array,
    party: PropTypes.object,
    partyIsCorporate: PropTypes.bool,
  };

  constructor() {
    super();
    this.state = {
      openWaiveApplicationFeeDialog: false,
      isLinkPartyMemberOpen: false,
      isSetSsnDialogOpen: false,
      feeWaiverReason: '',
    };
  }

  componentWillMount = () => {
    this.loadPartyMembersGroupedByType(this.props);
  };

  componentWillReceiveProps = nextProps => {
    this.loadPartyMembersGroupedByType(nextProps);
  };

  loadPartyMembersGroupedByType = props => {
    const { residents, occupants, guarantors } = getPartyMembersGroupedByType(props.partyMembers);

    this.setState({
      residents,
      occupants,
      guarantors,
    });
  };

  handleApplicationByAgent = async (member, propertyId, getApplicationUrl) => {
    try {
      const token = await this.props.getImpersonationToken(member, propertyId);
      const rentAppUrl = getApplicationUrl && getApplicationUrl(token);
      windowOpen(rentAppUrl);
    } catch (err) {
      console.error({ text: err.token || err.message });
    }
  };

  handleApplyOnBehalfOf = (member, propertyId) => this.handleApplicationByAgent(member, propertyId, getApplyNowUrl);

  handleEditApplication = (member, propertyId) => this.handleApplicationByAgent(member, propertyId, getEditApplicationUrl);

  handleOpenWaiveApplicationDialog = open => {
    const state = { openWaiveApplicationFeeDialog: open };
    if (!open) {
      state.feeWaiverReason = '';
    }
    this.setState({ ...state });
  };

  handleUpdateWaiverStatus = (isApplicationFeeWaived, personApplicationId, member) => {
    this.setState({ personApplicationId, member });
    this.handleOpenWaiveApplicationDialog(!isApplicationFeeWaived);
    const {
      party: { id },
    } = this.props;
    isApplicationFeeWaived &&
      this.props.waiveApplicationFee({
        partyId: id,
        partyMemberId: member.id,
        isFeeWaived: !isApplicationFeeWaived,
        feeWaiverReason: this.state.feeWaiverReason,
        personApplicationId,
      });
  };

  handleLinkPartyMember = personId => {
    const enhancedPerson = getEnhancedPerson(this.props.partyMembers, personId);
    this.setState({ isLinkPartyMemberOpen: true, selectedPartyMember: enhancedPerson });
  };

  handleOpenSetSsn = application => {
    this.setState({ isSetSsnDialogOpen: true, application });
  };

  handleEnableSendSsn = async (application = {}) => {
    const { partyId, personId } = application;
    const sendSsnEnabled = !application.sendSsnEnabled;
    await this.props.updatePersonApplication({ partyId, personId, sendSsnEnabled });
  };

  renderApplicationCards = (members, propertiesAssignedToParty) => {
    const personIdsWithQuoteComms = getPersonIdsWithQuoteComms(this.props.communications);
    return members.map((member, index) => {
      // ToDo: this should be QUOTE comms, not any comm!  This will mistakenly include inbound comms too!
      const rowId = `${member.memberType}${index + 1}`;
      const memberHasComm = personIdsWithQuoteComms.includes(member.personId);
      return (
        <ApplicationCard
          rowId={rowId}
          key={member.id}
          guest={member}
          hasQuoteComm={memberHasComm}
          onApplyOnBehalfOf={this.handleApplyOnBehalfOf}
          onEditApplication={this.handleEditApplication}
          sendIndividualApplicationInvitation={this.handleSendIndividualApplicationInvitation}
          onWaiveApplicationFee={this.handleUpdateWaiverStatus}
          propertiesAssignedToParty={propertiesAssignedToParty}
          screeningRequired={this.props.party.screeningRequired}
          onLinkPartyMember={this.handleLinkPartyMember}
          showRevaAdminOptions={this.props.showRevaAdminOptions}
          onOpenSetSsn={this.handleOpenSetSsn}
          onEnableSendSsn={this.handleEnableSendSsn}
        />
      );
    });
  };

  getFormattedContactInfo = contactInfo => pick(contactInfo, ['id', 'type', 'value']);

  handleSendIndividualApplicationInvitation = async (contactDetails, guest, propertyId) => {
    const {
      partyId,
      person: { fullName, id: personId },
    } = guest;
    const contactInfo = this.getFormattedContactInfo(contactDetails);
    contactInfo.fullName = fullName;

    const context = contactInfo.type === DALTypes.ContactInfoType.EMAIL ? CommunicationContext.PREFER_EMAIL : CommunicationContext.PREFER_SMS;
    const results = await this.props.sendCommunication(partyId, {
      templateName: TemplateNames.AGENT_TO_RESIDENT_APPLICATION_INVITE_TEMPLATE,
      personIds: [personId],
      context,
      templateArgs: { propertyId },
      communicationCategory: DALTypes.CommunicationCategory.APPLICATION_INVITE,
    });

    if (results.some(({ errors }) => errors.length)) {
      snackbar.show({ text: t('TEMPLATE_LOADING_FAILURE') });
    }
  };

  executeWaiveApplication = () => {
    const { personApplicationId, member, feeWaiverReason } = this.state;
    const {
      party: { id: partyId },
    } = this.props;
    this.handleOpenWaiveApplicationDialog(false);
    this.props.waiveApplicationFee({
      partyId,
      partyMemberId: member.id,
      isFeeWaived: true,
      feeWaiverReason,
      personApplicationId,
    });
  };

  onCloseLinkPartyMember = () => this.setState({ isLinkPartyMemberOpen: false });

  onDoneLinkPartyMember = list => {
    const { selectedPartyMember } = this.state;
    const {
      party: { id: partyId },
    } = this.props;
    this.setState({ isLinkPartyMemberOpen: false });
    this.props.processPartyMemberLinkAction(partyId, selectedPartyMember, list, DALTypes.ManageMembersActions.LINK);
  };

  atLeastOnePersonApplicationWasPaid = partyMembers =>
    partyMembers.toArray().some(member => {
      const application = member.application || {};
      return isApplicationPaid(application);
    });

  renderMembersSection = (members = [], propertiesAssignedToParty = []) => {
    if (!members.length) return <noscript />;

    const { memberType } = members[0];
    return (
      <div>
        <GroupTitle id={`${memberType.toLowerCase()}GroupSection`}>{t(memberType.toUpperCase(), { count: 2 })}</GroupTitle>
        {this.renderApplicationCards(members, propertiesAssignedToParty)}
      </div>
    );
  };

  onCloseSetSsnDialog = () => this.setState({ isSetSsnDialogOpen: false });

  handleOnReasonChange = ({ value }) => {
    this.setState({ feeWaiverReason: value });
  };

  render({ partyMembers, party } = this.props) {
    const { residents, occupants, guarantors, isSetSsnDialogOpen, application, feeWaiverReason } = this.state;
    const assignedProperty = this.props.propertiesAssignedToParty.find(property => property.id === party.assignedPropertyId);
    const properties = this.atLeastOnePersonApplicationWasPaid(partyMembers) ? [assignedProperty] : this.props.propertiesAssignedToParty;
    const propertiesAssignedToParty = properties.filter(p => p);
    const allowOccupants = areOccupantsAllowed(party);

    return (
      <div>
        {this.renderMembersSection(residents, propertiesAssignedToParty)}
        {allowOccupants && this.renderMembersSection(occupants, propertiesAssignedToParty)}
        {this.renderMembersSection(guarantors, propertiesAssignedToParty)}
        {this.state.member && (
          <MsgBox
            id="waiveApplicationFeeDialog"
            key="waiveApplicationFeeDialog"
            open={this.state.openWaiveApplicationFeeDialog}
            title={t('WAIVE_APPLICATION_DIALOG_TITLE', { memberName: getDisplayName(this.state.member.person) })}
            lblOK={t('WAIVE_APPLICATION_EXECUTE')}
            onOKClick={this.executeWaiveApplication}
            btnOKDisabled={!feeWaiverReason}
            lblCancel={t('CANCEL')}
            onCloseRequest={() => this.handleOpenWaiveApplicationDialog(false)}>
            {
              <div>
                <FormattedMarkdown>{t('WAIVE_APPLICATION_DIALOG_TEXT')}</FormattedMarkdown>
                <TextBox
                  multiline
                  numRows={1}
                  autoResize={false}
                  value={feeWaiverReason}
                  id="waiver-reason"
                  onChange={this.handleOnReasonChange}
                  label={t('REASON_FOR_WAIVER')}
                  wide
                  showClear
                  required
                  autoFocus
                />
              </div>
            }
          </MsgBox>
        )}
        {this.state.isLinkPartyMemberOpen && (
          <LinkPartyMember
            open={this.state.isLinkPartyMemberOpen}
            onClose={this.onCloseLinkPartyMember}
            onCancel={this.onCloseLinkPartyMember}
            selectedPartyMember={this.state.selectedPartyMember}
            partyMembers={partyMembers.toArray()}
            onDone={this.onDoneLinkPartyMember}
          />
        )}
        {isSetSsnDialogOpen && (
          <SetSsnDialog
            isSetSsnDialogOpen={isSetSsnDialogOpen}
            onDialogClosed={this.onCloseSetSsnDialog}
            onCancel={this.onCloseSetSsnDialog}
            application={application}
          />
        )}
      </div>
    );
  }
}
