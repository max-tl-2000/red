/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import Card from '../Card/Card';
import CardHeader from '../Card/CardHeader';
import ContentCard from './ContentCard';

import { cf, g } from './ExpandableCard.scss';

export default class ExpandableCard extends Component {
  static defaultProps = {
    expanded: false,
  };

  static propTypes = {
    title: PropTypes.string,
    expanded: PropTypes.bool,
    styles: PropTypes.string,
    cucumberExpandableCardId: PropTypes.string,
  };

  state = {
    isCardExpanded: this.props.expanded,
  };

  handleOnClick = () => {
    const newCardState = !this.state.isCardExpanded;
    this.setState({
      isCardExpanded: newCardState,
    });
  };

  componentWillReceiveProps(nextProps) {
    if (this.state.isCardExpanded !== nextProps.expanded) {
      this.setState({
        isCardExpanded: nextProps.expanded,
      });
    }
  }

  get domNode() {
    return findDOMNode(this);
  }

  onHidden = () => {
    this.domNode.setAttribute('data-state', 'closed');
  };

  componentDidUpdate() {
    if (this.state.isCardExpanded) {
      this.domNode.setAttribute('data-state', 'opened');
    }
  }

  componentDidMount() {
    const dom = this.domNode;
    const { isCardExpanded } = this.state;

    dom.setAttribute('data-state', isCardExpanded ? 'opened' : 'closed');
  }

  render() {
    const {
      title,
      className,
      subTitle,
      children,
      // extracting the expanded prop here
      // to avoid it been set to a div
      // as required by https://fb.me/react-unknown-prop
      expanded, // eslint-disable-line
      cucumberExpandableCardId,
      ...rest
    } = this.props;
    const { isCardExpanded } = this.state;
    return (
      <Card data-component="expandable-card" data-expandable-card-id={cucumberExpandableCardId} className={cf('card', g(className))} {...rest}>
        <CardHeader className={cf('header')} title={title} subTitle={subTitle} onClick={this.handleOnClick} />
        <ContentCard expanded={isCardExpanded} onHidden={this.onHidden}>
          {children}
        </ContentCard>
      </Card>
    );
  }
}
