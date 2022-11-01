/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { findDOMNode } from 'react-dom';
import { Link } from 'react-router';
import generateId from 'helpers/generateId';
import { sizes, screenIsAtMost } from 'helpers/layout';

import { IconButton, GeminiScrollbar } from 'components';

import $ from 'jquery';
import contains from 'helpers/contains';
import { observer, inject } from 'mobx-react';
import { cf } from './RootDemo.scss';
import DemoPage from '../DemoElements/DemoPage';
import { document } from '../../../common/helpers/globals';

const $doc = $(document);

@inject('screen')
@observer
export default class RootDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.routes = props.routes[0].childRoutes;
    this.route = props.route;
    this.id = generateId(this);
    this.state = {
      navOpen: false,
    };
  }

  get isOpen() {
    return !!this.state.navOpen;
  }

  toggleNavVisibility = () => {
    if (this.isOpen) {
      this.closeNav();
      return;
    }

    this.openNav();
  };

  closeNav = () => {
    if (!this.state.navOpen) return;

    this.setState({
      navOpen: false,
    });

    this._removeChecksFromClickOutside();
  };

  openNav = () => {
    if (this.state.navOpen) return;

    this.setState({
      navOpen: true,
    });

    this._checkForClicksOutside();
  };

  _checkForClicksOutside() {
    $doc.on(`mouseup.ns_${this.id}`, e => {
      if (!this.isOpen) {
        return;
      }

      const eventHappenedInsideOverlay = contains(this.refs.nav, e.target);
      const triggerNode = findDOMNode(this.refs.trigger);
      const eventHappenedInsideTrigger = contains(triggerNode, e.target);

      if (eventHappenedInsideOverlay || eventHappenedInsideTrigger) {
        return;
      }

      this.closeNav();
    });
  }

  _removeChecksFromClickOutside() {
    $doc.off(`.ns_${this.id}`);
  }

  componentWillUnmount() {
    this._removeChecksFromClickOutside();
  }

  render() {
    let { children, screen } = this.props; // eslint-disable-line
    const { navOpen } = this.state;

    if (!children) {
      children = (
        <DemoPage title="Welcome!">
          <p className="p" style={{ marginTop: 20 }}>
            Welcome to the Red Components Demo... please click on the items on the left to start exploring them.
          </p>
        </DemoPage>
      );
    }

    return (
      <div className={cf('container')}>
        <header>
          {screenIsAtMost(screen.size, sizes.small1) && (
            <IconButton ref="trigger" className={cf('hamburger')} iconName="menu" iconStyle="light" onClick={this.toggleNavVisibility} />
          )}
          <h1>
            <Link to={this.route.path}> Red Components Demo </Link>
          </h1>
        </header>
        <div className={cf('container-wrapper')}>
          <div ref="nav" className={cf('nav')} data-open={navOpen}>
            <GeminiScrollbar>
              {this.routes.map(r => (
                <Link onClick={this.closeNav} activeClassName="selected" key={r.path} to={`${this.route.path}${r.path}`}>
                  <span>{r.title}</span>
                </Link>
              ))}
            </GeminiScrollbar>
          </div>
          <div className={cf('page-container')}>{children}</div>
        </div>
      </div>
    );
  }
}
