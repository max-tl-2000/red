/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Card, Avatar, Button, Truncate, Typography as T, RedList as L } from 'components';
import { t } from 'i18next';
import { formatPhone } from 'helpers/phone-utils';
import { connect } from 'react-redux';
import sortBy from 'lodash/sortBy';
import { getPartyStateToDisplay } from '../../helpers/party';
import { DALTypes } from '../../../common/enums/DALTypes';
import { _highlightMatches } from '../../helpers/highlightMatches';
import { cf } from './PersonCard.scss';
import { getDisplayName } from '../../../common/helpers/person-helper';
import { toMoment } from '../../../common/helpers/moment-utils';

@connect(state => ({
  users: state.globalStore.get('users'),
}))
export default class PersonCard extends Component {
  static propTypes = {
    person: PropTypes.object,
    parties: PropTypes.array,
    query: PropTypes.object,
    onClick: PropTypes.func,
    displayActionButtons: PropTypes.bool,
    confirmMerge: PropTypes.func,
    dismissMatch: PropTypes.func,
    canDismissMatch: PropTypes.bool,
    isMergeInProgress: PropTypes.bool,
  };

  renderContactInfo = (person, query) => {
    let phones = [];
    let emails = [];
    if (person.contactInfo && person.contactInfo.phones && person.contactInfo.emails) {
      phones = person.contactInfo.phones || [];
      emails = person.contactInfo.emails || [];
    } else {
      phones = person.contactInfo ? person.contactInfo.filter(ci => ci.type === DALTypes.ContactInfoType.PHONE) || [] : [];
      emails = person.contactInfo ? person.contactInfo.filter(ci => ci.type === DALTypes.ContactInfoType.EMAIL) || [] : [];
    }
    const {
      phones: { phones: phoneValues, exactMatch: phoneExactMatch },
      emails: { emails: emailValues, exactMatch: emailExactMatch },
    } = query;
    const phoneNumbers = phones.map(nr => this.getHighlightedContactInfo(formatPhone(nr.value), phoneValues, phoneExactMatch));
    const emailAddresses = emails.map(addr => this.getHighlightedContactInfo(addr.value, emailValues, emailExactMatch));
    return { phoneNumbers, emailAddresses };
  };

  getHighlightedContactInfo = (contactInfoString, query, exactMatch) => {
    const highlightedContactInfo = _highlightMatches(contactInfoString, query, { key: contactInfoString, inline: false }, exactMatch);
    return highlightedContactInfo || <T.Caption key={contactInfoString}>{contactInfoString}</T.Caption>;
  };

  renderPersonHistory = () => {
    const partiesSortedByCreateDate = sortBy(this.props.parties, 'created_at');
    const renderedHistory = partiesSortedByCreateDate.map((party, index) => {
      const key = index;

      return (
        <T.Caption key={key}>
          <T.Caption bold inline>
            {getPartyStateToDisplay(party.state)}
          </T.Caption>
          {party.propertyName && (
            <T.Caption inline>
              <T.Caption secondary inline>{` ${t('WITH')} `}</T.Caption>
              {party.propertyName}
            </T.Caption>
          )}
        </T.Caption>
      );
    });

    return renderedHistory;
  };

  formatLastContactedDate = lastContactedDate => {
    if (!lastContactedDate) return '';

    const humanizedDuration = toMoment(lastContactedDate).fromNow();
    return `Last contacted ${humanizedDuration}`;
  };

  render({ person, displayActionButtons, confirmMerge, dismissMatch, query, asListItem, isMergeInProgress } = this.props) {
    const displayName = getDisplayName(person);
    const highlightedPreferredName = displayName && _highlightMatches(displayName, this.props.query.name, { Component: T.SubHeader, bold: true });
    const contactInfo = this.renderContactInfo(person, query);

    if (asListItem) {
      const { avatarUrl } = person;
      const blockStyle = { marginTop: '.8rem' };

      return (
        <div className={cf('listItem')}>
          <L.ListItem rowStyle="mixed" hoverable={false}>
            <L.AvatarSection>
              <Avatar src={avatarUrl} userName={displayName} />
            </L.AvatarSection>
            <L.MainSection>
              {highlightedPreferredName || <T.SubHeader>{displayName}</T.SubHeader>}
              {displayName !== person.preferredName && <T.Caption secondary>{person.preferredName}</T.Caption>}
            </L.MainSection>
          </L.ListItem>
          <div style={{ paddingLeft: 8 }}>
            {!!contactInfo.phoneNumbers.length && <div style={blockStyle}>{contactInfo.phoneNumbers}</div>}
            {!!contactInfo.emailAddresses.length && <div style={blockStyle}>{contactInfo.emailAddresses}</div>}
            <div style={blockStyle}>{this.renderPersonHistory()}</div>
            <T.Caption style={blockStyle} secondary>
              {this.formatLastContactedDate(person.lastContactedDate)}
            </T.Caption>
            {displayActionButtons && (
              <div className={cf('actions')}>
                <T.Text id="samePersonText" style={{ marginBottom: 2 }}>
                  {t('SAME_PERSON')}
                </T.Text>
                <div style={{ marginRight: -8 }}>
                  <Button
                    id="samePersonYesBtn"
                    style={{ minWidth: '2rem', marginRight: '1.5rem' }}
                    type="flat"
                    btnRole="primary"
                    label={t('YES')}
                    disabled={isMergeInProgress}
                    onClick={() => confirmMerge(person)}
                  />
                  {this.props.canDismissMatch && (
                    <Button
                      id="samePersonNoBtn"
                      style={{ minWidth: '2rem' }}
                      type="flat"
                      btnRole="primary"
                      label={t('NO')}
                      onClick={() => dismissMatch(person.id)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <Card className={cf('card')}>
        <div className={cf('cardBody')}>
          <div>
            <Avatar src={person.avatarUrl} userName={displayName} />
          </div>
          <div className={cf('cardDetails')}>
            <div className={cf('personDetails')}>
              <div className={cf('topRow')}>
                <div>{highlightedPreferredName || <T.SubHeader>{person.preferredName}</T.SubHeader>}</div>
                <T.Caption disabled>{this.formatLastContactedDate(person.lastContactedDate)}</T.Caption>
              </div>
              <T.Caption>{displayName}</T.Caption>
              <div className={cf('contactData')}>
                {!!contactInfo.phoneNumbers.length && (
                  <div className={cf('phoneNumberSection')}>
                    <Truncate direction="vertical">{contactInfo.phoneNumbers}</Truncate>
                  </div>
                )}
                {!!contactInfo.emailAddresses.length && (
                  <div className={cf('emailAddressSection')}>
                    <Truncate direction="vertical">{contactInfo.emailAddresses}</Truncate>
                  </div>
                )}
              </div>
              <div className={cf('historySection')}>{this.renderPersonHistory()}</div>
            </div>
          </div>
        </div>
        {displayActionButtons && (
          <div className={cf('buttonArea')}>
            <T.Text>{t('SAME_PERSON')}</T.Text>
            <div>
              <Button type="flat" btnRole="primary" label={t('YES')} disabled={isMergeInProgress} onClick={() => confirmMerge(person)} />
              {this.props.canDismissMatch && <Button type="flat" btnRole="primary" label={t('NO')} onClick={() => dismissMatch(person.id)} />}
            </div>
          </div>
        )}
      </Card>
    );
  }
}
