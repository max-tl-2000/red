/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { computed } from 'mobx';
import v4 from 'uuid/v4';
import { t } from 'i18next';
import Request from '../../../common/client/request';

class TemplateExpanderManager {
  constructor(client) {
    this.id = v4();
    this.client = client;
    this.rqTemplateList = Request.create({
      call: async ({ propertyId }) => {
        if (!propertyId) throw new TypeError('Missing propertyId');

        const p = this.client.get(`/templates/${propertyId}/shortCodes`);
        p.catch(err => {
          err.__handled = true;
          console.warn(`Error fetching shortcodes for property ${propertyId}`);
        });
        const data = await p;

        return { data };
      },
    });

    this.rqRenderer = Request.create({
      call: async ({ templateId, templateName, partyId, context = {}, templateDataOverride = {}, templateArgs = {} }) => {
        if (!partyId) throw new TypeError('Missing partyId');
        const url = templateId ? `/templates/${templateId}/render` : `/templates/${templateName}/renderByName`;
        const p = this.client.post(url, { data: { partyId, context, templateDataOverride, templateArgs: { ...templateArgs, isPreview: true } } });
        p.catch(err => {
          err.__handled = true;
        });
        const template = (await p) || {};
        const { missingTokens = [] } = template;
        if (missingTokens.length > 0) throw new Error(`FAIL_TO_PARSE_TEMPLATE. Missing variables: ${missingTokens}`);
        return template;
      },
    });
  }

  loadTemplatesForProperty = propertyId => {
    this.propertyId = propertyId;
    this.doLoadTemplates();
  };

  doLoadTemplates = () => {
    const { propertyId, rqTemplateList } = this;
    return rqTemplateList.execCall({ propertyId });
  };

  @computed
  get templates() {
    return this.rqTemplateList.response.data || [];
  }

  @computed
  get templateRendered() {
    return this.rqRenderer.response;
  }

  _renderTemplate = async ({ partyId, templateDataOverride, templateArgs, context, templateId, templateName } = {}) => {
    const { rqRenderer } = this;
    await rqRenderer.execCall({ partyId, templateDataOverride, templateArgs, context, templateId, templateName });
  };

  @computed
  get busy() {
    const { rqRenderer, rqTemplateList } = this;
    return rqRenderer.loading || rqTemplateList.loading;
  }

  renderTemplate = async ({ word, partyId, templateDataOverride, templateArgs, context }) => {
    const template = this.templates.find(temp => temp.shortCode === word);

    if (!template) return null;

    if (template.inactive) return { body: t('SHORTCODE_DEACTIVATED_CONTACT_ADMIN') };

    await this._renderTemplate({ partyId, templateId: template.templateId, context, templateDataOverride, templateArgs });

    return this.templateRendered;
  };

  renderTemplateByName = async (templateName, { partyId, templateDataOverride, templateArgs, context }) => {
    await this._renderTemplate({ partyId, templateName, context, templateDataOverride, templateArgs });

    return this.templateRendered;
  };

  @computed
  get templateRenderError() {
    return this.rqRenderer.error;
  }

  clearError = () => this.rqRenderer.clearError();
}

let managers = [];
// factory function that will be injected to all EmailFlyouts to obtain
// an instance of the templateExpanderManager
export const createTemplateManagerFactory = apiClient => ({
  create: () => {
    const instance = new TemplateExpanderManager(apiClient);
    managers.push(instance);

    return instance;
  },
  removeInstance: instance => {
    managers = managers.filter(manager => manager.id !== instance.id);
  },
  getInstances: () => managers,
});
