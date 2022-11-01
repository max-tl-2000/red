/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import InventoryCard from './InventoryCard';
import PersonCard from './PersonCard';
import PartyCard from './PartyCard';
import { DALTypes } from '../../../common/enums/DALTypes';
import { cf } from './SearchResultCard.scss';
export default class SearchResultCard extends Component {
  static propTypes = {
    item: PropTypes.object.isRequired,
    index: PropTypes.number,
    query: PropTypes.object,
  };

  createCardByType = item => {
    switch (item.type) {
      case DALTypes.ItemType.unit:
        return <InventoryCard inventory={item} query={this.props.query} />;
      case DALTypes.ItemType.person:
        return <PersonCard person={item} query={this.props.query} />;
      case DALTypes.ItemType.party:
        return <PartyCard party={item} query={this.props.query} />;
      default:
        return <div />;
    }
  };

  render() {
    const { item, onClick } = this.props;
    const resultCard = this.createCardByType(item);
    return (
      <div data-component="search-result-card" className={cf('searchCard')} onClick={onClick}>
        {resultCard}
      </div>
    );
  }
}
