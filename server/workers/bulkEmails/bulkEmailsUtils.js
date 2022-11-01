/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export const replaceSendGridPopulatedValues = template => {
  // TODO: automate this. All non expanded variables should be converted to `[[token]]` format automatically
  const valuesToReplace = [
    {
      valueToReplace: '{{recipient.name}}',
      newValue: '[[recipientName]]',
    },
    {
      valueToReplace: '{{rxp.postUrl}}',
      newValue: '[[residentNotificationPostUrl]]',
    },
    {
      valueToReplace: '{{recipient.unsubscribeUrl}}',
      newValue: '[[recipientUnsubscribeUrl]]',
    },
  ];

  const expression = new RegExp(valuesToReplace.map(value => value.valueToReplace).join('|'), 'gi');
  const replacedEmailTemplate = template.emailTemplate.replace(expression, matched => valuesToReplace.find(value => value.valueToReplace === matched).newValue);

  return {
    ...template,
    emailTemplate: replacedEmailTemplate,
  };
};
