/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import Avatar from 'components/Avatar/Avatar';
import Caption from 'components/Typography/Caption';
import Text from 'components/Typography/Text';
import { observer } from 'mobx-react';
import PersonViewModel from 'view-models/person';
import Validator from 'components/Validator/Validator';
import { cf } from './CommonPersonCard.scss';
import { formatMoment } from '../../../common/helpers/moment-utils';
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';

@observer
export default class CommonPersonCard extends Component {
  static propTypes = {
    partyMember: PropTypes.object,
    onItemSelected: PropTypes.func,
    isSelected: PropTypes.bool,
    displayCompanyName: PropTypes.bool,
    isPartyLevelGuarantor: PropTypes.bool,
  };

  formatArrLabel = (arr, label) => {
    if (!arr.length) return '';
    return `${t(label, { count: arr.length })}`;
  };

  renderSummary = (phones, emails) => {
    const phonesInfo = this.formatArrLabel(phones, 'PERSON_SUMMARY_PHONE');
    const emailsInfo = this.formatArrLabel(emails, 'PERSON_SUMMARY_EMAIL');

    const contactSummary = [phonesInfo, emailsInfo].filter(o => o).join(', ');

    return (
      <Caption secondary data-id="contactSummary">
        {contactSummary}
      </Caption>
    );
  };

  handleClick = e => {
    const { onItemSelected, partyMember } = this.props;
    onItemSelected && onItemSelected(e, partyMember);
  };

  get personViewModel() {
    const { partyMember } = this.props;
    return PersonViewModel.create(partyMember);
  }

  render = () => {
    const person = this.personViewModel;
    const { isSelected, displayDuplicatePersonNotification, displayCompanyName, partyMember, isPartyLevelGuarantor, vacateDate } = this.props;
    const cardTitle = person.getDisplayName();
    const dataId = `${cardTitle.replace(/\s/g, '')}_PersonCard`;
    const cardSubtitle = cardTitle === person.preferredName ? person.fullName : '';
    const hadCompanyName = displayCompanyName && !!person.companyName;
    const emails = person.emails;
    const atLeastOneTemporaryEmail = !!emails.length && emails[0].isAnonymous; // we should have only one email CPM-9930
    return (
      <div
        data-component="common-person-card"
        data-id={dataId}
        data-member-type={partyMember.memberType}
        className={cf('main-content', { selected: isSelected })}
        onClick={this.handleClick}>
        <div className={cf('avatar')}>
          <Avatar userName={hadCompanyName ? person.companyName : person.fullName} />
        </div>
        <div>
          {hadCompanyName && <Text bold>{person.companyName}</Text>}
          <Text bold secondary={hadCompanyName} data-id="cardTitle">
            {cardTitle}
          </Text>
          {cardSubtitle && <Caption>{cardSubtitle}</Caption>}
          {this.renderSummary(person.phones, emails)}
          {person.guarantor && <Caption secondary>{person.guarantor}</Caption>}
          {person.resident && <Caption secondary>{person.resident}</Caption>}
          {person.unknownName && <Validator errorMessage={t('UNKNOWN_NAME')} />}
          {person.noContactInfo && <Validator errorMessage={t('NO_CONTACT_INFORMATION')} />}
          {person.isGuarantor && !isPartyLevelGuarantor && !person.hasGuarantees && (
            <Validator errorMessage={t('MISSING_RESIDENT')} data-id="missingResidentWarning" />
          )}
          {atLeastOneTemporaryEmail && <Validator errorMessage={t('CONTACT_INFO_TEMPORARY_EMAIL_ERROR_MESSAGE')} />}
          {displayDuplicatePersonNotification && person.strongMatchCount > 0 && (
            <Caption className={cf('duplicateLabel')} data-id="possibleDuplicateTxt">
              {t('POSSIBLE_DUPLICATE')}
            </Caption>
          )}
          {vacateDate && (
            <Validator
              errorMessage={t('VACATING_ON', { date: `${formatMoment(vacateDate, { format: MONTH_DATE_YEAR_FORMAT })}` })}
              className={'inherit_warning'}
            />
          )}
        </div>
      </div>
    );
  };
}
