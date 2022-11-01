/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { toSentenceCase } from 'helpers/capitalize';
import { DALTypes } from 'enums/DALTypes';
import { cf } from './CommunicationThreadCard.scss';
import { isLastCommUnreadByUser, getCommHeaderPrefix } from '../../helpers/communications';
import { getDisplayName } from '../../../common/helpers/person-helper';

const renderSecondaryParticipants = secondaryParticipants => {
  const [secondaryParticipant, ...otherSecondaryParticipants] = secondaryParticipants;
  return (
    <span>
      {secondaryParticipant && `, ${secondaryParticipant}`}
      {(otherSecondaryParticipants.length && ', ') || ''}
      {(otherSecondaryParticipants.length && <span className={cf('secondaryParticipants')}>{otherSecondaryParticipants.join(', ')}</span>) || ''}
    </span>
  );
};

export default ({ participants = [], secondaryParticipants = [], mostRecentComm, threadComms = [], id = '' }) => {
  const isUnread = isLastCommUnreadByUser(threadComms);
  const headerPrefix = getCommHeaderPrefix(mostRecentComm.message);

  return (
    <span>
      {headerPrefix && <span>{headerPrefix}</span>}
      {mostRecentComm.type !== DALTypes.CommunicationMessageType.CALL && threadComms.every(c => c.direction === 'out') && `${toSentenceCase(t('TO'))}: `}
      {participants.toArray().map((participant, index) => (
        <span id={`emailThreadContactNameTxt_${id}`} key={participant.id} className={cf({ unreadState: isUnread && index === 0 })}>
          {getDisplayName(participant)}
          {index !== participants.size - 1 && ', '}
        </span>
      ))}
      {renderSecondaryParticipants(secondaryParticipants)}
      {mostRecentComm.type !== DALTypes.CommunicationMessageType.CALL &&
        mostRecentComm.type !== DALTypes.CommunicationMessageType.DIRECT_MESSAGE &&
        mostRecentComm.direction === 'out' &&
        threadComms.some(c => c.direction === 'in') &&
        `, ${t('ME')}`}
    </span>
  );
};
