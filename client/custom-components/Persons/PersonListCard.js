/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import Avatar from 'components/Avatar/Avatar';
import Text from 'components/Typography/Text';

import { renderStringWithMatch } from 'helpers/string-matcher';
import { formatPhone } from 'helpers/phone-utils';
import { cf } from './PersonListCard.scss';

export default class PersonListCard extends Component {
  static propTypes = {
    person: PropTypes.object,
    searchQuery: PropTypes.object,
    onPersonSelected: PropTypes.func,
  };

  handleOnTouchTapPerson = () => {
    const { onPersonSelected, person } = this.props;
    onPersonSelected && onPersonSelected(person);
  };

  renderPreferredName = searchQueryValue =>
    renderStringWithMatch({
      searchQueryValue,
      value: this.props.person.preferredName,
      id: 'preferredName',
      TagElement: Text,
      ellipsis: true,
    });

  renderFullName = searchQueryValue =>
    renderStringWithMatch({
      searchQueryValue,
      value: this.props.person.fullName,
      id: 'fullName',
      TagElement: Text,
      ellipsis: true,
      className: cf('fullName'),
    });

  renderContactInfo = (contactInfo, searchQueryValue = '', formatter) =>
    contactInfo.map(({ value, id }) =>
      renderStringWithMatch({
        value: formatter ? formatter(value) : value,
        id,
        searchQueryValue,
        ellipsis: true,
      }),
    );

  render() {
    const { person, searchQuery } = this.props;

    return (
      <div data-c="person-list-card" className={cf('main-content')} onClick={this.handleOnTouchTapPerson}>
        <div className={cf('avatar')}>
          <Avatar userName={person.fullName} />
        </div>
        <div className={cf('meta')}>
          {this.renderPreferredName(searchQuery.value)}
          {this.renderFullName(searchQuery.value)}
          {person.contactInfo && person.contactInfo.phones && <div>{this.renderContactInfo(person.contactInfo.phones, searchQuery.value, formatPhone)}</div>}
          {person.contactInfo && person.contactInfo.emails && <div>{this.renderContactInfo(person.contactInfo.emails, searchQuery.value)}</div>}
        </div>
      </div>
    );
  }
}
