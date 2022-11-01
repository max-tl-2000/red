/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography, Avatar } from 'components';
import { t } from 'i18next';
import { cf } from './PostInfoSection.scss';
import cfg from '../../../helpers/cfg';
import { getSmallAvatar } from '../../../../common/helpers/cloudinary';
import { History, Pencil } from '../../../red-icons/index';
import { toMoment, formatMoment } from '../../../../common/helpers/moment-utils.ts';
import { ORDINAL_DAY_3_LETTER_MONTH_FORMAT } from '../../../../common/date-constants';
import { getStatisticPercentage } from '../../../helpers/postHelpers';

const { Text } = Typography;

const PostInfoSection = ({ post = {}, isReadOnly, user = {} }) => {
  const { created_at, updated_at, createdBy, updatedBy, sentAt, postStatistics, sentByAgent } = post;

  const renderStatisticBlock = (title, value, additionalInfo) => (
    <div className={cf('statisticsRow')}>
      <Text secondary>{title}</Text>
      <Text className={cf('data')}>{value}</Text>
      <Text secondary>{additionalInfo}</Text>
    </div>
  );

  const renderInfo = () => {
    if (user.fullName) {
      const { fullName, avatarUrl } = user;
      const userAvatarUrl = getSmallAvatar(avatarUrl);

      return (
        <div>
          <div className={cf('postInfoRow')}>
            <Avatar className={cf('avatarSize')} userName={fullName} src={userAvatarUrl} circle />
            <Text secondary>{t('POST_ALREADY_SENT_TXT', { fullName })}</Text>
          </div>
        </div>
      );
    }

    if (!isReadOnly) {
      const createdAt = formatMoment(toMoment(created_at), { format: ORDINAL_DAY_3_LETTER_MONTH_FORMAT });
      const updatedAt = formatMoment(toMoment(updated_at), { format: ORDINAL_DAY_3_LETTER_MONTH_FORMAT });

      return (
        <div className={cf('readOnlyWrapper')}>
          <div className={cf('postInfoRow rowMargin')}>
            <Pencil className={cf('icon')} />
            <Text secondary>{t('POST_CREATED_ON', { createdAt, userFullName: createdBy })}</Text>
          </div>
          <div className={cf('postInfoRow')}>
            <History className={cf('icon')} />
            <Text secondary>{t('POST_UPDATED_ON', { updatedAt, userFullName: updatedBy })}</Text>
          </div>
        </div>
      );
    }
    const { totalRecipientsInInitialFile, recipientsWhoClicked, recipientsWhoReceived, recipientsWhoViewed, noOfUsersWhoVisitedLinks } = postStatistics;
    const urls = cfg('urls');
    const postSentAt = formatMoment(toMoment(sentAt), { format: ORDINAL_DAY_3_LETTER_MONTH_FORMAT });
    const percentageReceived = getStatisticPercentage(recipientsWhoReceived, totalRecipientsInInitialFile);
    const percentageViewed = getStatisticPercentage(recipientsWhoViewed, recipientsWhoReceived);
    const percentageClicked = getStatisticPercentage(recipientsWhoClicked, recipientsWhoReceived);
    const percentageLinksClicked = getStatisticPercentage(noOfUsersWhoVisitedLinks, recipientsWhoReceived);

    return (
      <div>
        <div className={cf('statisticsWrapper')}>
          {renderStatisticBlock(t('TOTAL_RECIPIENTS'), recipientsWhoReceived, t('PERCENTAGE_RECEIVED', { percent: `${percentageReceived}%` }))}
          {renderStatisticBlock(t('POST_VIEWS'), `${percentageViewed}%`, t('POST_VIEWS_IN_FEED', { noOfViews: recipientsWhoViewed }))}
          {renderStatisticBlock(t('DETAIL_VIEWS'), `${percentageClicked}%`, t('POST_CLICKS', { noOfClicks: recipientsWhoClicked }))}
          {renderStatisticBlock(t('LINK_CLICK_RATE'), `${percentageLinksClicked}%`, t('LINKS_CLICKED', { noOfUsers: noOfUsersWhoVisitedLinks }))}
        </div>
        <div className={cf('bottomWrapper')}>
          <Text secondary>{t('POSTED_ON', { sentAt: postSentAt, userFullName: sentByAgent })}</Text>
          <div className={cf('reportingSection')}>
            <Text secondary>{t('DETAILED_METRICS')}</Text>
            <a className={cf('metricMargin')} href={urls.reportingSignIn}>
              {t('REVA_REPORTING')}
            </a>
          </div>
        </div>
      </div>
    );
  };

  return <div className={cf('post-info-section')}>{renderInfo()}</div>;
};

export default PostInfoSection;
