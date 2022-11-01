/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { t } from 'i18next';
import fuzzysearch from 'fuzzysearch';
import SearchForm from 'custom-components/SearchForm/SearchForm';
import { Markdown, Icon, Typography as T, Avatar } from 'components';
import { getBusinessTitle } from 'helpers/users';
import ContactCard from './ContactCard';
import EmployeeCard from './EmployeeCard';
import { cf, g } from './EmployeeSelector.scss';
import { isRevaAdmin } from '../../../common/helpers/auth';

const CATEGORY_EMPLOYEES = 'employees';
const CATEGORY_TEAMS = 'teams';

export default class EmployeeSelector extends Component {
  static propTypes = {
    users: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
    team: PropTypes.array,
    onEmployeeSelected: PropTypes.func,
    placeholderText: PropTypes.string,
    currentUserId: PropTypes.string,
    noStatusBadge: PropTypes.bool,
  };

  matchQuery = (query, { originalItem: item }) => {
    if (item.items) {
      // we don't perform matching on the group items
      return false;
    }
    return fuzzysearch(query, item.fullName.toLowerCase());
  };

  renderItem = ({ item, query, highlightMatches }) => {
    const { currentUserId, noStatusBadge, smallAvatars } = this.props;
    const text = highlightMatches(item.text, query, { Component: T.SubHeader });

    if (item.originalItem.isOtherContact) {
      const { id, fullName, title } = item.originalItem;

      const avatar = <Avatar userName={fullName} badgeIcon="call-forward" />;

      return (
        <ContactCard
          fullName={fullName}
          title={title}
          selected={currentUserId === id}
          nameWithMatches={text}
          avatar={avatar}
          data-id={`${fullName.replace(/\s/g, '')}_contactCard`}
        />
      );
    }

    const { title, avatarUrl, id, isTeam, status, teamEndDate } = item.originalItem;
    return (
      <EmployeeCard
        employeeName={item.text}
        selected={currentUserId === id}
        nameWithMatches={text}
        title={title}
        avatarUrl={avatarUrl}
        showStatus={!isTeam && !noStatusBadge}
        status={status}
        smallAvatar={smallAvatars}
        disabled={!!teamEndDate}
      />
    );
  };

  renderGroupItem = ({ index }) => {
    if (index === 0) return null;
    return (
      <div className={cf('group-item')}>
        <div className={cf('line-divider')} />
      </div>
    );
  };

  formatUserItem = user => ({
    id: user.currentTeamId ? `${user.id}${user.currentTeamId}` : user.id,
    userId: user.id,
    teamId: user.currentTeamId,
    fullName: user.fullName,
    preferredName: user.preferredName,
    title: getBusinessTitle(user),
    status: user.metadata.status,
    avatarUrl: user.avatarUrl,
    associatedProperties: user.associatedProperties,
  });

  formatTeamItem = team => ({
    id: team.id,
    fullName: team.displayName,
    isTeam: true,
    associatedProperties: team.associatedProperties,
    teamEndDate: team.endDate,
  });

  formatDataForSearchForm = (shouldExcludeRevaAdmin, teams = [], users = []) => {
    const relevantUsers = shouldExcludeRevaAdmin ? users.filter(u => !isRevaAdmin(u)) : users;
    const formattedUsers = relevantUsers.map(user => this.formatUserItem(user));
    const formattedTeams = teams.map(team => this.formatTeamItem(team));

    const userItems = formattedUsers.length > 0 ? [{ id: CATEGORY_EMPLOYEES, items: formattedUsers }] : [];
    const teamItems = formattedTeams.length > 0 ? [{ id: CATEGORY_TEAMS, items: formattedTeams }] : [];

    return [...userItems, ...teamItems];
  };

  handleSelection = ({ item }) => {
    const { onEmployeeSelected } = this.props;
    onEmployeeSelected && onEmployeeSelected(item);
  };

  emptyResultsTemplate = searchTerm => (
    <div className={cf('no-results')}>
      <div className={cf('icon-container')}>
        <Icon name="magnify" className={cf('icon')} />
      </div>
      <Markdown className={cf(g('body textSecondary'), 'info')}>{`${t('NO_RESULTS_FOR')}**"${searchTerm}"**`}</Markdown>
    </div>
  );

  render() {
    const { teams, users, placeholderText, suggestedOtherItems = [], allOtherItems = [], formId, currentUser } = this.props;
    const shouldExcludeRevaAdmin = currentUser && !isRevaAdmin(currentUser);
    const groupedItems = this.formatDataForSearchForm(shouldExcludeRevaAdmin, teams, users);
    let suggestedItems = [];
    if ('suggestedUsers' in this.props || 'suggestedTeams' in this.props) {
      suggestedItems = this.formatDataForSearchForm(shouldExcludeRevaAdmin, this.props.suggestedTeams, this.props.suggestedUsers);
    }

    return (
      <SearchForm
        formId={formId}
        placeholder={placeholderText || t('FIND')}
        items={[...groupedItems, ...allOtherItems]}
        suggestedItems={[...suggestedItems, ...suggestedOtherItems]}
        groupItemClassName={cf('group-separator')}
        listClassName={cf('list-content')}
        matchQuery={this.matchQuery}
        renderItem={this.renderItem}
        renderGroupItem={this.renderGroupItem}
        emptyResultsTemplate={this.emptyResultsTemplate}
        onChange={this.handleSelection}
        textField="fullName"
        valueField="id"
      />
    );
  }
}
