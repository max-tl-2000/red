/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DALTypes } from 'enums/DALTypes';
import { locals as styles, cf, g } from './CommunicationCard.scss';

const CommunicationCard = ({ communication }) => {
  const dir = communication.direction === DALTypes.CommunicationDirection.IN ? styles.in : styles.out;
  const statusInfo = (communication.status.status || []).map(s => <div key={s.address}>{`${s.address} ${s.status}`}</div>);
  const recipients = communication.message.to.join(', ');

  return (
    <div>
      <div className={cf('containerStyle', g(dir))}>
        <div className={styles.headerContainerStyle}>
          <div className={styles.titleStyle}>{communication.message.subject}</div>
          {communication.direction === DALTypes.CommunicationDirection.OUT && <div className={styles.statusContainer}>{statusInfo}</div>}
        </div>
        <div className={styles.subTitleStyle}>
          {/* TODO prefer css to align elements */}
          <span>From: &ensp;</span>
          <span>{communication.message.from}</span>
        </div>
        <div className={styles.subTitleStyle}>
          {/* TODO prefer css to align elements */}
          <span>To: &ensp;</span>
          <span>{recipients}</span>
        </div>
        <div className={styles.content}>{communication.message.text}</div>
        <div className={styles.separatorLine} />
      </div>
    </div>
  );
};

export default CommunicationCard;
