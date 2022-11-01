/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { t } from 'i18next';
import { inject } from 'mobx-react';
import React, { Component } from 'react';
import { CardMenu, CardMenuItem, Typography as T, MsgBox, FormattedMarkdown } from 'components';
import { exportParty } from 'redux/modules/partyStore';
import { addActivityLog } from 'redux/modules/activityLogStore';
import { voidExecutedLease, closeVoidExecutedLeaseDialog, downloadLeaseDocument } from 'redux/modules/leaseStore';
import { DALTypes } from '../../../common/enums/DALTypes';
import { ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';

const { Text } = T;
const leaseStatus = { AVAILABLE: 'available to download', NOT_AVAILABLE: 'not available to download' };
const downloadStatus = { SUCCESFUL: 'succesful', FAILED: 'failed' };

@connect(
  state => ({
    voidExecutedLeaseFailed: state.leaseStore.voidExecutedLeaseFailed,
    navigateToPartyId: state.leaseStore.navigateToPartyId,
    isMoveInAlreadyConfirmed: state.leaseStore.isMoveInAlreadyConfirmed,
  }),
  dispatch =>
    bindActionCreators(
      {
        downloadLeaseDocument,
        exportParty,
        addActivityLog,
        voidExecutedLease,
        closeVoidExecutedLeaseDialog,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
export class ActiveLeaseSectionMenu extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isLeaseNotAvailableForDownloadDialogOpen: false,
      isInitiateMoveoutDialogOpen: false,
      isInitiateTransferDialogOpen: false,
      isCannotVoidLeaseDialogOpen: false,
      isLeaseNotExecutedDialogOpen: false,
      isVoidExecutedLeaseDialogOpen: false,
      isUnavailableVoidLeaseBySeedPartyDialog: false,
    };
  }

  componentWillReceiveProps = nextProps => {
    const { navigateToPartyId, isMoveInAlreadyConfirmed } = nextProps;
    const { leasingNavigator } = this.props;

    if (isMoveInAlreadyConfirmed && !this.props.isMoveInAlreadyConfirmed) {
      this.toggleCannotVoidLeaseDialog();
    }

    if (navigateToPartyId && navigateToPartyId !== this.props.navigateToPartyId) {
      leasingNavigator.navigateToParty(navigateToPartyId);
    }
  };

  downloadLease = () => {
    const { leaseId, currentLeaseStatus, hasDigitallySignedDocument, activeLeasePartyId, partyIsRenewal } = this.props;

    if (!leaseId) {
      this.setState({
        isLeaseNotAvailableForDownloadDialogOpen: true,
        dialogText: t('LEASE_NOT_AVAILABLE_FOR_DOWNLOAD_MSG'),
      });
      !partyIsRenewal && this.props.addActivityLog({ id: activeLeasePartyId, leaseStatus: leaseStatus.NOT_AVAILABLE }, ACTIVITY_TYPES.UPDATE);
      return;
    }

    if (!hasDigitallySignedDocument) {
      // there are two reasons we might not have a digitally signed document:
      // 1) the lease was imported and not created in Reva
      // 2) The lease was created in Reva but only has wet-signed envelopes
      // case 2 was handled above (no leaseId), so we can assume it was wet-signed
      this.setState({
        isLeaseNotAvailableForDownloadDialogOpen: true,
        dialogText: t('WETSIGNED_NOT_AVAILABLE_FOR_DOWNLOAD_MSG'),
      });
      !partyIsRenewal && this.props.addActivityLog({ id: activeLeasePartyId, leaseStatus: leaseStatus.NOT_AVAILABLE }, ACTIVITY_TYPES.UPDATE);
      return;
    }

    if (currentLeaseStatus !== DALTypes.LeaseStatus.EXECUTED) {
      this.setState({
        isLeaseNotAvailableForDownloadDialogOpen: true,
        dialogText: t('LEASE_NOT_EXECUTED_MSG'),
      });
      !partyIsRenewal && this.props.addActivityLog({ id: activeLeasePartyId, leaseStatus: leaseStatus.NOT_AVAILABLE }, ACTIVITY_TYPES.UPDATE);
      return;
    }
    this.props.downloadLeaseDocument(leaseId);

    !partyIsRenewal &&
      this.props.addActivityLog(
        { id: activeLeasePartyId, leaseStatus: leaseStatus.AVAILABLE, downloadStatus: downloadStatus.SUCCESFUL },
        ACTIVITY_TYPES.UPDATE,
      );
  };

  goToNewLeaseParty = () => {
    const { leasingNavigator, seedPartyId } = this.props;
    seedPartyId && leasingNavigator.navigateToParty(seedPartyId);
  };

  voidExecutedLease = () => {
    const { activeLeasePartyId, leaseId, seedPartyId } = this.props;
    this.props.voidExecutedLease(activeLeasePartyId, leaseId, seedPartyId);
  };

  toggleInitiateMoveoutDialog = () => {
    const { isInitiateMoveoutDialogOpen } = this.state;
    this.setState({
      isInitiateMoveoutDialogOpen: !isInitiateMoveoutDialogOpen,
    });
  };

  toggleInitiateTransferDialog = () => {
    const { isInitiateTransferDialogOpen } = this.state;
    this.setState({
      isInitiateTransferDialogOpen: !isInitiateTransferDialogOpen,
    });
  };

  toggleCannotVoidLeaseDialog = () => {
    const { isCannotVoidLeaseDialogOpen } = this.state;
    this.setState({ isCannotVoidLeaseDialogOpen: !isCannotVoidLeaseDialogOpen });
  };

  toggleUnavailableVoidLeaseBySeedPartyDialog = () => {
    const { isUnavailableVoidLeaseBySeedPartyDialog } = this.state;
    this.setState({ isUnavailableVoidLeaseBySeedPartyDialog: !isUnavailableVoidLeaseBySeedPartyDialog });
  };

  toggleLeaseNotExecutedDialog = () => {
    const { isLeaseNotExecutedDialogOpen } = this.state;
    this.setState({ isLeaseNotExecutedDialogOpen: !isLeaseNotExecutedDialogOpen });
  };

  toggleVoidExecutedLeaseDialog = () => {
    const { isVoidExecutedLeaseDialogOpen } = this.state;
    this.setState({ isVoidExecutedLeaseDialogOpen: !isVoidExecutedLeaseDialogOpen });
  };

  handleVoidLeaseDialog = () => {
    const { moveInConfirmed, currentLeaseStatus, seedPartyWorkflowName, leaseId } = this.props;
    if (seedPartyWorkflowName !== DALTypes.WorkflowName.NEW_LEASE || !leaseId) return this.toggleUnavailableVoidLeaseBySeedPartyDialog();
    if (moveInConfirmed) return this.toggleCannotVoidLeaseDialog();
    if (currentLeaseStatus !== DALTypes.LeaseStatus.EXECUTED) return this.toggleLeaseNotExecutedDialog();
    return this.toggleVoidExecutedLeaseDialog();
  };

  renderLeaseNotAvailableForDownloadDialog = () => (
    <MsgBox
      open={this.state.isLeaseNotAvailableForDownloadDialogOpen}
      ref="leaseNotAvailableForDownloadDialog"
      closeOnTapAway={false}
      lblOK={t('OK')}
      lblCancel=""
      onCloseRequest={() =>
        this.setState({
          isLeaseNotAvailableForDownloadDialogOpen: false,
        })
      }
      title={t('LEASE_NOT_AVAILABLE_FOR_DOWNLOAD_TITLE')}>
      <Text>{this.state.dialogText}</Text>
    </MsgBox>
  );

  renderInitiateMoveoutDialog = () => (
    <MsgBox
      open={this.state.isInitiateMoveoutDialogOpen}
      ref="initiateMoveoutDialog"
      closeOnTapAway={false}
      lblOK={t('OK')}
      lblCancel=""
      onCloseRequest={this.toggleInitiateMoveoutDialog}
      title={t('INITIATE_MOVEOUT_TITLE')}>
      <Text>{t('INITIATE_MOVEOUT_MSG')}</Text>
    </MsgBox>
  );

  renderInitiateTransferDialog = () => (
    <MsgBox
      open={this.state.isInitiateTransferDialogOpen}
      ref="initiateTransferDialog"
      closeOnTapAway={false}
      lblOK={t('OK')}
      lblCancel=""
      onCloseRequest={this.toggleInitiateTransferDialog}
      title={t('INITIATE_TRANSFER_TITLE')}>
      <Text>{t('INITIATE_TRANSFER_MSG')}</Text>
    </MsgBox>
  );

  renderCannotVoidLeaseDialog = () => (
    <MsgBox
      open={this.state.isCannotVoidLeaseDialogOpen}
      closeOnTapAway={false}
      lblOK={t('OK_GOT_IT')}
      lblCancel=""
      onCloseRequest={this.toggleCannotVoidLeaseDialog}
      title={t('CANNOT_VOID_EXECUTED_LEASE_DIALOG_TITLE')}>
      <Text>{t('CANNOT_VOID_EXECUTED_LEASE_DIALOG_MSG', { backend: this.props.currentUser?.backendName })}</Text>
    </MsgBox>
  );

  renderUnavailableVoidLeaseBySeedPartyDialog = () => (
    <MsgBox
      open={this.state.isUnavailableVoidLeaseBySeedPartyDialog}
      closeOnTapAway={false}
      lblOK={t('OK_GOT_IT')}
      lblCancel=""
      onCloseRequest={this.toggleUnavailableVoidLeaseBySeedPartyDialog}
      title={t('CANNOT_VOID_LEASE_DIALOG_TITLE')}>
      <Text>{t('CANNOT_VOID_LEASE_DIALOG_MSG')} </Text>
      <Text style={{ marginTop: '16px' }}>{t('CANNOT_VOID_LEASE_DIALOG_MSG2', { backend: this.props.currentUser?.backendName })} </Text>
    </MsgBox>
  );

  renderLeaseNotExecutedDialog = () => (
    <MsgBox
      open={this.state.isLeaseNotExecutedDialogOpen}
      closeOnTapAway={false}
      lblOK={t('GO_TO_NEW_LEASE_PARTY')}
      onOKClick={() => this.goToNewLeaseParty()}
      lblCancel={t('STAY_HERE')}
      onCloseRequest={this.toggleLeaseNotExecutedDialog}
      title={t('LEASE_NOT_EXECUTED_DIALOG_TITLE')}>
      <Text>{t('LEASE_NOT_EXECUTED_DIALOG_MSG')}</Text>
    </MsgBox>
  );

  renderErrorVoidingExecutedLease = () => (
    <MsgBox
      open={this.props.voidExecutedLeaseFailed}
      closeOnTapAway={false}
      lblOK={t('OK_GOT_IT')}
      lblCancel=""
      onCloseRequest={this.props.closeVoidExecutedLeaseDialog}
      title={t('ERROR_VOID_EXECUTED_LEASE_TITLE')}>
      <FormattedMarkdown>{t('ERROR_VOID_EXECUTED_LEASE_MSG')}</FormattedMarkdown>
    </MsgBox>
  );

  renderVoidExecutedLeaseDialog = () => (
    <MsgBox
      open={this.state.isVoidExecutedLeaseDialogOpen}
      closeOnTapAway={false}
      lblOK={t('VOID_LEASE')}
      onOKClick={() => this.voidExecutedLease()}
      lblCancel={t('CANCEL')}
      onCloseRequest={this.toggleVoidExecutedLeaseDialog}
      title={t('VOID_EXECUTED_LEASE_DIALOG_TITLE')}>
      <FormattedMarkdown>{t('VOID_EXECUTED_LEASE_DIALOG_MSG')}</FormattedMarkdown>
    </MsgBox>
  );

  handleExportParty = () => {
    const { props } = this;
    props.exportParty(props.seedPartyId);
  };

  render() {
    const { vacateDate, partyIsRenewal, residentDataImportOn } = this.props;

    return (
      <span>
        <CardMenu iconName="dots-vertical" triggerProps={{ 'data-id': 'activeLeaseSectionMenu' }}>
          <CardMenuItem text={t('DOWNLOAD_LEASE')} onClick={this.downloadLease} />
          {!partyIsRenewal && <CardMenuItem text={t('BUTTON_EXPORT_PARTY')} onClick={this.handleExportParty} />}
          {!partyIsRenewal && residentDataImportOn && (
            <CardMenuItem text={t('INITIATE_MOVEOUT')} onClick={this.toggleInitiateMoveoutDialog} disabled={!!vacateDate} />
          )}
          {residentDataImportOn && <CardMenuItem text={t('INITIATE_TRANSFER')} onClick={this.toggleInitiateTransferDialog} />}
          {!partyIsRenewal && <CardMenuItem text={t('VOID_EXECUTED_LEASE')} onClick={this.handleVoidLeaseDialog} />}
        </CardMenu>
        {this.renderLeaseNotAvailableForDownloadDialog()}
        {this.renderInitiateMoveoutDialog()}
        {this.renderInitiateTransferDialog()}
        {this.renderCannotVoidLeaseDialog()}
        {this.renderLeaseNotExecutedDialog()}
        {this.renderVoidExecutedLeaseDialog()}
        {this.renderUnavailableVoidLeaseBySeedPartyDialog()}
        {this.renderErrorVoidingExecutedLease()}
      </span>
    );
  }
}
