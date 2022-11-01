/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import trim from '../helpers/trim';
// Original source: https://github.com/diafygi/webrtc-ips licensed as MIT
// Modified to make it async/await friendly
export const getIPs = () => {
  const ipDups = {};

  // compatibility for firefox and chrome
  const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

  // bypass naive webrtc blocking using an iframe
  if (!RTCPeerConnection) {
    return [];
  }

  // minimal requirements for data connection
  const mediaConstraints = {
    optional: [{ RtpDataChannels: true }],
  };

  const servers = { iceServers: [{ urls: 'stun:stun.services.mozilla.com' }] };

  // construct a new RTCPeerConnection
  const pc = new RTCPeerConnection(servers, mediaConstraints);

  const handleCandidate = candidate => {
    // match just the IP address
    const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/;
    const ipAddr = ipRegex.exec(candidate)?.[1];

    // remove duplicates
    if (ipAddr && !ipDups[ipAddr]) {
      ipDups[ipAddr] = true;
      return ipAddr;
    }
    return undefined;
  };

  return new Promise(async resolve => {
    if (!pc) resolve([]);

    // create a bogus data channel
    pc.createDataChannel && pc.createDataChannel('');

    const parseSDPText = lines => {
      // read candidate info from local description
      lines = trim(lines).split('\n');

      const ips = lines?.reduce((acc, line) => {
        if (line.indexOf('a=candidate:') === 0 || (line.match(/IP4/) && !line.match(/127\.0\.0\.1/) && !line.match(/0\.0\.0\.0/))) {
          const ip = handleCandidate(line);
          if (ip) {
            acc.push(ip);
          }
        }
        return acc;
      }, []);

      resolve(ips);
    };

    const THRESHOLD_TO_WAIT = 1000;
    const waitAndParseForResponse = () => setTimeout(() => parseSDPText(pc.localDescription?.sdp), THRESHOLD_TO_WAIT);

    try {
      const result = await pc.createOffer();
      await pc.setLocalDescription(result);

      waitAndParseForResponse();
    } catch (err) {
      console.log('>>> err', err);
      resolve([]);
    }
  });
};
