/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { t } from 'i18next';
import { addBreakHintsOnWords } from 'helpers/strings';
import SubHeader from '../../components/Typography/SubHeader';
import { cf } from './PartyGuests.scss';
import PersonViewModel from '../../view-models/person';
import { getDisplayName } from '../../../common/helpers/person-helper';

const getExpandedPartyGuests = (guests = [], TagElement, TagElementProps, lighter) => {
  const last = guests.length - 1;
  return guests.map((guest, index) => {
    const secondary = !guest.isResident;
    const { person } = guest;

    const fullName = getDisplayName(person);
    return (
      <TagElement id="guestTitleTag" data-id={fullName} secondary={secondary} lighter={lighter} inline key={guest.id} {...TagElementProps}>
        {addBreakHintsOnWords(fullName)}
        {do {
          if (index !== last) {
            <span className={cf('spanStyle')}>{', '}</span>;
          }
        }}
      </TagElement>
    );
  });
};

const getCompactedPartyGuests = (guests = [], TagElement, TagElementProps, lighter) => (
  <TagElement lighter={lighter} inline ellipsis {...TagElementProps}>
    {t('PARTY_MEMBER', { count: guests.length })}
  </TagElement>
);

const getCorporatePartyGuests = ({ guests = [], TagElement, TagElementProps, lighter }) => {
  const primaryTenant = guests.find(guest => guest.isResident);
  if (!primaryTenant) return <noscript />;

  const personViewModel = PersonViewModel.create(primaryTenant.person);
  const pointOfContact = personViewModel.getDisplayName(true);
  const companyName = primaryTenant?.corporateCompanyName && `${primaryTenant.corporateCompanyName}, `;

  const companyNameKey = `company-${primaryTenant.person.id}`;
  const renderElements = [
    <TagElement lighter={lighter} inline key={companyNameKey} {...TagElementProps}>
      {companyName || pointOfContact}
    </TagElement>,
  ];

  if (!companyName) return renderElements;
  const pointOfContactKey = `contact-${primaryTenant.person.id}`;
  companyName &&
    pointOfContact &&
    renderElements.push(
      <TagElement lighter={lighter} secondary inline key={pointOfContactKey} className={cf('point-of-contact')} {...TagElementProps}>
        {pointOfContact}
      </TagElement>,
    );

  return renderElements;
};

const getTraditionalPartyGuests = ({ guests = [], TagElement, TagElementProps, lighter, compact }) =>
  compact ? getCompactedPartyGuests(guests, TagElement, TagElementProps, lighter) : getExpandedPartyGuests(guests, TagElement, TagElementProps, lighter);

export default function PartyGuests({ className, compact, inline, lighter, guests = [], TagElement, style, isCorporateParty, TagElementProps, ...rest }) {
  if (!TagElement) {
    TagElement = SubHeader;
  }

  const data = { guests, TagElement, lighter, compact, TagElementProps };
  const elements = isCorporateParty ? getCorporatePartyGuests(data) : getTraditionalPartyGuests(data);

  return inline ? (
    <span data-component="party-guests" style={style} className={className} {...rest}>
      {elements}
    </span>
  ) : (
    <div data-component="party-guests" style={style} className={className} {...rest}>
      {elements}
    </div>
  );
}
