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
import * as T from '../../components/Typography/Typography';
import { cf } from './CompanyCard.scss';

export default class CompanyCard extends Component {
  static propTypes = {
    companyId: PropTypes.string,
    companyName: PropTypes.string,
    partyMember: PropTypes.object,
  };

  handleClick = e => {
    const { onItemSelected, companyId, companyName } = this.props;
    onItemSelected && onItemSelected(e, { companyId, companyName });
  };

  render = () => {
    const { companyName, pointOfContact } = this.props;
    return (
      <div className={cf('main-content')} onClick={this.handleClick}>
        <div className={cf('avatar')}>
          <Avatar userName={companyName} />
        </div>
        <div>
          {<T.Text bold>{companyName}</T.Text>}
          {pointOfContact && <T.Caption secondary>{t('ONE_POINT_OF_CONTACT')}</T.Caption>}
        </div>
      </div>
    );
  };
}
