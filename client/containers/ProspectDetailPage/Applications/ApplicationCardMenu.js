/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { formatPhoneNumber } from 'helpers/strings';
import { t } from 'i18next';
import { CardMenu, CardMenuItem, RedList } from 'components';
import { formatAsPhoneIfDigitsOnly } from 'helpers/phone-utils';
import CopyToClipboard from 'react-copy-to-clipboard';
import { cf } from './ApplicationCardMenu.scss';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { filterSpamAndAnonymousEmails, filterSpamPhones } from '../../../helpers/party';

const { Divider } = RedList;

const DISMISS_ON_CLICK_ACTION = 'dismissOnClick';

export default class ApplicationCardMenu extends Component {
  static propTypes = {
    guest: PropTypes.object.isRequired,
    isApplicationPaid: PropTypes.bool,
    onApplyOnBehalfOf: PropTypes.func,
    onSendIndividualApplicationInvitationClick: PropTypes.func,
    onWaiveApplicationFee: PropTypes.func,
    isApplicationFeeWaived: PropTypes.bool,
    propertiesAssignedToParty: PropTypes.array,
    allowLinkResident: PropTypes.bool,
    onLinkPartyMember: PropTypes.func,
    onOpenSetSsn: PropTypes.func,
    onEnableSendSsn: PropTypes.func,
  };

  renderMenuItem = ({ onClick = () => {}, label, id, ...rest }) => <CardMenuItem id={id} key={id} onClick={onClick} text={label} {...rest} />;

  renderEmailLinkToOption = (email, onSendClick, propertiesAssignedToParty) =>
    propertiesAssignedToParty.map(property =>
      this.renderMenuItem({
        id: `sendEmail-${email.value}-${property.id}`,
        action: DISMISS_ON_CLICK_ACTION,
        label: t('SEND_EMAIL_LINK_TO', {
          email: email.value,
          propertyName: property.displayName,
        }),
        onClick: () => onSendClick(email, this.props.guest, property.id),
      }),
    );

  renderSmsLinkToOption = (phone, onSendClick, propertiesAssignedToParty) =>
    propertiesAssignedToParty.map(property =>
      this.renderMenuItem({
        id: `sendSMS-${phone.value}-${property.id}`,
        action: DISMISS_ON_CLICK_ACTION,
        label: t('SEND_SMS_LINK_TO', {
          phone: formatPhoneNumber(phone.value),
          propertyName: property.displayName,
        }),
        onClick: () => onSendClick(phone, this.props.guest, property.id),
      }),
    );

  handleApplyOnBehalfOf = propertyId => {
    const { onApplyOnBehalfOf } = this.props;
    onApplyOnBehalfOf && onApplyOnBehalfOf(this.props.guest, propertyId);
  };

  handleEditApplication = propertyId => {
    const { onEditApplication } = this.props;
    onEditApplication && onEditApplication(this.props.guest, propertyId);
  };

  handleContextMenuAction = ({ action } = {}) => {
    if (action === DISMISS_ON_CLICK_ACTION) {
      this.applicationContextMenu && this.applicationContextMenu.toggle();
    }
  };

  handleUpdateWaiverStatus = (isApplicationFeeWaived, personApplication) => {
    const { id: personApplicationId } = personApplication || {};
    const { onWaiveApplicationFee, guest } = this.props;
    onWaiveApplicationFee && onWaiveApplicationFee(isApplicationFeeWaived, personApplicationId, guest);
  };

  handleLinkPartyMember = personId => {
    const { onLinkPartyMember } = this.props;
    onLinkPartyMember && onLinkPartyMember(personId);
  };

  handleOpenSetSsn = application => {
    const { onOpenSetSsn } = this.props;
    onOpenSetSsn && onOpenSetSsn(application);
  };

  handleEnableSsnSend = application => {
    const { onEnableSendSsn } = this.props;
    onEnableSendSsn && onEnableSendSsn(application);
  };

