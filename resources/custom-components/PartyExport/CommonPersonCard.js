/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';

import { observer } from 'mobx-react';
import sass from 'node-sass';
import { t } from 'i18next';
import path from 'path';
import PersonViewModel from '../../../client/view-models/person';
import createElement from './create-element';
import Avatar from './Avatar';
import { getDisplayName } from '../../../common/helpers/person-helper';

const Caption = createElement('caption');
const Text = createElement('text');

@observer
export default class CommonPersonCard extends Component {
  static propTypes = {
    item: PropTypes.object,
  };

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './CommonPersonCard.scss') }).css.toString(), ...Avatar.styles];

  formatArray = array => array.map(object => object.value);

  renderContactsSummary = contacts => {
    const contactsInfo = this.formatArray(contacts);
    const contactSummary = contactsInfo.filter(o => o).join(', ');

    return (
      <Caption secondary data-id="contactSummary" style={{ fontSize: 7 }}>
        {contactSummary}
      </Caption>
    );
  };

  get personViewModel() {
    const { item } = this.props;
    return PersonViewModel.create(item);
  }

  render = () => {
    const person = this.personViewModel;
    const { item } = this.props;

    return (
      <div data-component="common-person-card" className="card-main-content">
        <div className="table-row">
          <div className="avatar">
            <Avatar userName={person.anyName} />
          </div>
          <div className="card-info">
            <Text bold data-id="cardTitle" style={{ fontSize: 7 }}>
              {getDisplayName(person)}
            </Text>
            {this.renderContactsSummary(person.emails)}
            {this.renderContactsSummary(person.phones)}
            {item.guaranteedFullName && (
              <Caption secondary style={{ fontSize: 7, color: '#A8A8A8' }}>
                {`${t('GUARANTOR_FOR')} ${item.guaranteedFullName}`}
              </Caption>
            )}
          </div>
        </div>
      </div>
    );
  };
}
