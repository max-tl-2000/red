/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { t } from 'i18next';
import { Card, Typography } from 'components';
import { convertFromHTML, convertFromRaw, Editor, EditorState, ContentState } from 'draft-js';
import { MessageBullhorn, MessageAlert } from '../../red-icons/index';
import { cf } from './PostCard.scss';
import { DALTypes } from '../../../common/enums/DALTypes';
import { formatTimestamp } from '../../../common/helpers/date-utils';
import tryParse from '../../../common/helpers/try-parse';
import { formatRichTextBreakLines } from '../../helpers/richTextHelpers';
import { getStatisticPercentage } from '../../helpers/postHelpers';

const { Text, SubHeader } = Typography;

export default class PostCard extends Component {
  static propTypes = {
    postCategory: PropTypes.string,
    message: PropTypes.string,
    title: PropTypes.string,
    sentAt: PropTypes.string,
    postId: PropTypes.string,
    timezone: PropTypes.string,
  };

  getIconComponent() {
    const { category } = this.props.postInfo;
    if (category === DALTypes.PostCategory.EMERGENCY) return <MessageAlert className={cf('icon alert')} />;

    return <MessageBullhorn className={cf('icon announcement')} />;
  }

  handleClick = () => {
    const { postInfo, handleOpenPostForm } = this.props;
    const { category, id } = postInfo;

    handleOpenPostForm(category, id);
  };

  renderStatisticBlock = (title, value, isRetracted) => (
    <div className={cf('statisticsWrapper')}>
      <Text secondary className={cf(`statisticsTitle ${isRetracted ? 'retracted' : ''}`)}>
        {title}
      </Text>
      <Text className={cf(`statisticsValues ${isRetracted ? 'retracted' : ''}`)}>{value}</Text>
    </div>
  );

  render() {
    const { category, title, sentAt, message: htmlMessage, rawMessage, retractedAt, metadata, previewStatistics, heroImageURL } = this.props.postInfo;
    const { recipientsWhoReceived, recipientsWhoViewed, recipientsWhoClicked } = previewStatistics;
    const retractedReasonText = t(`${metadata?.retractDetails?.retractedReason}`);
    const percentageViewed = getStatisticPercentage(recipientsWhoViewed, recipientsWhoReceived);
    const percentageClicked = getStatisticPercentage(recipientsWhoClicked, recipientsWhoReceived);
    const isRetracted = !!retractedAt;

    let editorState;

    if (rawMessage) {
      editorState = EditorState.createWithContent(convertFromRaw(tryParse(rawMessage)));
    } else if (htmlMessage) {
      const htmlFormatted = category === DALTypes.PostCategory.EMERGENCY ? formatRichTextBreakLines(htmlMessage) : htmlMessage;
      const blocksFromHTMLStoredInDB = convertFromHTML(htmlFormatted);
      const DBEditorState = ContentState.createFromBlockArray(blocksFromHTMLStoredInDB.contentBlocks, blocksFromHTMLStoredInDB.entityMap);
      editorState = EditorState.createWithContent(DBEditorState);
    } else {
      editorState = EditorState.createEmpty();
    }

    return (
      <Card container={false} className={cf('post-card')} onClick={this.handleClick}>
        <div className={cf('header')}>
          {this.getIconComponent()}
          <Text secondary className={cf('post-type')}>
            {t(category.toUpperCase())}
          </Text>
          <Text secondary className={cf('date')}>
            {formatTimestamp(sentAt, {})}
          </Text>
        </div>
        {!isRetracted && (
          <div className={cf('content')}>
            {heroImageURL && <img alt="post-banner" className={cf('banner-image')} src={heroImageURL} />}
            <SubHeader className={cf('post-title')}>{title}</SubHeader>
            <div className={cf('post-description')}>
              <Editor readOnly={true} editorState={editorState} />
            </div>
          </div>
        )}
        {isRetracted && (
          <div>
            <div className={cf('content retracted')}>
              {heroImageURL && <img alt="post-banner" className={cf('banner-image retracted')} src={heroImageURL} />}
              <SubHeader className={cf('post-title retracted')}>{title}</SubHeader>
              <div className={cf('retracted-bar')} />
              <div className={cf('retracted-bar')} />
              <div className={cf('retracted-bar')} />
            </div>
          </div>
        )}
        <div className={cf('statisticsContainer')}>
          {this.renderStatisticBlock(t('TOTAL_RECIPIENTS'), recipientsWhoReceived, isRetracted)}
          {this.renderStatisticBlock(t('POST_VIEWS'), `${percentageViewed}%`, isRetracted)}
          {this.renderStatisticBlock(t('DETAIL_VIEWS'), `${percentageClicked}%`, isRetracted)}
        </div>
        {isRetracted && (
          <div className={cf('retracted-reason')}>
            <Text className={cf('retracted-text reason')}>{`${t('RETRACTED')}: `}</Text>
            <Text className={cf('retracted-text')}>{retractedReasonText}</Text>
          </div>
        )}
      </Card>
    );
  }
}
