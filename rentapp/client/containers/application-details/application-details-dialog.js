/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { t } from 'i18next';
import { Dialog, DialogOverlay, Button, Typography as T, DialogActions, DialogHeader, GeminiScrollbar } from 'components';
import { ApplicationDetails } from './application-details';
import { cf } from './application-details-dialog.scss';
import { ForbidEditionBanner } from '../application/forbid-application-edition-banner';

@inject('application')
@observer
export class ApplicationDetailsDialog extends Component {
  constructor(props) {
    super(props);
    this.id = generateId(this);
  }

  static propTypes = {
    open: PropTypes.bool,
    onSubmit: PropTypes.func,
    onCancel: PropTypes.func,
    applicantModel: PropTypes.object,
    isGuarantor: PropTypes.bool,
    isReadOnly: PropTypes.bool,
  };

  get isSubmitDisabled() {
    const { isDirty, valid, interacted, requiredAreFilled } = this.props.applicantModel;
    const { isReadOnly } = this.props;
    const disabledSubmit = !requiredAreFilled || !valid || !interacted;
    return disabledSubmit || !isDirty || isReadOnly;
  }

  render() {
    const { onSubmit, onCancel, id, open, applicantModel, isGuarantor, isReadOnly } = this.props;

    const theId = clsc(id, this.id);

    return (
      <Dialog open={open} id={theId} onCloseRequest={onCancel}>
        <DialogOverlay className={cf('applicant-dialog')} container={false}>
          <DialogHeader title={t('EDIT_APPLICANT_INFORMATION_TITLE')} />
          {!isReadOnly && (
            <T.Text className={cf('info-text')} secondary>
              {t('EDIT_APPLICANT_INFORMATION_INFO_TEXT')}
            </T.Text>
          )}
          {isReadOnly && <ForbidEditionBanner />}
          <GeminiScrollbar className={cf('main-section')}>
            <ApplicationDetails
              model={applicantModel}
              isGuarantor={isGuarantor}
              isReadOnly={isReadOnly}
              isEmailDisabled={true}
              displayInviteGuarantor={true}
              invitesDisabled={true}
            />
          </GeminiScrollbar>
          <DialogActions dividerOnTop>
            <Button type="flat" btnRole="secondary" label={isReadOnly ? t('CLOSE') : t('CANCEL')} onClick={onCancel} />
            {!isReadOnly && <Button type="flat" onClick={onSubmit} label={t('SUBMIT')} disabled={this.isSubmitDisabled} />}
          </DialogActions>
        </DialogOverlay>
      </Dialog>
    );
  }
}
