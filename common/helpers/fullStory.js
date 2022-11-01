/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

export default class FullStory {
  constructor({ config, window, document }) {
    this.window = window;
    this.document = document;
    this.config = config;
    this.fullStoryNameSpace = config.namespace;
    this.fullStoryEdgeScript = `edge.${this.config.host}/s/fs.js`;
    this.fullStoryUrl = `https://${this.fullStoryEdgeScript}/s/fs.js`;
  }

  // This is a snippet provided by FullStory.com
  getSnippet = () => `
    window['_fs_debug'] = ${this.config.debugMode};
    window['_fs_host'] = '${this.config.host}';
    window['_fs_script'] = '${this.fullStoryEdgeScript}';
    window['_fs_org'] = '${this.config.org}';
    window['_fs_namespace'] = '${this.fullStoryNameSpace}';

    (function(m,n,e,t,l,o,g,y){
      if (e in m) {if(m.console && m.console.log) { m.console.log('FullStory namespace conflict. Please set window["_fs_namespace"].');} return;}
      g=m[e]=function(a,b,s){g.q?g.q.push([a,b,s]):g._api(a,b,s);};g.q=[];
      o=n.createElement(t);o.async=1;o.crossOrigin='anonymous';o.src='https://'+_fs_script;
      y=n.getElementsByTagName(t)[0];y.parentNode.insertBefore(o,y);
      g.identify=function(i,v,s){g(l,{uid:i},s);if(v)g(l,v,s)};g.setUserVars=function(v,s){g(l,v,s)};g.event=function(i,v,s){g('event',{n:i,p:v},s)};
      g.anonymize=function(){g.identify(!!0)};
      g.shutdown=function(){g("rec",!1)};g.restart=function(){g("rec",!0)};
      g.log = function(a,b){g("log",[a,b])};
      g.consent=function(a){g("consent",!arguments.length||a)};
      g.identifyAccount=function(i,v){o='account';v=v||{};v.acctId=i;g(o,v)};
      g.clearUserCookie=function(){};
      g.setVars=function(n, p){g('setVars',[n,p]);};
      g._w={};y='XMLHttpRequest';g._w[y]=m[y];y='fetch';g._w[y]=m[y];
      if(m[y])m[y]=function(){return g._w[y].apply(this,arguments)};
      g._v="1.3.0";
    })(window,document,window['_fs_namespace'],'script','user');
  `;

  isWidgetLoaded = () => {
    const scripts = Array.from(this.document.getElementsByTagName('script'));
    return scripts.some(({ src }) => src === this.fullStoryUrl);
  };

  identifyNewUser = (id, content) => this.window[this.fullStoryNameSpace].identify(id, content);

  updateCurrentUser = content => this.window[this.fullStoryNameSpace].setUserVars(content);

  addWidget = () => {
    const fullStorySnippet = this.document.createElement('script');
    fullStorySnippet.innerHTML = this.getSnippet();
    this.document.head.appendChild(fullStorySnippet);
  };

  addOrUpdateWidget = ({ id, content }) => {
    if (!this.config.org) return;

    if (this.isWidgetLoaded()) {
      this.updateCurrentUser(content);
      return;
    }

    this.addWidget();
    this.identifyNewUser(id, content);
  };

  removeWidget = () => {
    try {
      if (!this.window[this.fullStoryNameSpace]) return;
      this.window[this.fullStoryNameSpace].clearUserCookie();
    } catch (e) {
      console.error('error on remove fullstory widget', e);
    }
  };
}
