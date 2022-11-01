/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { t } from 'i18next';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { emailLease, syncLeaseSignatures, closeSyncErrorDialog } from 'redux/modules/leaseStore';

import { RedTable, Typography as T, Avatar, IconButton, Button, CardMenu, CardMenuItem, MsgBox } from 'components';
import { observer, inject } from 'mobx-react';
import FormattedMarkdown from '../../components/Markdown/FormattedMarkdown';
import { cf } from './LeaseStatusCard.scss';

import { allowedToSignLease } from '../../../common/acd/access';
import { formatDateAgo } from '../../../common/helpers/date-utils';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { extractFromBluemoonEnvelopeId, isSignatureStatusSigned } from '../../../common/helpers/lease';
import { isBlueMoonLeasingProviderMode } from '../../../common/helpers/utils';
import { logger } from '../../../common/client/logger';

const { Row, Cell } = RedTable;

const getSignatureStatusText = (props, status) => {
  if (status === DALTypes.LeaseSignatureStatus.SIGNED) return t('SIGNED');
  if (status === DALTypes.LeaseSignatureStatus.WET_SIGNED) return t('WET_SIGNED');

  if (props.countersignerRow) {
    const { readyToCountersign } = props;
    return readyToCountersign ? t('LEASE_READY_FOR_SIGNATURE') : t('LEASE_PENDING_GUEST_SIGNATURES');
  }

  switch (status) {
    case DALTypes.LeaseSignatureStatus.NOT_SENT:
      return t('NOT_SENT');
    case DALTypes.LeaseSignatureStatus.SENT:
      return t('SENT');
    case DALTypes.LeaseSignatureStatus.SIGNED:
      return t('SIGNED');
    case DALTypes.LeaseSignatureStatus.WET_SIGNED:
      return t('WET_SIGNED');
    default:
      return '';
  }
};

const getSignatureDateText = (signature, timezone) => {
  if (!isSignatureStatusSigned(signature.status) || !signature.metadata.signDate) {
    return '';
  }
  return formatDateAgo(signature.metadata.signDate, timezone);
};

export class LeaseStatusCard extends Component {
  constructor() {
    super();
    this.state = {
      wasSignInOfficePressed: false,
      wasEmailLeasePressed: false,
    };
  }

  componentWillReceiveProps(nextProps) {
    const {
      party,
      lease,
      leasingNavigator,
      updatedSignature,
      signature,
      countersignerRow,
      oldCounterSignature,
      handleCounterSign,
      leaseSyncInProgress,
      leaseSyncSuccess,
      leaseSyncError,
      updateOldCounterSignature,
      handleOpenCounterSignDialogUpdated,
    } = nextProps;

    if (leaseSyncInProgress) {
      // won't do anything until sync is done
      return;
    }

    if (leaseSyncError && !this.props.leaseSyncError && leaseSyncError.clientUserId === signature.clientUserId && leaseSyncError.leaseId === lease.id) {
      logger.error({ leaseSyncError, partyId: party.id }, 'Unable to sync lease');
      return;
    }

    if (leaseSyncSuccess && !this.props.leaseSyncSuccess) {
      if (
        updatedSignature.clientUserId !== signature.clientUserId ||
        updatedSignature.leaseId !== signature.leaseId ||
        isSignatureStatusSigned(updatedSignature.status)
      ) {
        // ignore updates for other leases / signatures
        return;
      }

      const { bmESignId } = updatedSignature ? extractFromBluemoonEnvelopeId(updatedSignature.envelopeId) : {};
      const eSignatureRequestCreated = !!bmESignId;

      if (countersignerRow && oldCounterSignature) {
        if (!updatedSignature.signUrl || oldCounterSignature.signUrl !== updatedSignature.signUrl) {
          handleOpenCounterSignDialogUpdated && handleOpenCounterSignDialogUpdated();
        } else handleCounterSign(updatedSignature.signUrl);

        updateOldCounterSignature && updateOldCounterSignature();
        return;
      }

      if (!eSignatureRequestCreated) {
        this.props.openInitiateESignatureRequestDialog && this.props.openInitiateESignatureRequestDialog();
        this.setState({ wasEmailLeasePressed: false, wasSignInOfficePressed: false });
      } else if (this.state.wasSignInOfficePressed) {
        leasingNavigator.navigateToParty(party.id, {
          leaseId: lease.id,
          personId: updatedSignature.partyMemberId,
          addOrigin: true,
          newTab: true,
        });
        this.setState({ wasSignInOfficePressed: false });
      } else if (this.state.wasEmailLeasePressed) {
        this.props.emailLease(lease.partyId, lease.id, [updatedSignature.partyMemberId]);
        this.setState({ wasEmailLeasePressed: false });
      }
    }
  }

