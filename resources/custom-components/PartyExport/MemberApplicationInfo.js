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
import { MONTH_DATE_YEAR_FORMAT } from '../../../common/date-constants';
import createElement from './create-element';
import { Title } from './Title';
import { formatMoment } from '../../../common/helpers/moment-utils';
const Text = createElement('text');

@observer
export default class MemberApplicationInfo extends Component {
  static propTypes = {
    applicationInfo: PropTypes.object,
  };

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './MemberApplicationInfo.scss') }).css.toString()];

  render() {
    const { applicationInfo } = this.props;
    const address = (applicationInfo.address && applicationInfo.address.enteredByUser) || {};
    // TODO: ask Avantica as we might need the timezone here to pass it to formatMoment
    return (
      <div className="member-application-info">
        <div>
          <Title text={`${t('APPLICATION_INFO')} - ${applicationInfo.fullName}`} />
          <Text style={{ fontSize: 7, paddingLeft: 5, color: '#A8A8A8' }}>{`${t('LAST_EDITED')}: ${formatMoment(applicationInfo.lastEdited, {
            format: MONTH_DATE_YEAR_FORMAT,
          })}`}</Text>
        </div>
        <div>
          <Text style={{ fontSize: 7, fontWeight: 'bold' }}>{`${t('DATE_OF_BIRTH')}: `}</Text>
          <Text style={{ fontSize: 7, paddingLeft: 5 }}>{formatMoment(applicationInfo.dateOfBirth, { format: MONTH_DATE_YEAR_FORMAT })}</Text>
        </div>
        <div>
          <Text style={{ fontSize: 7, fontWeight: 'bold' }}>{`${t('GROSS_INCOME')}:`}</Text>
          <Text style={{ fontSize: 7, paddingLeft: 5 }}>{`$${applicationInfo.grossIncome}`}</Text>
        </div>
        <div>
          <Text style={{ fontSize: 7, fontWeight: 'bold' }}>{`${t('CURRENT_ADDRESS')}: `}</Text>
        </div>
        <Text style={{ fontSize: 7 }}>{address.line1}</Text>
        {address.line2 && <Text style={{ fontSize: 7 }}>{address.line2}</Text>}
        <Text style={{ fontSize: 7 }}>{`${address.city} ${address.state} ${address.postalCode}`}</Text>
      </div>
    );
  }
}
