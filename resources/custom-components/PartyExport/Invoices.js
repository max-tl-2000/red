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
import { formatMoment } from '../../../common/helpers/moment-utils';
const Text = createElement('text');

@observer
export default class Invoices extends Component {
  static propTypes = {
    invoices: PropTypes.array,
  };

  static styles = [sass.renderSync({ file: path.resolve(__dirname, './Table.scss') }).css.toString()];

  // TODO: Ask Avantica as we probably need the timezone here for formatMoment
  renderInvoice = (invoice, key) => (
    <div className="table-record" key={key}>
      <div>
        <Text style={{ fontSize: 7 }}> {`${invoice.displayName} ${t('ORIGIN_FROM').toLowerCase()} ${invoice.fullName}`} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7 }}> {`${formatMoment(invoice.createdAt, { format: MONTH_DATE_YEAR_FORMAT })}`} </Text>
      </div>
      <div>
        <Text style={{ fontSize: 7 }}> {`$${invoice.amount}`} </Text>
      </div>
    </div>
  );

  render() {
    const { invoices } = this.props;

    return <div className="records">{invoices.map((invoice, index) => this.renderInvoice(invoice, index))}</div>;
  }
}