  renderMenu = signedOrExecuted => {
    const { propertySettings, memberType, leaseSyncInProgress } = this.props;
    let shouldDisplayHamburgerMenu = false;
    const shouldDisableLeaseButtons = leaseSyncInProgress || signedOrExecuted;

    switch (memberType) {
      case DALTypes.MemberType.RESIDENT:
        shouldDisplayHamburgerMenu = propertySettings?.lease?.residentSignatureTypes?.includes(DALTypes.LeaseSignatureTypes.WET);
        break;
      case DALTypes.MemberType.GUARANTOR:
        shouldDisplayHamburgerMenu = propertySettings?.lease?.guarantorSignatureTypes?.includes(DALTypes.LeaseSignatureTypes.WET);
        break;
      default:
        shouldDisplayHamburgerMenu = false;
        break;
    }

    if (shouldDisplayHamburgerMenu) {
      return (
        <CardMenu iconName="dots-vertical" disabled={shouldDisableLeaseButtons}>
          <CardMenuItem text={t('SIGN_IN_OFFICE')} onClick={() => this.handleSignInOffice()} />
          <CardMenuItem text={t('MARK_AS_WET_SIGNED')} onClick={() => this.handleMarkAsWetSigned()} />
        </CardMenu>
      );
    }

    return <IconButton iconName="pencil" data-id="signatureButton" disabled={shouldDisableLeaseButtons} onClick={() => this.handleSignInOffice()} />;
  };

  handleOnCounterSignClick = () => {
    const { onCounterSignClick } = this.props;
    onCounterSignClick && onCounterSignClick();
  };

  handleMarkAsWetSigned = () => {
    const { openMarkAsWetSignedDialog, lease, signature } = this.props;
    openMarkAsWetSignedDialog && openMarkAsWetSignedDialog(lease.id, signature);
  };

  handleSignInOfficeForGuarantors = () => {
    const { openMarkAsWetSignedForGuarantorsDialog, lease, signature } = this.props;
    openMarkAsWetSignedForGuarantorsDialog && openMarkAsWetSignedForGuarantorsDialog(lease.id, signature);
  };

  handleEmailLease = () => {
    const { lease, signature, leasingProviderMode, party, isAResidentSignatureMarkedAsWetSigned, propertySettings } = this.props;
    this.setState({ wasSignInOfficePressed: false, wasEmailLeasePressed: true });

    const isBlueMoonLeasingMode = isBlueMoonLeasingProviderMode(leasingProviderMode);

    if (!isBlueMoonLeasingMode) {
      this.props.emailLease(lease.partyId, lease.id, [signature.partyMemberId]);
    } else if (isAResidentSignatureMarkedAsWetSigned) {
      this.props.openCannotESignLeaseDialog && this.props.openCannotESignLeaseDialog();
    } else {
      const partyMember = party.partyMembers.find(pm => pm.id === signature.partyMemberId);
      const wetSignonlyAllowedForGuarantors = this.isWetSignOnlyAllowedForGuarantors(propertySettings);

      if (partyMember.memberType === DALTypes.MemberType.GUARANTOR && wetSignonlyAllowedForGuarantors) {
        this.handleSignInOfficeForGuarantors();
      } else {
        this.props.syncLeaseSignatures(lease.id, party.id, signature.clientUserId);
      }
    }
  };

  isWetSignOnlyAllowedForGuarantors = propertySettings => {
    const guarantorSignatureTypes = propertySettings?.lease?.guarantorSignatureTypes;
    return guarantorSignatureTypes && guarantorSignatureTypes.length === 1 && guarantorSignatureTypes.includes(DALTypes.LeaseSignatureTypes.WET);
  };

