/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { Radio, Icon, MsgBox, PreloaderBlock, FormattedMarkdown, RedTable, Typography } from 'components';
import { PUBLISH_STATUSES, closePublishLeaseDialog, emailLease } from 'redux/modules/leaseStore';
import groupBy from 'lodash/groupBy';
import remove from 'lodash/remove';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';
import { cf } from './PublishLeaseDialog.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { windowOpen } from '../../helpers/win-open';

const { Table, Row, RowHeader, Cell, TextPrimary, SubTitle } = RedTable;

const { Text } = Typography;

@connect(
  state => ({
    publishLeaseOpen: state.leaseStore.publishLeaseOpen,
    publishStatus: state.leaseStore.publishStatus,
  }),
  dispatch =>
    bindActionCreators(
      {
        closePublishLeaseDialog,
        emailLease,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
export default class PublishLeaseDialog extends Component {
  static propTypes = {
    lease: PropTypes.object,
    quote: PropTypes.object,
    partyMembers: PropTypes.array,
    publishLeaseOpen: PropTypes.bool,
    publishStatus: PropTypes.string,
    closeLeaseForm: PropTypes.func,
    leasingNavigator: PropTypes.object,
  };

  constructor(props) {
    super(props);

    const initialState = {};
    props.partyMembers.forEach(partyMember => {
      initialState[partyMember.id] = !!partyMember.person.contactInfo.defaultEmail;
    });
    this.state = initialState;
  }

  openInNewTab = personId => {
    const { lease, leasingNavigator } = this.props;
    const { id: leaseId, partyId } = lease;

    leasingNavigator.navigateToParty(partyId, { leaseId, personId, addOrigin: true, newTab: true });
  };

  sendSignLeaseMail = partyMemberIds => {
    const { id: leaseId, partyId } = this.props.lease;
    this.props.emailLease(partyId, leaseId, partyMemberIds);
  };

  onPublishClicked = () => {
    const { publishStatus, doesLeaseProviderHandleEDocuments, leaseProviderLoginUrl } = this.props;

    if (!doesLeaseProviderHandleEDocuments) {
      const allMembers = Object.keys(this.state);
      const membersWithEmailSelected = remove(allMembers, key => this.state[key]);

      allMembers.forEach(memberId => this.openInNewTab(memberId));
      if (membersWithEmailSelected.length) {
        this.sendSignLeaseMail(membersWithEmailSelected);
      }
    } else if (publishStatus === PUBLISH_STATUSES.SUCCESS) {
      windowOpen(leaseProviderLoginUrl);
    }

    this.onCloseDialog();
  };

  onCloseDialog = () => {
    const { closeLeaseForm } = this.props;
    this.props.closePublishLeaseDialog();
    closeLeaseForm && closeLeaseForm(true);
  };

  renderMemberTypeRow = memberType => {
    let memberTypeTitle;
    switch (memberType) {
      case DALTypes.MemberType.RESIDENT:
        memberTypeTitle = t('RESIDENTS');
        break;
      case DALTypes.MemberType.GUARANTOR:
        memberTypeTitle = t('GUARANTORS');
        break;
      case DALTypes.MemberType.OCCUPANT:
        memberTypeTitle = t('OCCUPANTS');
        break;
      default:
        memberTypeTitle = '';
    }

    return (
      <Row key={memberType} noDivider>
        <Cell noSidePadding>
          <SubTitle>{memberTypeTitle}</SubTitle>
        </Cell>
      </Row>
    );
  };

  renderMemberRow = member => {
    const key = member.id;
    const missingEmail = !member.person.contactInfo.defaultEmail;

    return (
      <Row key={key} noDivider>
        <Cell noSidePadding>
          <TextPrimary>{member.person.fullName}</TextPrimary>
        </Cell>
        <Cell noSidePadding width={90}>
          <Radio checked={this.state[key]} disabled={missingEmail} onChange={() => this.setState({ [key]: !this.state[key] })} />
        </Cell>
        <Cell noSidePadding width={90}>
          <Radio checked={!this.state[key]} onChange={() => this.setState({ [key]: !this.state[key] })} />
        </Cell>
      </Row>
    );
  };

  renderPublishLeaseSuccess = () => {
    const { partyMembers, doesLeaseProviderHandleEDocuments } = this.props;

    if (doesLeaseProviderHandleEDocuments) {
      return (
        <div id="publishStatusSuccess">
          <FormattedMarkdown>{`${t('PUBLISH_BLUEMOON_LEASE_DETAILS')}`}</FormattedMarkdown>
        </div>
      );
    }

    const tableRows = [];

    const groupedPartyMembers = groupBy(partyMembers, 'memberType');
    Object.keys(groupedPartyMembers).forEach(memberType => {
      tableRows.push(this.renderMemberTypeRow(memberType));
      groupedPartyMembers[memberType].forEach(member => tableRows.push(this.renderMemberRow(member)));
    });

    return (
      <div id="publishStatusSuccess">
        <FormattedMarkdown>{`${t('PUBLISH_LEASE_DETAILS')}`}</FormattedMarkdown>
        <Table wide>
          <RowHeader>
            <Cell noSidePadding />
            <Cell noSidePadding width={90}>
              <SubTitle>{t('PUBLISH_LEASE_EMAIL')}</SubTitle>
            </Cell>
            <Cell noSidePadding width={90}>
              <SubTitle>{t('PUBLISH_LEASE_IN_OFFICE')}</SubTitle>
            </Cell>
          </RowHeader>
          {tableRows}
        </Table>
      </div>
    );
  };

  renderPublishLeaseInProgress = () => {
    const { doesLeaseProviderHandleEDocuments } = this.props;

    if (doesLeaseProviderHandleEDocuments) return <PreloaderBlock />;

    return (
      <div>
        <PreloaderBlock message={t('PUBLISH_LEASE_PUBLISHING')} />
        <div className={cf('publishing-state')}>
          <Text>{t('PUBLISH_LEASE_INFORMATION')}</Text>
          <Text>{t('PUBLISH_LEASE_DONT_CLOSE_THIS_WINDOW')}</Text>
        </div>
      </div>
    );
  };

  getPublishLeaseDialogTitle = () => {
    const { doesLeaseProviderHandleEDocuments, publishStatus } = this.props;

    if (doesLeaseProviderHandleEDocuments) return publishStatus === PUBLISH_STATUSES.SUCCESS ? t('LEASE_DETAILS_SENT') : t('PUBLISH_LEASE');

    return t('PUBLISH_AND_SEND_LEASE');
  };

  render = () => {
    const { publishLeaseOpen, publishStatus, doesLeaseProviderHandleEDocuments } = this.props;

    let okLabel = t('SEND_LEASE_NOW');
    let cancelLabel = t('SEND_LATER');
    if (doesLeaseProviderHandleEDocuments) {
      if (publishStatus === PUBLISH_STATUSES.FAILURE) {
        okLabel = t('OK_GOT_IT');
        cancelLabel = '';
      } else {
        okLabel = t('GO_TO_BLUEMOON');
        cancelLabel = t('FINISH_LATER');
      }
    }
    return (
      <MsgBox
        id="publishLeaseDialog"
        key="publishLeaseDialog"
        open={publishLeaseOpen}
        overlayClassName={cf('publish-lease-dialog')}
        title={this.getPublishLeaseDialogTitle()}
        lblOK={okLabel}
        btnOKDisabled={publishStatus === PUBLISH_STATUSES.ONGOING || (publishStatus === PUBLISH_STATUSES.FAILURE && !doesLeaseProviderHandleEDocuments)}
        lblCancel={cancelLabel}
        btnCancelDisabled={publishStatus === PUBLISH_STATUSES.ONGOING}
        onOKClick={this.onPublishClicked}
        onCloseRequest={() => this.onCloseDialog()}>
        {do {
          if (publishStatus === PUBLISH_STATUSES.ONGOING) {
            this.renderPublishLeaseInProgress();
          } else if (publishStatus === PUBLISH_STATUSES.FAILURE) {
            <div className={cf('error-section')}>
              <Text>{t('PUBLISH_LEASE_ERROR')}</Text>
              <div className={cf('icon-wrapper')}>
                <Icon name="alert" style={{ width: 64, height: 64 }} />
              </div>
            </div>;
          } else if (publishStatus === PUBLISH_STATUSES.SUCCESS) {
            this.renderPublishLeaseSuccess();
          }
        }}
      </MsgBox>
    );
  };
}
