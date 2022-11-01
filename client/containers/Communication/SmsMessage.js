/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import { formatTimestamp } from 'helpers/date-utils';
import { windowOpen } from 'helpers/win-open';
import { cf } from './SmsMessage.scss';
import { IS_URL } from '../../../common/regex';

const { Text, Link } = Typography;

const getUrlSectionsFromMessage = message => {
  const urlRegex = new RegExp(IS_URL, 'g');
  const results = [];
  let match = urlRegex.exec(message);
  while (match !== null) {
    results.push({
      start: match.index,
      end: urlRegex.lastIndex,
      text: match[0],
      type: 'link',
    });
    match = urlRegex.exec(message);
  }
  return results;
};

const getTextSectionsFromMessage = (message, urlSections) => {
  const textSections = [];
  if (!urlSections.length) {
    return [{ start: 0, end: message.length, text: message, type: 'text' }];
  }
  // section at the begining of the string
  const firstUrlSection = urlSections[0];
  if (firstUrlSection.start > 0) {
    textSections.push({
      start: 0,
      end: firstUrlSection.start - 1,
      text: message.substring(0, firstUrlSection.start - 1),
      type: 'text',
    });
  }
  // sections between the url sections
  if (urlSections.length >= 2) {
    for (let i = 0; i < urlSections.length - 1; i++) {
      const currentUrlSection = urlSections[i];
      const nextUrlSection = urlSections[i + 1];
      const start = currentUrlSection.end;
      const end = nextUrlSection.start - 1;
      textSections.push({
        start,
        end,
        text: message.substring(start, end),
        type: 'text',
      });
    }
  }
  // section at the end of the string
  const lastUrlSection = urlSections[urlSections.length - 1];
  if (lastUrlSection.end < message.length) {
    textSections.push({
      start: lastUrlSection.end,
      end: message.length,
      text: message.substring(lastUrlSection.end, message.length),
      type: 'text',
    });
  }

  return textSections;
};

const renderContentUsingLinks = message => {
  const urlSections = getUrlSectionsFromMessage(message);
  const textSections = getTextSectionsFromMessage(message, urlSections);
  const allSections = [...textSections, ...urlSections].sort((a, b) => a.start - b.start);
  return allSections.map(p =>
    p.type === 'text' ? (
      p.text
    ) : (
      <Link key={p.start} href={p.text}>
        {p.text}
      </Link>
    ),
  );
};

const onClick = path => windowOpen(path, '_blank');

const renderMedia = attachaments =>
  attachaments.map(attachamentPath => (
    <div className={cf('image-row')} onClick={() => onClick(attachamentPath)} key={attachamentPath}>
      <img className={cf('inside-image')} src={attachamentPath} alt="" />
    </div>
  ));

const Message = ({ isOwner, time, content, sentBy, failureNotice, timezone, bounceMessage, shouldShowTypingIndicator, attachaments }) => (
  <div>
    <div className={cf('message', { owner: isOwner })}>
      <div>{renderMedia(attachaments)}</div>
      <div className={cf('body-section')}>
        <div>
          <Text lighter={isOwner}>{renderContentUsingLinks(content)}</Text>
        </div>
      </div>
      <div className={cf('meta-section')}>
        {(failureNotice || bounceMessage) && (
          <Text secondary inline error className={cf('failure-notice')}>
            {failureNotice || bounceMessage}
          </Text>
        )}
        <Text secondary inline className={cf('time')}>
          {sentBy && `${sentBy.fullName} `}
          {formatTimestamp(time, { timezone })}
        </Text>
      </div>
    </div>
    {shouldShowTypingIndicator && (
      <div className={cf('message', { owner: true })}>
        <div className={cf('body-section')}>
          <div>
            <img src="/images/typing-indicator@1x.gif" height="20px" />
          </div>
        </div>
      </div>
    )}
  </div>
);

export default Message;
