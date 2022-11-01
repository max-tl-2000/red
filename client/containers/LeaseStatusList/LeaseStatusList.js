/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { createSelector } from 'reselect';
import { connect } from 'react-redux';
import { t } from 'i18next';

import { Section } from 'components';
import EmptyMessage from 'custom-components/EmptyMessage/EmptyMessage';
import { DALTypes } from '../../../common/enums/DALTypes';
import LeaseStatusSection from './LeaseStatusSection';
import { toMoment } from '../../../common/helpers/moment-utils';

const isLeaseVoidedOnRenewalParty = (isRenewal, lease) => isRenewal && lease.status === DALTypes.LeaseStatus.VOIDED;

const sortByDate = (a, b) => toMoment(b.created_at).diff(toMoment(a.created_at));

const getLeases = createSelector(
  props => props.leases,
  props => props.quotes,
  props => props.isCorporateParty,
  (leases, quotes, isCorporateParty) => {
    if (!leases.length || !quotes.length) return [];

    // sort function mutates the array. We should always use it with care!
    // it can make very funny things on data passed down
    leases = [...leases].sort(sortByDate);

    if (!isCorporateParty) return leases.slice(0, 1);

    const leasesByUnit = leases.reduce((acc, lease) => {
      const quote = quotes.find(q => q.id === lease.quoteId);
      if (!quote || !quote.inventory) return acc;
      const previousValues = acc[quote.inventory.id];
      acc[quote.inventory.id] = [...(previousValues || []), lease];
      return acc;
    }, {});

    const result = Object.keys(leasesByUnit).reduce((acc, inventoryId) => {
      const unitLeases = leasesByUnit[inventoryId].sort(sortByDate);
      acc.push(unitLeases[0]);

      const restOfTheList = unitLeases.slice(1);
      const activeLeases = restOfTheList.filter(lease => lease.status === DALTypes.LeaseStatus.EXECUTED);

      if (activeLeases.length > 0) {
        acc.push(...activeLeases);
      }

      return acc;
    }, []);

    return result.sort(sortByDate);
  },
);

const render = props => {
  const { leases, quotes, screeningSummary, isRenewal, handleOpenManageParty } = props;

  if (!leases || !leases.length) {
    return (
      <Section title={t('LEASE_SECTION')}>
        <EmptyMessage message={t('LEASE_SECTION_EMPTY_STATE')} dataId="noLeaseMessage" />
      </Section>
    );
  }

  if (isLeaseVoidedOnRenewalParty(isRenewal, leases[0])) return <noscript />;

  return (
    <div>
      {leases.map(lease => {
        const quote = quotes.find(q => q.id === lease.quoteId);
        return (
          <div key={lease.id}>
            <LeaseStatusSection
              lease={lease}
              persons={props.persons}
              users={props.users}
              party={props.party}
              quotes={props.quotes}
              quote={quote}
              quotePromotions={props.quotePromotions}
              onReviewLease={props.onReviewLease}
              screeningSummary={screeningSummary}
              isRenewal={isRenewal}
              handleOpenManageParty={handleOpenManageParty}
            />
          </div>
        );
      })}
    </div>
  );
};

const LeaseStatusList = connect((state, props) => ({
  leases: getLeases(props),
}))(render);

LeaseStatusList.propTypes = {
  lease: PropTypes.object,
  persons: PropTypes.object,
  users: PropTypes.object,
  isCorporateParty: PropTypes.bool,
  party: PropTypes.object,
  onReviewLease: PropTypes.func,
  voidLease: PropTypes.func,
  fetchLeaseStatus: PropTypes.func,
};

export default LeaseStatusList;
