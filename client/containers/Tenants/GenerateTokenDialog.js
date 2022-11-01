/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import CopyToClipboard from 'react-copy-to-clipboard';
import { observer } from 'mobx-react';
import { action } from 'mobx';
import trim from 'helpers/trim';
import { t } from 'i18next';
import { Typography as T, Button, Dialog, TextBox, DialogOverlay, DialogActions, DialogHeader, Form, Field, PreloaderBlock, CheckBox } from 'components';
import { createModel } from 'helpers/Form/FormModel';
import notifier from 'helpers/notifier/notifier';
import { isDomain } from '../../../common/regex';
import { cf } from './GenerateTokenDialog.scss';

const DIALOG_STEPS = {
  ENTER_DOMAIN: 1,
  DISPLAY_TOKEN: 2,
};

@observer
export default class GenerateTokenDialog extends Component {
  constructor(props) {
    super(props);

    const tokenDialogModel = createModel(
      {
        domain: '',
        token: '',
        useDefaultWebsiteTokenId: false,
        shouldValidateReferrer: true,
        allowedEndpoints: ['marketing/'].join('\n'),
      },
      {
        domain: {
          fn: ({ value: domain }) => {
            const domains = this.splitItemsAndRemoveSpaces(trim(domain));

            if (!domains.length) return { error: t('DOMAIN_REQUIRED') };

            if (!domains.every(isDomain)) return { error: t('VALID_DOMAIN_REQUIRED') };
            return true;
          },
        },
      },
    );

    this.state = {
      tokenDialogModel,
      step: DIALOG_STEPS.ENTER_DOMAIN,
    };
  }

  componentDidUpdate(prevProps) {
    if (this.props.token !== prevProps.token) {
      this.updateModel('token', this.props.token);
    }
  }

  handleSetDomain = ({ value }) => {
    const { tokenDialogModel } = this.state;
    tokenDialogModel.updateField('domain', value);
  };

  updateModel = (fieldName, value) => {
    const { tokenDialogModel } = this.state;
    tokenDialogModel.updateField(fieldName, value);
  };

  @action
  clearModel = () => {
    const { tokenDialogModel } = this.state;
    tokenDialogModel.updateField('token', '', true);
    tokenDialogModel.updateField('domain', '', true);
    tokenDialogModel.updateField('useDefaultWebsiteTokenId', false, true);
    tokenDialogModel.updateField('shouldValidateReferrer', true, true);
  };

  splitItemsAndRemoveSpaces = input => (input || '').split(/\n+/).filter(it => it);

  handleGenerateToken = async () => {
    const { tokenDialogModel } = this.state;

    await tokenDialogModel?.validate();

    if (!tokenDialogModel.valid) return;
    const {
      domain: domainString,
      useDefaultWebsiteTokenId,
      shouldValidateReferrer,
      allowedEndpoints: allowedEndpointsString,
    } = tokenDialogModel.serializedData;
    const allowedEndpoints = this.splitItemsAndRemoveSpaces(allowedEndpointsString);
    const domain = this.splitItemsAndRemoveSpaces(domainString);
    const { generateTokenMethod, tenant } = this.props;
    generateTokenMethod &&
      generateTokenMethod({
        domain: domain.length === 1 ? domain[0] : domain,
        tenantId: tenant?.id,
        useDefaultWebsiteTokenId,
        shouldValidateReferrer,
        allowedEndpoints,
      });
    this.setState({ step: DIALOG_STEPS.DISPLAY_TOKEN });
  };

  renderDomainStep = tokenDialogModel => {
    const { domain, useDefaultWebsiteTokenId, shouldValidateReferrer, allowedEndpoints } = tokenDialogModel?.fields;

    return (
      <DialogOverlay className={cf('mainContent')}>
        <DialogHeader>
          <T.Title ellipsis>{t('GENERATE_TOKEN_DIALOG_TITLE')}</T.Title>
          <T.SubHeader secondary>{t('GENERATE_TOKEN_SUBTITLE')}</T.SubHeader>
        </DialogHeader>
        <Form>
          <Field>
            <TextBox
              autoFocus
              wide
              multiline
              label={t('DOMAIN_LABEL')}
              errorMessage={domain.errorMessage}
              onChange={({ value }) => this.updateModel('domain', value)}
            />
          </Field>
          <Field>
            <CheckBox
              checked={useDefaultWebsiteTokenId.value}
              label={t('USE_DEFAULT_TOKEN_ID')}
              onChange={checked => this.updateModel('useDefaultWebsiteTokenId', checked)}
            />
          </Field>
          <Field>
            <CheckBox
              checked={shouldValidateReferrer.value}
              label={t('VALIDATE_REFERRER')}
              onChange={checked => this.updateModel('shouldValidateReferrer', checked)}
            />
          </Field>
          <Field>
            <TextBox
              multiline
              wide
              label={t('ALLOWED_ENDPOINTS')}
              value={allowedEndpoints.value}
              onChange={({ value }) => this.updateModel('allowedEndpoints', value)}
            />
          </Field>
        </Form>
        <DialogActions>
          <Button type="flat" btnRole="secondary" label={t('CANCEL')} data-action="close" />
          <Button type="flat" btnRole="primary" label={t('GENERATE_TOKEN')} onClick={this.handleGenerateToken} />
        </DialogActions>
      </DialogOverlay>
    );
  };

  renderTokenStep = data => {
    const { isGeneratingToken, tenant } = this.props;

    return (
      <DialogOverlay className={cf('mainContent')}>
        <DialogHeader>
          <T.Title ellipsis>{isGeneratingToken ? t('GENERATING_TOKEN') : t('NEW_TOKEN_READY')}</T.Title>
          {!isGeneratingToken && <T.SubHeader secondary>{t('NEW_TOKEN_DESCRIPTION', { tenant: tenant?.name, domain: data.domain })}</T.SubHeader>}
        </DialogHeader>
        {isGeneratingToken && <PreloaderBlock size="small" />}
        {!isGeneratingToken && (
          <Form>
            <Field>
              <TextBox autoFocus readOnly wide label={t('NEW_TOKEN')} value={data.token} />
            </Field>
          </Form>
        )}
        <DialogActions>
          <Button type="flat" btnRole="secondary" label={t('CLOSE')} data-action="close" disabled={isGeneratingToken} />
          <CopyToClipboard text={data.token} onCopy={() => notifier.success(t('TOKEN_COPIED'))}>
            <Button type="flat" btnRole="primary" label={t('COPY_TOKEN')} disabled={isGeneratingToken} />
          </CopyToClipboard>
        </DialogActions>
      </DialogOverlay>
    );
  };

  closeDialog = () => {
    const { props } = this;
    this.clearModel();
    this.setState({ step: DIALOG_STEPS.ENTER_DOMAIN });

    const { onClickCancel } = props;
    onClickCancel && onClickCancel();
  };

  render() {
    const { open } = this.props;
    const { tokenDialogModel, step } = this.state;
    const { serializedData } = tokenDialogModel;

    return (
      <Dialog type="modal" open={open} onCloseRequest={this.closeDialog}>
        {step === DIALOG_STEPS.ENTER_DOMAIN ? this.renderDomainStep(tokenDialogModel) : this.renderTokenStep(serializedData)}
      </Dialog>
    );
  }
}