  handleSignInOffice = () => {
    const { leasingNavigator, party, lease, signature, leasingProviderMode, isAResidentSignatureMarkedAsWetSigned, propertySettings } = this.props;
    const isBlueMoonLeasingMode = isBlueMoonLeasingProviderMode(leasingProviderMode);

    if (!isBlueMoonLeasingMode) {
      leasingNavigator.navigateToParty(party.id, {
        leaseId: lease.id,
        personId: signature.partyMemberId,
        addOrigin: true,
        newTab: true,
      });
    } else if (isAResidentSignatureMarkedAsWetSigned) {
      this.props.openCannotESignLeaseDialog && this.props.openCannotESignLeaseDialog();
    } else {
      const partyMember = party.partyMembers.find(pm => pm.id === signature.partyMemberId);
      const wetSignonlyAllowedForGuarantors = this.isWetSignOnlyAllowedForGuarantors(propertySettings);

      if (partyMember.memberType === DALTypes.MemberType.GUARANTOR && wetSignonlyAllowedForGuarantors) {
        this.handleSignInOfficeForGuarantors();
      } else {
        this.setState({ wasSignInOfficePressed: true });
        this.props.syncLeaseSignatures(lease.id, party.id, signature.clientUserId);
      }
    }
  };

  renderErrorDialog = () => (
    <MsgBox
      open={!!this.props.leaseSyncError}
      closeOnTapAway={false}
      lblOK={t('OK_GOT_IT')}
      lblCancel=""
      onCloseRequest={this.props.closeSyncErrorDialog}
      title={t('ERROR_SYNC_LEASE_TITLE')}>
      <FormattedMarkdown>{t('GENERIC_ERROR')}</FormattedMarkdown>
    </MsgBox>
  );

  render() {
    const props = this.props;
    const { person, signature, lease, countersignerRow, currentUser, party, readyToCountersign, dataId, rowIndex, leaseSyncError } = props;
    const { baselineData: { timezone } = {} } = lease;
    if (!signature || !person) return <div />;

    const isLeaseApprover = allowedToSignLease(currentUser, party);

    const signedOrExecuted = lease.status === DALTypes.LeaseStatus.EXECUTED || isSignatureStatusSigned(signature.status);
    let signer = {
      userName: person.fullName,
      src: person.avatarUrl,
      name: getDisplayName(person),
      secondary: person.fullName,
    };

    if (countersignerRow && !signedOrExecuted) {
      signer = {
        userName: t('COUNTERSIGNER'),
        name: t('COUNTERSIGNER'),
        src: '',
        secondary: '',
      };
    }

    return (
      <Row key={`${signature.id}-${countersignerRow ? currentUser.id : person.id}`} dataId={dataId}>
        <Cell width={48}>
          <Avatar userName={signer.userName} style={{ width: '2rem', height: '2rem' }} initialsStyle={{ fontSize: '.825rem' }} src={signer.src} />
        </Cell>
        <Cell>
          <T.Text data-id="signerName">{signer.name}</T.Text>
          <T.Caption secondary>{signer.secondary}</T.Caption>
        </Cell>
        <Cell textAlign="right">
          <T.Text
            id={countersignerRow ? `counterSignatureStatusText-${rowIndex}-${signature.status}` : `signatureStatusText-${rowIndex}-${signature.status}`}
            data-id="signatureStatus"
            bold
            className={signature.status === DALTypes.LeaseSignatureStatus.NOT_SENT ? cf('lease-not-sent') : cf('lease-sent')}>
            {getSignatureStatusText(props, signature.status)}
          </T.Text>
          <T.Caption secondary>{getSignatureDateText(signature, timezone)}</T.Caption>
        </Cell>
        <Cell width={140} textAlign="right" middleWrapperStyle={{ paddingRight: '1rem' }}>
          {!countersignerRow && (
            <div>
              <IconButton data-id="sendEmailLeaseButton" iconName="email" onClick={() => this.handleEmailLease()} disabled={signedOrExecuted} />
              {this.renderMenu(signedOrExecuted)}
            </div>
          )}
          {countersignerRow && isLeaseApprover && readyToCountersign && !isSignatureStatusSigned(signature.status) && (
            <Button
              data-id="counterSignatureButton"
              disabled={signedOrExecuted}
              btnRole="primary"
              label={t('SIGN')}
              onClick={() => this.handleOnCounterSignClick()}
            />
          )}
        </Cell>
        {leaseSyncError && this.renderErrorDialog()}
      </Row>
    );
  }
}

export default connect(
  state => ({
    currentUser: state.auth.user,
    leaseSyncSuccess: state.leaseStore.leaseSyncSuccess,
    leaseSyncError: state.leaseStore.leaseSyncError,
    leaseSyncInProgress: state.leaseStore.leaseSyncInProgress,
    updatedSignature: state.leaseStore.updatedSignature,
  }),
  dispatch =>
    bindActionCreators(
      {
        emailLease,
        syncLeaseSignatures,
        closeSyncErrorDialog,
      },
      dispatch,
    ),
)(inject('leasingNavigator')(observer(LeaseStatusCard)));
