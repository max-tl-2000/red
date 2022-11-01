/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { formatTimestamp } from 'helpers/date-utils';
import ClampLines from 'react-clamp-lines';
import { t } from 'i18next';
import { cf, g } from './GroupMessage.scss';
import Icon from '../../components/Icon/Icon';
import { DALTypes } from '../../../common/enums/DALTypes';

const { Text } = Typography;

const GroupMessage = ({ id, time, title, content, sentBy, timezone, category, isDelivered, retractDetails }) => {
  const iconName = category === DALTypes.PostCategory.EMERGENCY ? 'message-alert' : 'message-bullhorn';
  const moreText = category === DALTypes.PostCategory.EMERGENCY ? t('VIEW_FULL_EMERGENCY') : t('VIEW_FULL_ANNOUNCEMENT');
  const { retractedReason } = retractDetails;

  return (
    <div>
      <div className={cf('message')}>
        <div className={cf('meta-section')}>
          <Text secondary inline className={cf('senderName')}>
            {sentBy && `${sentBy.fullName} `}
          </Text>
        </div>
        <div className={cf('body-wrapper')}>
          <Icon className={cf('icon')} disabled={retractedReason} iconStyle="dark" name={iconName} />
          <div className={cf('body-section')}>
            <div>
              <Text className={cf('title', retractedReason && g('textDisabled'))}>{title}</Text>
              <ClampLines
                text={content}
                id={id}
                lines={2}
                ellipsis="..."
                buttons={!retractedReason}
                moreText={moreText}
                lessText={t('COLLAPSE')}
                className={cf('clamped-text', retractedReason && g('textDisabled'))}
                innerElement="p"
              />
              {retractedReason && (
                <div className={cf('retracted')}>
                  <Text className={cf('title')} error inline>{`${t('RETRACTED')}: `}</Text>
                  <Text error inline>
                    {t(retractedReason)}
                  </Text>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={cf('meta-section')}>
          {isDelivered && <Icon className={cf('icon')} iconStyle="dark" name={'email'} />}
          <Text secondary inline className={cf('time')}>
            {formatTimestamp(time, { timezone })}
          </Text>
        </div>
      </div>
    </div>
  );
};
export default GroupMessage;
