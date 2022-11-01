/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import mediator from '../helpers/mediator';
import { setCookie } from '../helpers/cookieHelper';
import cfg from '../helpers/cfg';

const zendeskConfig = cfg('zendeskConfig', {});
const cookieName = zendeskConfig.cookieName || 'zendesk_reva_user';
const cookieDomain = zendeskConfig.cookieDomain || 'reva.tech';
const cookieExpirationDays = zendeskConfig.cookieExpirationDays || 5;
const domain = zendeskConfig.domain || 'reva.zendesk.com';
const refreshPrivateContentTokenPeriod = zendeskConfig.refreshPrivateContentTokenPeriod || 600000;

const setZendeskWidget = ({ zendeskPrivateContentToken }) => {
  // eslint-disable-next-line
  let snippet = `window.zEmbed||function(e,t){var n,o,d,i,s,a=[],r=document.createElement("iframe");window.zEmbed=function(){a.push(arguments)},window.zE=window.zE||window.zEmbed,r.src="javascript:false",r.title="",r.role="presentation",(r.frameElement||r).style.cssText="display: none",d=document.getElementsByTagName("script"),d=d[d.length-1],d.parentNode.insertBefore(r,d),i=r.contentWindow,s=i.document;try{o=s}catch(e){n=document.domain,r.src='javascript:var d=document.open();d.domain="'+n+'";void(0);',o=s}o.open()._l=function(){var o=this.createElement("script");n&&(this.domain=n),o.id="js-iframe-async",o.src=e,this.t=+new Date,this.zendeskHost=t,this.zEQueue=a,this.body.appendChild(o)},o.write('<body onload="document._l();">'),o.close()}("https://assets.zendesk.com/embeddable_framework/main.js","${domain}");setTimeout(function(){zE(function(){zE.show()});}, 1000);`;
  if (zendeskPrivateContentToken) {
    snippet = `window.zESettings={webWidget:{offset:{vertical:'18px'}},authenticate:{jwt:'${zendeskPrivateContentToken}'}};${snippet}`;
  }
  const zendeskSnippet = document.createElement('script');
  zendeskSnippet.innerHTML = snippet;
  document.head.appendChild(zendeskSnippet);
};

const removeZendeskWidget = () => {
  try {
    const { zE } = window;
    // eslint-disable-next-line
    if (zE) {
      // eslint-disable-next-line
      zE(() => {
        // eslint-disable-next-line
       zE.logout();
        // eslint-disable-next-line
       zE.hide();
      });
    }

    window.zEmbed = null;
    window.zESettings = null;
    window.zE = null;
  } catch (e) {
    console.log('error on remove zendesk widget', e);
  }
};

const refreshZendeskToken = async store => {
  const user = store.getState().auth.user;
  if (!user) return;
  try {
    const token = await store.client.get('/zendesk/generatePrivateContentToken');
    setZendeskWidget({ zendeskPrivateContentToken: token });
  } catch (e) {
    e.__handled = true;
    console.log('error on refreshZendeskToken', e);
  }
  setTimeout(() => refreshZendeskToken(store), refreshPrivateContentTokenPeriod);
};

export const init = store => {
  mediator.on('user:login', (e, args) => {
    const state = store.getState();
    const user = state?.auth?.user;
    if (user?.isTrainingTenant || user?.metadata?.isAdmin) return;

    setCookie(cookieName, args.user.zendeskCookieValue, {
      expires: cookieExpirationDays,
      path: '/',
      domain: cookieDomain,
    });
    refreshZendeskToken(store);
  });

  mediator.on('user:logout', () => {
    setCookie(cookieName, '', {
      expires: -1,
      path: '/',
      domain: cookieDomain,
    });
    removeZendeskWidget();
  });
};
