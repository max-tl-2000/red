/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography, RedTable as T, Button, Icon, Tag } from 'components';
import { t } from 'i18next';
import Validator from 'components/Validator/Validator';
import { cf } from './ApplicationCard.scss';
import ApplicationCardMenu from './ApplicationCardMenu';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { isApplicationPaid, getApplicantName } from '../../../../common/helpers/applicants-utils';
import { getDisplayName } from '../../../../common/helpers/person-helper';
import { isGuarantor } from '../../../../common/helpers/party-utils';
import { isPartyLevelGuarantor } from '../../../helpers/party';

const { Text, Caption } = Typography;

export default class ApplicationCard extends Component {
  static propTypes = {
    rowId: PropTypes.string,
    guest: PropTypes.object.isRequired,
    hasQuoteComm: PropTypes.bool.isRequired,
    onApplyOnBehalfOf: PropTypes.func,
    onEditApplication: PropTypes.func,
    sendIndividualApplicationInvitation: PropTypes.func,
    propertiesAssignedToParty: PropTypes.array,
    onWaiveApplicationFee: PropTypes.func,
    screeningRequired: PropTypes.bool,
    onLinkPartyMember: PropTypes.func,
    onOpenSetSsn: PropTypes.func,
    onEnableSendSsn: PropTypes.func,
  };

  getApplicationStatus = (guest = {}, hasQuoteComm) => {
    let appStatusFromToken = DALTypes.PersonApplicationStatus.NOT_SENT;

    const applicationStatusToken = guest.application && guest.application.applicationStatus.toUpperCase();
    if (applicationStatusToken && DALTypes.PersonApplicationStatus[applicationStatusToken]) {
      appStatusFromToken = DALTypes.PersonApplicationStatus[applicationStatusToken] || DALTypes.PersonApplicationStatus.UNKNOWN_STATUS;
    }

    // Even if the persons application was not directly sent, we still need to consider possible quotes being sent to the person.
    if (appStatusFromToken === DALTypes.PersonApplicationStatus.NOT_SENT && hasQuoteComm) {
      appStatusFromToken = DALTypes.PersonApplicationStatus.SENT;
    }

    return appStatusFromToken;
  };

  renderApplicationStatus(applicationStatus, rowId) {
    return (
      <div className={cf('image')}>
        <div className={cf('appStatus')}>
          <Text id={`${rowId}_screeningStatus`}>{t(applicationStatus.toUpperCase())}</Text>
        </div>
      </div>
    );
  }

  renderApplicantDocuments = (application, rowId) => {
    const { documents: { privateDocumentsCount = 0 } = {} } = application || {};
    return (
      <Button
        data-id={`${rowId}_docButton`}
        type="wrapper"
        className={cf('applicant-documents', {
          'not-clickable-document': privateDocumentsCount <= 0,
        })}>
        <span className={cf('documents')}>
          <Icon name="file" />
          <Caption secondary inline className={cf('uploaded')}>
            {privateDocumentsCount}
          </Caption>
        </span>
      </Button>
    );
  };

  shouldShowNameMismatchWarning = (person, application, applicationName) => {
    const name = getApplicantName(person.fullName);
    const enhancedName = {
      firstName: name.firstName || '',
      lastName: name.lastName || '',
      middleName: name.middleName || '',
    };

    const formatFullName = ({ firstName, middleName, lastName }) => `${firstName} ${middleName} ${lastName}`;

    const showNameMismatchWarning = application && application.paymentCompleted && formatFullName(applicationName) !== formatFullName(enhancedName);

    return !!showNameMismatchWarning;
  };

  render(
    {
      rowId,
      guest,
      hasQuoteComm,
      onApplyOnBehalfOf,
      onEditApplication,
      sendIndividualApplicationInvitation,
      propertiesAssignedToParty,
      onWaiveApplicationFee,
      onLinkPartyMember,
      screeningRequired,
      showRevaAdminOptions,
      onOpenSetSsn,
      onEnableSendSsn,
    } = this.props,
  ) {
    const applicationStatus = this.getApplicationStatus(guest, hasQuoteComm);
    const { person = { contactInfo: {} }, application } = guest;
    const applicationName = application
      ? {
          firstName: application.applicationData.firstName || '',
          lastName: application.applicationData.lastName || '',
          middleName: application.applicationData.middleName || '',
        }
      : undefined;
    const showNameMismatchWarning = this.shouldShowNameMismatchWarning(person, application, applicationName);
    const cardTitle = getDisplayName(person);
    const isApplicationFeeWaived = application && application.isFeeWaived;

    const cardSubtitle = cardTitle === person.preferredName ? person.fullName : '';
    const isGuarantorAndDoesntHaveGuarantees = isGuarantor(guest) && !person.hasGuarantees && !isPartyLevelGuarantor;

    const guarantorRequiresGuaranteeLink = isGuarantorAndDoesntHaveGuarantees && !isPartyLevelGuarantor;
    const allowLinkResident = screeningRequired && guarantorRequiresGuaranteeLink;
    const { fullName = '' } = person || {};
    const memberNameId = `${guest.memberType}${fullName?.replace(/\s/g, '')}_name`;

    return (
      <T.Row data-id={rowId}>
        <T.Cell>
          <Text data-id={memberNameId} className={cf({ tag: isApplicationFeeWaived })}>
            {' '}
            {cardTitle}{' '}
          </Text>
          {isApplicationFeeWaived && <Tag id={`${rowId}_applicationFeeWaived`} text={t('APPLICATION_FEE_WAIVED')} info className={cf('tag')} />}
          <Text secondary> {cardSubtitle} </Text>
          {showNameMismatchWarning && (
            <div>
              <Caption secondary inline>
                {t('APPLICATION_NAME')}
              </Caption>
              <Caption inline className={cf('highlight')}>
                {`${applicationName.firstName} ${applicationName.middleName} ${applicationName.lastName}`}
              </Caption>
            </div>
          )}
          {guarantorRequiresGuaranteeLink && <Validator id="errorMessageMissingResident" errorMessage={t('MISSING_RESIDENT')} />}
        </T.Cell>
        <T.Cell textAlign="right" width={120}>
          {this.renderApplicationStatus(applicationStatus, rowId)}
        </T.Cell>
        <T.Cell textAlign="right" width={120}>
          {this.renderApplicantDocuments(guest.application, rowId)}{' '}
        </T.Cell>
        <T.Cell textAlign="right" width={80} middleWrapperStyle={{ paddingRight: '1rem' }}>
          <ApplicationCardMenu
            id={`${rowId}_menu`}
            guest={guest}
            onApplyOnBehalfOf={onApplyOnBehalfOf}
            onEditApplication={onEditApplication}
            isApplicationPaid={isApplicationPaid({ applicationStatus })}
            onSendIndividualApplicationInvitationClick={sendIndividualApplicationInvitation}
            onWaiveApplicationFee={onWaiveApplicationFee}
            isApplicationFeeWaived={isApplicationFeeWaived}
            propertiesAssignedToParty={propertiesAssignedToParty}
            allowLinkResident={allowLinkResident}
            onLinkPartyMember={onLinkPartyMember}
            showRevaAdminOptions={showRevaAdminOptions}
            onOpenSetSsn={onOpenSetSsn}
            onEnableSendSsn={onEnableSendSsn}
          />
        </T.Cell>
      </T.Row>
    );
  }
}
