/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { observer } from 'mobx-react';
import { Button } from 'components';
import Text from 'components/Typography/Text';
import { t } from 'i18next';
import { toTitleCase } from 'helpers/capitalize';
import { cf, g } from './application-card.scss';
import { getLayoutImage } from '../../../../common/helpers/cloudinary';
import { MONTH_DATE_YEAR_LONG_FORMAT } from '../../../../common/date-constants';
import { formatMoment } from '../../../../common/helpers/moment-utils';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { convertToCamelCaseAndRemoveBrackets } from '../../../../common/helpers/strings';

const getIncludes = ({ numberOfPets, numberOfChildren }) => {
  const includes = [];
  numberOfPets && includes.push(`${numberOfPets} ${t('PET', { count: numberOfPets })}`);
  numberOfChildren && includes.push(`${numberOfChildren} ${t('CHILDREN', { count: numberOfChildren })}`);
  return includes.join(t('AND'));
};

const getApplicationStatus = application => {
  const { applicationStatus, isApplicantRemovedFromParty } = application;
  if (isApplicantRemovedFromParty) return t('EXPIRED');
  if ([DALTypes.PersonApplicationStatus.OPENED, DALTypes.PersonApplicationStatus.PAID].includes(applicationStatus)) return t('IN_PROGRESS');

  return t(applicationStatus);
};

const getLabelButton = application => {
  const { applicationStatus, isApplicantRemovedFromParty } = application;

  if (applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED || isApplicantRemovedFromParty) return t('OPEN');

  return t('CONTINUE');
};

export const ApplicationCard = observer(({ item = {}, handleOnApplicationClick, className = '', onClick = () => {} }) => {
  const details = [];

  item.unitImageUrl &&
    details.push(
      <div className={cf('img-container')}>
        <img src={getLayoutImage(item.unitImageUrl, { width: 296, height: 296 })} alt={t('PROPERTY')} onClick={onClick} />
        <div className={cf('overlay')} onClick={() => handleOnApplicationClick(item)} />
      </div>,
    );
  item.property && details.push(<Text id={`${convertToCamelCaseAndRemoveBrackets(item.property)}Txt`}>{t(item.property)}</Text>);
  item.alongWith && details.push(<Text secondary>{`${t('ALONG_WITH')}: ${item.alongWith}`}</Text>);
  (item.numberOfPets || item.numberOfChildren) && details.push(<Text secondary>{`${t('INCLUDES')}: ${getIncludes(item)}`}</Text>);
  item.lastUpdated && details.push(<Text secondary>{`${t('LAST_EDITED')}: ${formatMoment(item.lastUpdated, { format: MONTH_DATE_YEAR_LONG_FORMAT })}`}</Text>);
  item.applicationStatus &&
    details.push(
      <Text id={`${convertToCamelCaseAndRemoveBrackets(item.property + getApplicationStatus(item))}Txt`} secondary>{`${t('STATUS')}: ${toTitleCase(
        getApplicationStatus(item),
      )}`}</Text>,
    );

  details.push(
    <Button
      id={`${convertToCamelCaseAndRemoveBrackets(item.property + getLabelButton(item))}Btn`}
      type="flat"
      label={getLabelButton(item).toLowerCase()}
      onClick={() => handleOnApplicationClick(item)}
      style={{ textTransform: 'capitalize' }}
    />,
  );

  return (
    <div className={cf('application-card', g(className))}>
      {details.map((line, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div key={`${item.id}_${i}`}>{line}</div>
      ))}
    </div>
  );
});

ApplicationCard.propTypes = {
  item: PropTypes.object,
};
