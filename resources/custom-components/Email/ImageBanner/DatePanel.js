/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import * as T from '../Typography/Typography';
import { MONTH_NAME_FORMAT, DAY_OF_MONTH_FORMAT, YEAR_FORMAT, TIME_PERIOD_FORMAT } from '../../../../common/date-constants';
import { toMoment } from '../../../../common/helpers/moment-utils';

const DatePanel = ({ startDate, dateBackgroundColor, height }) => (
  <td width="274" height={height} style={{ width: 274, height, color: '#fff', backgroundColor: dateBackgroundColor || '#715e46', margin: 0, padding: 0 }}>
    <T.Text style={{ textAlign: 'center', margin: 0, fontSize: 15, lineHeight: '24px', color: '#fff' }}>{toMoment(startDate).format(MONTH_NAME_FORMAT)}</T.Text>
    <T.Text style={{ textAlign: 'center', margin: 0, fontSize: 45, lineHeight: '48px', color: '#fff' }}>
      {toMoment(startDate).format(DAY_OF_MONTH_FORMAT)}
    </T.Text>
    <T.Text style={{ textAlign: 'center', margin: '0 0 7px', fontSize: 15, lineHeight: '24px', color: '#fff' }}>
      {toMoment(startDate).format(YEAR_FORMAT)}
    </T.Text>
    <div style={{ width: 100, margin: '0 auto', height: 1, borderTop: '1px solid #fff' }} />
    <T.Text style={{ textAlign: 'center', margin: '8px 0 0', fontSize: 20, lineHeight: '28px', fontWeight: 500, color: '#fff' }}>
      {toMoment(startDate).format(TIME_PERIOD_FORMAT)}
    </T.Text>
  </td>
);

export default DatePanel;
