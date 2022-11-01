/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { RedList as L, Avatar, Truncate, Typography as T } from 'components';
import { formatPhone } from 'helpers/phone-utils';
import newId from 'uuid/v4';
import { _highlightMatches } from '../../../helpers/highlightMatches';
import { cf } from './PersonCard.scss';
import { getDisplayName } from '../../../../common/helpers/person-helper';

export default class PersonCard extends Component {
  static propTypes = {
    person: PropTypes.object,
    query: PropTypes.object,
    onClick: PropTypes.func,
  };

  renderContactInfo = (person, query = { phones: {}, emails: {} }) => {
    let phones = [];
    let emails = [];
    if (person.contactInfo && (person.contactInfo.phones || person.contactInfo.emails)) {
      phones = person.contactInfo.phones || [];
      emails = person.contactInfo.emails || [];
    } else {
      phones = person.contactInfo ? person.contactInfo.filter(ci => ci.type === 'phone') || [] : [];
      emails = person.contactInfo ? person.contactInfo.filter(ci => ci.type === 'email') || [] : [];
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
    const highlightedContactInfo = _highlightMatches(contactInfoString, query, { key: newId(), inline: false }, exactMatch);
    return highlightedContactInfo || <T.Caption key={newId()}>{contactInfoString}</T.Caption>;
  };

  render() {
    const { person, query } = this.props;
    const contactInfo = person && this.renderContactInfo(person, query);
    const displayName = getDisplayName(person);

    return (
      <L.ListItem rowStyle="mixed">
        <div className={cf('mainContent')}>
          <div className={cf('header')}>
            <L.AvatarSection>
              <Avatar lighter bgColor="#d8d8d8" userName={person.fullName} />
            </L.AvatarSection>
            <div>
              <T.SubHeader>{displayName}</T.SubHeader>
              {displayName !== person.preferredName && <T.Caption secondary>{person.preferredName}</T.Caption>}
            </div>
          </div>
          <L.MainSection>
            <div className={cf('contactData')}>
              {!!contactInfo.phoneNumbers.length && (
                <div className={cf('phoneNumberSection')}>
                  <Truncate direction="horizontal">{contactInfo.phoneNumbers}</Truncate>
                </div>
              )}
              {!!contactInfo.emailAddresses.length && (
                <div className={cf('emailAddressSection')}>
                  <Truncate direction="horizontal">{contactInfo.emailAddresses}</Truncate>
                </div>
              )}
            </div>
          </L.MainSection>
        </div>
      </L.ListItem>
    );
  }
}