  render(
    {
      id,
      guest,
      iconClassName,
      isApplicationPaid,
      onSendIndividualApplicationInvitationClick,
      propertiesAssignedToParty,
      isApplicationFeeWaived,
      allowLinkResident,
      showRevaAdminOptions,
    } = this.props,
  ) {
    const {
      person: { fullName, contactInfo = {}, id: personId },
      application = {},
    } = guest;
    const applyOnBehalfName = fullName || contactInfo.defaultEmail || formatAsPhoneIfDigitsOnly(contactInfo.defaultPhone);
    let { emails, phones } = contactInfo;
    emails = filterSpamAndAnonymousEmails(emails);
    phones = filterSpamPhones(phones);
    const ssnEnabledBtnLabel = !application.sendSsnEnabled ? t('ENABLE_LABEL') : t('DISABLE_LABEL');

    return (
      <CardMenu
        id={id}
        ref={ref => {
          this.applicationContextMenu = ref;
        }}
        menuListClassName={cf('appCardMenu')}
        iconName="dots-vertical"
        iconClassName={iconClassName}
        onSelect={this.handleContextMenuAction}>
        {!!emails.length && emails.map(email => this.renderEmailLinkToOption(email, onSendIndividualApplicationInvitationClick, propertiesAssignedToParty))}

        {!!phones.length && phones.map(phone => this.renderSmsLinkToOption(phone, onSendIndividualApplicationInvitationClick, propertiesAssignedToParty))}

        {(!!emails.length || !!phones.length) && <Divider />}

        {allowLinkResident &&
          this.renderMenuItem({
            id: 'link-resident',
            action: DISMISS_ON_CLICK_ACTION,
            label: t('LINK_MEMBER_TYPE', { memberType: DALTypes.MemberType.RESIDENT.toLowerCase() }),
            onClick: () => this.handleLinkPartyMember(personId),
          })}

        {!isApplicationPaid &&
          propertiesAssignedToParty.map(property =>
            this.renderMenuItem({
              id: `apply-${applyOnBehalfName}-${property.id}`,
              action: DISMISS_ON_CLICK_ACTION,
              label: t('APPLY_ON_BEHALF_OF', {
                name: applyOnBehalfName,
                propertyName: property.displayName,
              }),
              onClick: () => this.handleApplyOnBehalfOf(property.id),
            }),
          )}

        {isApplicationPaid &&
          this.renderMenuItem({
            id: 'edit-application',
            action: DISMISS_ON_CLICK_ACTION,
            label: t('EDIT_APPLICATION'),
            onClick: () => this.handleEditApplication(propertiesAssignedToParty[0].id),
          })}
        {this.renderMenuItem({
          id: 'waive-application',
          action: DISMISS_ON_CLICK_ACTION,
          label: isApplicationFeeWaived ? t('WAIVE_APPLICATION_CANCEL') : t('WAIVE_APPLICATION_EXECUTE'),
          disabled: isApplicationPaid,
          onClick: () => this.handleUpdateWaiverStatus(isApplicationFeeWaived, application),
        })}
        {showRevaAdminOptions && !isApplicationPaid && (
          <CopyToClipboard text={application.paymentLink}>
            {this.renderMenuItem({
              id: 'copy-payment-link',
              action: DISMISS_ON_CLICK_ACTION,
              label: t('COPY_PAYMENT_LINK'),
              disabled: !application.paymentLink,
            })}
          </CopyToClipboard>
        )}
        {showRevaAdminOptions &&
          isApplicationPaid &&
          this.renderMenuItem({
            id: 'set-ssn',
            action: DISMISS_ON_CLICK_ACTION,
            label: t('SET_SSN'),
            onClick: () => this.handleOpenSetSsn(application),
          })}
        {showRevaAdminOptions &&
          isApplicationPaid &&
          this.renderMenuItem({
            id: 'send-ssn-enabled',
            action: DISMISS_ON_CLICK_ACTION,
            label: t('ENABLE_SSN', { action: ssnEnabledBtnLabel }),
            onClick: () => this.handleEnableSsnSend(application),
          })}
      </CardMenu>
    );
  }
}
