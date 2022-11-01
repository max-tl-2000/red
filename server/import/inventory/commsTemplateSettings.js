/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import { getCommsTemplateSettingProperties } from '../../dal/commsTemplateRepo.js';
import { saveCommsTemplateSetting } from '../../services/templates.js';
import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { getProperties } from '../../dal/propertyRepo';
import { TemplateSections, TemplateActions } from '../../../common/enums/templateTypes';

const INVALID_DUPLICATED_COMMS_TEMPLATE_SETTING = 'INVALID_DUPLICATED_COMMS_TEMPLATE_SETTING';

const COMMS_TEMPLATE_SETTING_REQUIRED_FIELDS = [
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'virtualTour\ncreatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'virtualTour\ncancelledTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'virtualTour\nupdatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'virtualTour\ncreatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'virtualTour\nupdatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonTour\ncreatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonTour\ncancelledTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonTour\nupdatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonTour\ncreatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonTour\nupdatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonSelfGuidedTour\ncreatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonSelfGuidedTour\ncancelledTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonSelfGuidedTour\nupdatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonSelfGuidedTour\ncreatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'inPersonSelfGuidedTour\nupdatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'leasingAppointment\ncreatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'leasingAppointment\ncancelledTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'leasingAppointment\nupdatedTemplate',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'leasingAppointment\ncreatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'leasingAppointment\nupdatedTemplateWithEditLink',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'notification\nrxpAnnouncement',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'notification\nrxpAlert',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'notification\nrxpDirectMessage',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'consumerAccount\nnewResidentRegistration',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'consumerAccount\nregistrationConfirmation',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'consumerAccount\nresidentInvitation',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'consumerAccount\nchangePassword',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'consumerAccount\nchangePasswordConfirmation',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'quote\nrenewalLetter',
    validation: [Validation.NOT_EMPTY],
  },
  {
    fieldName: 'screening\ndeclineAALetter',
    validation: [Validation.NOT_EMPTY],
  },
];

const validateUniqueName = (commsTemplateProperty, commsTemplateProperties) => {
  if (commsTemplateProperties.filter(name => commsTemplateProperty === name).length < 2) return [];

  return [
    {
      name: commsTemplateProperty,
      message: INVALID_DUPLICATED_COMMS_TEMPLATE_SETTING,
    },
  ];
};

const getInvalidPropertySettingsSetup = (properties, templateProperties) => {
  const settingsQuantity = COMMS_TEMPLATE_SETTING_REQUIRED_FIELDS.length - 1; // Resting the property
  return properties.reduce(
    (validation, property) => {
      if (!templateProperties.some(tp => tp.propertyId === property.id && parseInt(tp.quantity, 10) === settingsQuantity)) {
        validation.invalidFields.push({
          name: 'Comms Template Settings',
          message: `Settings not configured for property: ${property.name}, it should have ${settingsQuantity} settings`,
        });
      }
      return validation;
    },
    { invalidFields: [] },
  );
};

const saveCommsTemplateSettingsData = async (ctx, commsTemplateSetting) => {
  const settings = [];
  const { property } = commsTemplateSetting;

  const sections = Object.keys(TemplateSections);
  const actions = Object.keys(TemplateActions);

  const findByValue = (array, object, value) => array.find(key => object[key] === value);

  Object.keys(commsTemplateSetting).forEach(key => {
    if (key === 'property') {
      return;
    }

    const value = commsTemplateSetting[key];
    const keys = key.split('\n');
    settings.push({
      property,
      section: findByValue(sections, TemplateSections, keys[0]),
      action: findByValue(actions, TemplateActions, keys[1]),
      templateName: value,
    });
  });

  await mapSeries(settings, async setting => await saveCommsTemplateSetting(ctx, setting));
};

export const importCommsTemplateSettings = async (ctx, commsTemplateSettings) => {
  const commsTemplateProperties = commsTemplateSettings.map(({ data }) => data.property);
  const invalidFields = await validate(
    commsTemplateSettings,
    {
      requiredFields: COMMS_TEMPLATE_SETTING_REQUIRED_FIELDS,
      async onValidEntity(commsTemplateSetting) {
        await saveCommsTemplateSettingsData(ctx, commsTemplateSetting);
      },
      customCheck(commsTemplate) {
        return validateUniqueName(commsTemplate.property, commsTemplateProperties);
      },
    },
    ctx,
    spreadsheet.CommsTemplateSettings.columns,
  );

  const properties = await getProperties(ctx);
  const templateProperties = await getCommsTemplateSettingProperties(ctx);
  const propertySettingsSetupErrors = getInvalidPropertySettingsSetup(properties, templateProperties);

  return {
    invalidFields: [...invalidFields, propertySettingsSetupErrors],
  };
};
