/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { cf } from './suggested-conversation-topics.scss';

@observer
export class SuggestedConversationTopics extends Component {
  static propTypes = {
    contactFormModel: PropTypes.object,
  };

  getTopics = () => {
    const {
      contactFormModel: { propertyName },
    } = this.props;
    return [
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_ONE', { propertyName }),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_TWO'),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_THREE'),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_FOUR'),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_FIVE'),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_SIX'),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_SEVEN', { propertyName }),
      t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC_EIGHT'),
    ];
  };

  renderTopics() {
    const topics = this.getTopics();
    const topicLists = topics.map((topic, index) => (
      // TODO: We need to use a real id here
      // eslint-disable-next-line react/no-array-index-key
      <li key={index}>
        <T.SubHeader secondary className={cf('topic')}>
          {topic}
        </T.SubHeader>
        <div className={cf('topic-divider')} />
      </li>
    ));
    return <ul>{topicLists}</ul>;
  }

  render() {
    return (
      <div className={cf('suggested-conversation-topics')}>
        <T.Caption bold secondary className={cf('topic-title ')}>
          {t('ROOMMATE_SUGGESTED_CONVERSATION_TOPIC')}
        </T.Caption>
        {this.renderTopics()}
      </div>
    );
  }
}
