/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Dropdown, Typography } from 'components';
import { updateUser } from 'redux/modules/usersStore';
import { t } from 'i18next';
import { formatPhoneNumber } from 'helpers/strings';
import { getPreferredCallSource } from 'helpers/telephony';
import { cf } from './CallSourceSelector.scss';

const { Text } = Typography;

@connect(() => ({}), dispatch => bindActionCreators({ updateUser }, dispatch))
export default class CallSourceSelector extends React.Component {
  static propTypes = { user: PropTypes.object.isRequired };

  updateUserPreferredCallSource = ({ id }) =>
    this.props.updateUser(this.props.user.id, {
      metadata: { preferredCallSource: id },
    });

  renderItem = ({ item }) => {
    const { text, phone } = item.originalItem;
    return (
      <div className={cf('item')}>
        <Text inline>{text}</Text>
        {(phone && (
          <Text inline secondary className={cf('phone')}>
            {phone}
          </Text>
        )) || <noscript />}
      </div>
    );
  };

  formatSelected = ({ selected }) => {
    const [{ originalItem }] = selected;
    const { text, phone, alias } = originalItem;
    const source = alias || text.toLowerCase();

    return (
      <div className={cf('selected')}>
        <Text inline>{`${t('CALL_FROM')} ${source}`}</Text>
        {(phone && (
          <Text inline secondary className={cf('phone')}>
            {phone}
          </Text>
        )) || <noscript />}
      </div>
    );
  };

  render = () => {
    const { user } = this.props;
    const thisComputerItem = { id: 'app', text: t('THIS_COMPUTER') };
    const ringPhones = (user.ringPhones || []).map(phone => ({
      id: phone,
      text: t('PHONE'),
      phone: formatPhoneNumber(phone),
    }));

    const ipPhones = user.sipEndpoints.filter(e => !e.isUsedInApp && e.alias).map(c => ({ id: c.username, text: c.alias, alias: c.alias }));

    const { source } = getPreferredCallSource(user);

    return (
      <div className={cf('dropdown')}>
        <Dropdown
          ref={e => (this.dropdown = e)}
          items={[thisComputerItem, ...ipPhones, ...ringPhones]}
          selectedValue={[source]}
          renderItem={this.renderItem}
          formatSelected={this.formatSelected}
          onChange={this.updateUserPreferredCallSource}
          wide
        />
      </div>
    );
  };
}
