/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import { Section, Typography, Button, RedTable } from 'components';
import { inject, observer } from 'mobx-react';
import { cf } from './LeftPanelContent.scss';
import PostDraftListItem from './PostDraftListItem';
import { toTitleCase } from '../../helpers/capitalize';
import PreloaderBlock from '../../components/PreloaderBlock/PreloaderBlock';
import { DALTypes } from '../../../common/enums/DALTypes';
import ellipsis from '../../../common/helpers/ellipsis';

const { Text, Caption } = Typography;
const { Table, Row, Cell } = RedTable;

const MAX_EMERGENCY_BUTTON_MESSAGE_CHARACTERS = 17;

@inject('post')
@observer
export default class LeftPanelContent extends Component {
  static propTypes = {
    onCreateAnnouncementClick: PropTypes.func,
    onCreateAlertClick: PropTypes.func,
  };

  componentDidMount() {
    this.props.post.loadDraftPosts();
  }

  render() {
    const {
      handleOpenPostForm,
      isSmallLayout,
      post: { draftPosts, isLoadingDraftPosts },
    } = this.props;

    const emergencyButtonMessage = isSmallLayout
      ? ellipsis(t('CREATE_EMERGENCY_MESSAGE'), MAX_EMERGENCY_BUTTON_MESSAGE_CHARACTERS)
      : t('CREATE_EMERGENCY_MESSAGE');
    return (
      <div>
        <Section className={cf('leftPanelContainer')}>
          <div className={cf('content-wrapper')}>
            <div className={cf('post-wrapper')}>
              <div>
                <Text className={cf('post-type')}>{t('CREATE_AN_ANNOUNCEMENT')}</Text>
                <Text className={cf('post-type-description')} secondary>
                  {t('CREATE_ANNOUNCEMENT_TXT')}
                </Text>
                <Button
                  label={t('CREATE_ANNOUNCEMENT')}
                  isCohort
                  type="raised"
                  btnRole="primary"
                  onClick={() => handleOpenPostForm(DALTypes.PostCategory.ANNOUNCEMENT)}
                />
              </div>
            </div>
            <div className={cf('post-wrapper')}>
              <div>
                <Text className={cf('post-type alert')}>{t('EMERGENCY_MESSAGE')}</Text>
                <Text className={cf('post-type-description')} secondary>
                  {t('CREATE_EMERGENCY_MESSAGE_TXT')}
                </Text>
                <Button label={emergencyButtonMessage} btnRole="secondary" type="raised" onClick={() => handleOpenPostForm(DALTypes.PostCategory.EMERGENCY)} />
              </div>
            </div>
          </div>
        </Section>
        <Section title={t('DRAFTS')} sectionTitleClassName={cf('draftSection')}>
          {!draftPosts.length ? (
            <Caption secondary>{t('NO_DRAFT_POST_MESSAGE_TXT')}</Caption>
          ) : (
            <Table>
              <Row fullWidthDivider>
                <Cell width={40} noPaddingLeft>
                  {t('TYPE')}
                </Cell>
                <Cell width={'40%'}>{t('TITLE')}</Cell>
                <Cell>{toTitleCase(t('TO'))}</Cell>
                <Cell>{t('CREATED_BY')}</Cell>
                <Cell textAlign="right" width={60} />
              </Row>
              {isLoadingDraftPosts ? (
                <PreloaderBlock size="small" />
              ) : (
                draftPosts.map(post => (
                  <PostDraftListItem
                    key={`draftPost-${post.id}`}
                    handleOpenPostForm={handleOpenPostForm}
                    postId={post.id}
                    postCategory={post.category}
                    postTitle={post.title}
                    postMessage={post.message}
                    postCreatedBy={post.createdBy}
                    documentMetadata={post.documentMetadata}
                  />
                ))
              )}
            </Table>
          )}
        </Section>
      </div>
    );
  }
}
