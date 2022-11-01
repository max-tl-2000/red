/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/*!
 * Materialize v0.97.5 (http://materializecss.com)
 * Copyright 2014-2015 Materialize
 * MIT License (https://raw.githubusercontent.com/Dogfalo/materialize/master/LICENSE)
 */
// Check for jQuery.
if (typeof (jQuery) === 'undefined') {
  var jQuery;
  // Check if require is a defined function.
  if (typeof (require) === 'function') {
    jQuery = $ = require('jQuery');
  // Else use the dollar sign alias.
  } else {
    jQuery = $;
  }
}/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 *
 * Open source under the BSD License.
 *
 * Copyright © 2008 George McGinley Smith
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
*/

// t: current time, b: begInnIng value, c: change In value, d: duration
jQuery.easing['jswing'] = jQuery.easing['swing'];

jQuery.extend(jQuery.easing,
{
  def: 'easeOutQuad',
  swing(x, t, b, c, d) {
    // alert(jQuery.easing.default);
    return jQuery.easing[jQuery.easing.def](x, t, b, c, d);
  },
  easeInQuad(x, t, b, c, d) {
    return c * (t /= d) * t + b;
  },
  easeOutQuad(x, t, b, c, d) {
    return -c * (t /= d) * (t - 2) + b;
  },
  easeInOutQuad(x, t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t + b;
    return -c / 2 * ((--t) * (t - 2) - 1) + b;
  },
  easeInCubic(x, t, b, c, d) {
    return c * (t /= d) * t * t + b;
  },
  easeOutCubic(x, t, b, c, d) {
    return c * ((t = t / d - 1) * t * t + 1) + b;
  },
  easeInOutCubic(x, t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
    return c / 2 * ((t -= 2) * t * t + 2) + b;
  },
  easeInQuart(x, t, b, c, d) {
    return c * (t /= d) * t * t * t + b;
  },
  easeOutQuart(x, t, b, c, d) {
    return -c * ((t = t / d - 1) * t * t * t - 1) + b;
  },
  easeInOutQuart(x, t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t * t + b;
    return -c / 2 * ((t -= 2) * t * t * t - 2) + b;
  },
  easeInQuint(x, t, b, c, d) {
    return c * (t /= d) * t * t * t * t + b;
  },
  easeOutQuint(x, t, b, c, d) {
    return c * ((t = t / d - 1) * t * t * t * t + 1) + b;
  },
  easeInOutQuint(x, t, b, c, d) {
    if ((t /= d / 2) < 1) return c / 2 * t * t * t * t * t + b;
    return c / 2 * ((t -= 2) * t * t * t * t + 2) + b;
  },
  easeInSine(x, t, b, c, d) {
    return -c * Math.cos(t / d * (Math.PI / 2)) + c + b;
  },
  easeOutSine(x, t, b, c, d) {
    return c * Math.sin(t / d * (Math.PI / 2)) + b;
  },
  easeInOutSine(x, t, b, c, d) {
    return -c / 2 * (Math.cos(Math.PI * t / d) - 1) + b;
  },
  easeInExpo(x, t, b, c, d) {
    return (t == 0) ? b : c * Math.pow(2, 10 * (t / d - 1)) + b;
  },
  easeOutExpo(x, t, b, c, d) {
    return (t == d) ? b + c : c * (-Math.pow(2, -10 * t / d) + 1) + b;
  },
  easeInOutExpo(x, t, b, c, d) {
    if (t == 0) return b;
    if (t == d) return b + c;
    if ((t /= d / 2) < 1) return c / 2 * Math.pow(2, 10 * (t - 1)) + b;
    return c / 2 * (-Math.pow(2, -10 * --t) + 2) + b;
  },
  easeInCirc(x, t, b, c, d) {
    return -c * (Math.sqrt(1 - (t /= d) * t) - 1) + b;
  },
  easeOutCirc(x, t, b, c, d) {
    return c * Math.sqrt(1 - (t = t / d - 1) * t) + b;
  },
  easeInOutCirc(x, t, b, c, d) {
    if ((t /= d / 2) < 1) return -c / 2 * (Math.sqrt(1 - t * t) - 1) + b;
    return c / 2 * (Math.sqrt(1 - (t -= 2) * t) + 1) + b;
  },
  easeInElastic(x, t, b, c, d) {
    var s = 1.70158; var p = 0; var a = c;
    if (t == 0) return b;  if ((t /= d) == 1) return b + c;  if (!p) p = d * .3;
    if (a < Math.abs(c)) { a = c; var s = p / 4; }
    else var s = p / (2 * Math.PI) * Math.asin (c / a);
    return -(a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
  },
  easeOutElastic(x, t, b, c, d) {
    var s = 1.70158; var p = 0; var a = c;
    if (t == 0) return b;  if ((t /= d) == 1) return b + c;  if (!p) p = d * .3;
    if (a < Math.abs(c)) { a = c; var s = p / 4; }
    else var s = p / (2 * Math.PI) * Math.asin (c / a);
    return a * Math.pow(2, -10 * t) * Math.sin((t * d - s) * (2 * Math.PI) / p) + c + b;
  },
  easeInOutElastic(x, t, b, c, d) {
    var s = 1.70158; var p = 0; var a = c;
    if (t == 0) return b;  if ((t /= d / 2) == 2) return b + c;  if (!p) p = d * (.3 * 1.5);
    if (a < Math.abs(c)) { a = c; var s = p / 4; }
    else var s = p / (2 * Math.PI) * Math.asin (c / a);
    if (t < 1) return -.5 * (a * Math.pow(2, 10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p)) + b;
    return a * Math.pow(2, -10 * (t -= 1)) * Math.sin((t * d - s) * (2 * Math.PI) / p) * .5 + c + b;
  },
  easeInBack(x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c * (t /= d) * t * ((s + 1) * t - s) + b;
  },
  easeOutBack(x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },
  easeInOutBack(x, t, b, c, d, s) {
    if (s == undefined) s = 1.70158;
    if ((t /= d / 2) < 1) return c / 2 * (t * t * (((s *= (1.525)) + 1) * t - s)) + b;
    return c / 2 * ((t -= 2) * t * (((s *= (1.525)) + 1) * t + s) + 2) + b;
  },
  easeInBounce(x, t, b, c, d) {
    return c - jQuery.easing.easeOutBounce (x, d - t, 0, c, d) + b;
  },
  easeOutBounce(x, t, b, c, d) {
    if ((t /= d) < (1 / 2.75)) {
      return c * (7.5625 * t * t) + b;
    } else if (t < (2 / 2.75)) {
      return c * (7.5625 * (t -= (1.5 / 2.75)) * t + .75) + b;
    } else if (t < (2.5 / 2.75)) {
      return c * (7.5625 * (t -= (2.25 / 2.75)) * t + .9375) + b;
    } else {
      return c * (7.5625 * (t -= (2.625 / 2.75)) * t + .984375) + b;
    }
  },
  easeInOutBounce(x, t, b, c, d) {
    if (t < d / 2) return jQuery.easing.easeInBounce (x, t * 2, 0, c, d) * .5 + b;
    return jQuery.easing.easeOutBounce (x, t * 2 - d, 0, c, d) * .5 + c * .5 + b;
  },
});

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 *
 * Open source under the BSD License.
 *
 * Copyright © 2001 Robert Penner
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 *  EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 *  GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 *  NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */    // Custom Easing
    jQuery.extend(jQuery.easing,
    {
      easeInOutMaterial(x, t, b, c, d) {
        if ((t /= d / 2) < 1) return c / 2 * t * t + b;
        return c / 4 * ((t -= 2) * t * t + 2) + b;
      },
    });

!function (a, b, c, d) { 'use strict'; function k(a, b, c) { return setTimeout(q(a, c), b); } function l(a, b, c) { return Array.isArray(a) ? (m(a, c[b], c), !0) : !1; } function m(a, b, c) { var e; if (a) if (a.forEach)a.forEach(b, c); else if (a.length !== d) for (e = 0; e < a.length;)b.call(c, a[e], e, a), e++; else for (e in a)a.hasOwnProperty(e) && b.call(c, a[e], e, a); } function n(a, b, c) { for (var e = Object.keys(b), f = 0; f < e.length;)(!c || c && a[e[f]] === d) && (a[e[f]] = b[e[f]]), f++; return a; } function o(a, b) { return n(a, b, !0); } function p(a, b, c) { var e, d = b.prototype; e = a.prototype = Object.create(d), e.constructor = a, e._super = d, c && n(e, c); } function q(a, b) { return function () { return a.apply(b, arguments); }; } function r(a, b) { return typeof a == g ? a.apply(b ? b[0] || d : d, b) : a; } function s(a, b) { return a === d ? b : a; } function t(a, b, c) { m(x(b), function (b) { a.addEventListener(b, c, !1); }); } function u(a, b, c) { m(x(b), function (b) { a.removeEventListener(b, c, !1); }); } function v(a, b) { for (;a;) { if (a == b) return !0; a = a.parentNode; } return !1; } function w(a, b) { return a.indexOf(b) > -1; } function x(a) { return a.trim().split(/\s+/g); } function y(a, b, c) { if (a.indexOf && !c) return a.indexOf(b); for (var d = 0; d < a.length;) { if (c && a[d][c] == b || !c && a[d] === b) return d; d++; } return -1; } function z(a) { return Array.prototype.slice.call(a, 0); } function A(a, b, c) { for (var d = [], e = [], f = 0; f < a.length;) { var g = b ? a[f][b] : a[f]; y(e, g) < 0 && d.push(a[f]), e[f] = g, f++; } return c && (d = b ? d.sort(function (a, c) { return a[b] > c[b]; }) : d.sort()), d; } function B(a, b) { for (var c, f, g = b[0].toUpperCase() + b.slice(1), h = 0; h < e.length;) { if (c = e[h], f = c ? c + g : b, f in a) return f; h++; } return d; } function D() { return C++; } function E(a) { var b = a.ownerDocument; return b.defaultView || b.parentWindow; } function ab(a, b) { var c = this; this.manager = a, this.callback = b, this.element = a.element, this.target = a.options.inputTarget, this.domHandler = function (b) { r(a.options.enable, [a]) && c.handler(b); }, this.init(); } function bb(a) { var b, c = a.options.inputClass; return b = c ? c : H ? wb : I ? Eb : G ? Gb : rb, new b(a, cb); } function cb(a, b, c) { var d = c.pointers.length, e = c.changedPointers.length, f = b & O && 0 === d - e, g = b & (Q | R) && 0 === d - e; c.isFirst = !!f, c.isFinal = !!g, f && (a.session = {}), c.eventType = b, db(a, c), a.emit('hammer.input', c), a.recognize(c), a.session.prevInput = c; } function db(a, b) { var c = a.session, d = b.pointers, e = d.length; c.firstInput || (c.firstInput = gb(b)), e > 1 && !c.firstMultiple ? c.firstMultiple = gb(b) : 1 === e && (c.firstMultiple = !1); var f = c.firstInput, g = c.firstMultiple, h = g ? g.center : f.center, i = b.center = hb(d); b.timeStamp = j(), b.deltaTime = b.timeStamp - f.timeStamp, b.angle = lb(h, i), b.distance = kb(h, i), eb(c, b), b.offsetDirection = jb(b.deltaX, b.deltaY), b.scale = g ? nb(g.pointers, d) : 1, b.rotation = g ? mb(g.pointers, d) : 0, fb(c, b); var k = a.element; v(b.srcEvent.target, k) && (k = b.srcEvent.target), b.target = k; } function eb(a, b) { var c = b.center, d = a.offsetDelta || {}, e = a.prevDelta || {}, f = a.prevInput || {}; (b.eventType === O || f.eventType === Q) && (e = a.prevDelta = { x: f.deltaX || 0, y: f.deltaY || 0 }, d = a.offsetDelta = { x: c.x, y: c.y }), b.deltaX = e.x + (c.x - d.x), b.deltaY = e.y + (c.y - d.y); } function fb(a, b) { var f, g, h, j, c = a.lastInterval || b, e = b.timeStamp - c.timeStamp; if (b.eventType != R && (e > N || c.velocity === d)) { var k = c.deltaX - b.deltaX, l = c.deltaY - b.deltaY, m = ib(e, k, l); g = m.x, h = m.y, f = i(m.x) > i(m.y) ? m.x : m.y, j = jb(k, l), a.lastInterval = b; } else f = c.velocity, g = c.velocityX, h = c.velocityY, j = c.direction; b.velocity = f, b.velocityX = g, b.velocityY = h, b.direction = j; } function gb(a) { for (var b = [], c = 0; c < a.pointers.length;)b[c] = { clientX: h(a.pointers[c].clientX), clientY: h(a.pointers[c].clientY) }, c++; return { timeStamp: j(), pointers: b, center: hb(b), deltaX: a.deltaX, deltaY: a.deltaY }; } function hb(a) { var b = a.length; if (1 === b) return { x: h(a[0].clientX), y: h(a[0].clientY) }; for (var c = 0, d = 0, e = 0; b > e;)c += a[e].clientX, d += a[e].clientY, e++; return { x: h(c / b), y: h(d / b) }; } function ib(a, b, c) { return { x: b / a || 0, y: c / a || 0 }; } function jb(a, b) { return a === b ? S : i(a) >= i(b) ? a > 0 ? T : U : b > 0 ? V : W; } function kb(a, b, c) { c || (c = $); var d = b[c[0]] - a[c[0]], e = b[c[1]] - a[c[1]]; return Math.sqrt(d * d + e * e); } function lb(a, b, c) { c || (c = $); var d = b[c[0]] - a[c[0]], e = b[c[1]] - a[c[1]]; return 180 * Math.atan2(e, d) / Math.PI; } function mb(a, b) { return lb(b[1], b[0], _) - lb(a[1], a[0], _); } function nb(a, b) { return kb(b[0], b[1], _) / kb(a[0], a[1], _); } function rb() { this.evEl = pb, this.evWin = qb, this.allow = !0, this.pressed = !1, ab.apply(this, arguments); } function wb() { this.evEl = ub, this.evWin = vb, ab.apply(this, arguments), this.store = this.manager.session.pointerEvents = []; } function Ab() { this.evTarget = yb, this.evWin = zb, this.started = !1, ab.apply(this, arguments); } function Bb(a, b) { var c = z(a.touches), d = z(a.changedTouches); return b & (Q | R) && (c = A(c.concat(d), 'identifier', !0)), [c, d]; } function Eb() { this.evTarget = Db, this.targetIds = {}, ab.apply(this, arguments); } function Fb(a, b) { var c = z(a.touches), d = this.targetIds; if (b & (O | P) && 1 === c.length) return d[c[0].identifier] = !0, [c, c]; var e, f, g = z(a.changedTouches), h = [], i = this.target; if (f = c.filter(function (a) { return v(a.target, i); }), b === O) for (e = 0; e < f.length;)d[f[e].identifier] = !0, e++; for (e = 0; e < g.length;)d[g[e].identifier] && h.push(g[e]), b & (Q | R) && delete d[g[e].identifier], e++; return h.length ? [A(f.concat(h), 'identifier', !0), h] : void 0; } function Gb() { ab.apply(this, arguments); var a = q(this.handler, this); this.touch = new Eb(this.manager, a), this.mouse = new rb(this.manager, a); } function Pb(a, b) { this.manager = a, this.set(b); } function Qb(a) { if (w(a, Mb)) return Mb; var b = w(a, Nb), c = w(a, Ob); return b && c ? Nb + ' ' + Ob : b || c ? b ? Nb : Ob : w(a, Lb) ? Lb : Kb; } function Yb(a) { this.id = D(), this.manager = null, this.options = o(a || {}, this.defaults), this.options.enable = s(this.options.enable, !0), this.state = Rb, this.simultaneous = {}, this.requireFail = []; } function Zb(a) { return a & Wb ? 'cancel' : a & Ub ? 'end' : a & Tb ? 'move' : a & Sb ? 'start' : ''; } function $b(a) { return a == W ? 'down' : a == V ? 'up' : a == T ? 'left' : a == U ? 'right' : ''; } function _b(a, b) { var c = b.manager; return c ? c.get(a) : a; } function ac() { Yb.apply(this, arguments); } function bc() { ac.apply(this, arguments), this.pX = null, this.pY = null; } function cc() { ac.apply(this, arguments); } function dc() { Yb.apply(this, arguments), this._timer = null, this._input = null; } function ec() { ac.apply(this, arguments); } function fc() { ac.apply(this, arguments); } function gc() { Yb.apply(this, arguments), this.pTime = !1, this.pCenter = !1, this._timer = null, this._input = null, this.count = 0; } function hc(a, b) { return b = b || {}, b.recognizers = s(b.recognizers, hc.defaults.preset), new kc(a, b); } function kc(a, b) { b = b || {}, this.options = o(b, hc.defaults), this.options.inputTarget = this.options.inputTarget || a, this.handlers = {}, this.session = {}, this.recognizers = [], this.element = a, this.input = bb(this), this.touchAction = new Pb(this, this.options.touchAction), lc(this, !0), m(b.recognizers, function (a) { var b = this.add(new a[0](a[1])); a[2] && b.recognizeWith(a[2]), a[3] && b.requireFailure(a[3]); }, this); } function lc(a, b) { var c = a.element; m(a.options.cssProps, function (a, d) { c.style[B(c.style, d)] = b ? a : ''; }); } function mc(a, c) { var d = b.createEvent('Event'); d.initEvent(a, !0, !0), d.gesture = c, c.target.dispatchEvent(d); } var e = ['', 'webkit', 'moz', 'MS', 'ms', 'o'], f = b.createElement('div'), g = 'function', h = Math.round, i = Math.abs, j = Date.now, C = 1, F = /mobile|tablet|ip(ad|hone|od)|android/i, G = 'ontouchstart'in a, H = B(a, 'PointerEvent') !== d, I = G && F.test(navigator.userAgent), J = 'touch', K = 'pen', L = 'mouse', M = 'kinect', N = 25, O = 1, P = 2, Q = 4, R = 8, S = 1, T = 2, U = 4, V = 8, W = 16, X = T | U, Y = V | W, Z = X | Y, $ = ['x', 'y'], _ = ['clientX', 'clientY']; ab.prototype = { handler() {}, init() { this.evEl && t(this.element, this.evEl, this.domHandler), this.evTarget && t(this.target, this.evTarget, this.domHandler), this.evWin && t(E(this.element), this.evWin, this.domHandler); }, destroy() { this.evEl && u(this.element, this.evEl, this.domHandler), this.evTarget && u(this.target, this.evTarget, this.domHandler), this.evWin && u(E(this.element), this.evWin, this.domHandler); } }; var ob = { mousedown: O, mousemove: P, mouseup: Q }, pb = 'mousedown', qb = 'mousemove mouseup'; p(rb, ab, { handler(a) { var b = ob[a.type]; b & O && 0 === a.button && (this.pressed = !0), b & P && 1 !== a.which && (b = Q), this.pressed && this.allow && (b & Q && (this.pressed = !1), this.callback(this.manager, b, { pointers: [a], changedPointers: [a], pointerType: L, srcEvent: a })); } }); var sb = { pointerdown: O, pointermove: P, pointerup: Q, pointercancel: R, pointerout: R }, tb = { 2: J, 3: K, 4: L, 5: M }, ub = 'pointerdown', vb = 'pointermove pointerup pointercancel'; a.MSPointerEvent && (ub = 'MSPointerDown', vb = 'MSPointerMove MSPointerUp MSPointerCancel'), p(wb, ab, { handler(a) { var b = this.store, c = !1, d = a.type.toLowerCase().replace('ms', ''), e = sb[d], f = tb[a.pointerType] || a.pointerType, g = f == J, h = y(b, a.pointerId, 'pointerId'); e & O && (0 === a.button || g) ? 0 > h && (b.push(a), h = b.length - 1) : e & (Q | R) && (c = !0), 0 > h || (b[h] = a, this.callback(this.manager, e, { pointers: b, changedPointers: [a], pointerType: f, srcEvent: a }), c && b.splice(h, 1)); } }); var xb = { touchstart: O, touchmove: P, touchend: Q, touchcancel: R }, yb = 'touchstart', zb = 'touchstart touchmove touchend touchcancel'; p(Ab, ab, { handler(a) { var b = xb[a.type]; if (b === O && (this.started = !0), this.started) { var c = Bb.call(this, a, b); b & (Q | R) && 0 === c[0].length - c[1].length && (this.started = !1), this.callback(this.manager, b, { pointers: c[0], changedPointers: c[1], pointerType: J, srcEvent: a }); } } }); var Cb = { touchstart: O, touchmove: P, touchend: Q, touchcancel: R }, Db = 'touchstart touchmove touchend touchcancel'; p(Eb, ab, { handler(a) { var b = Cb[a.type], c = Fb.call(this, a, b); c && this.callback(this.manager, b, { pointers: c[0], changedPointers: c[1], pointerType: J, srcEvent: a }); } }), p(Gb, ab, { handler(a, b, c) { var d = c.pointerType == J, e = c.pointerType == L; if (d) this.mouse.allow = !1; else if (e && !this.mouse.allow) return; b & (Q | R) && (this.mouse.allow = !0), this.callback(a, b, c); }, destroy() { this.touch.destroy(), this.mouse.destroy(); } }); var Hb = B(f.style, 'touchAction'), Ib = Hb !== d, Jb = 'compute', Kb = 'auto', Lb = 'manipulation', Mb = 'none', Nb = 'pan-x', Ob = 'pan-y'; Pb.prototype = { set(a) { a == Jb && (a = this.compute()), Ib && (this.manager.element.style[Hb] = a), this.actions = a.toLowerCase().trim(); }, update() { this.set(this.manager.options.touchAction); }, compute() { var a = []; return m(this.manager.recognizers, function (b) { r(b.options.enable, [b]) && (a = a.concat(b.getTouchAction())); }), Qb(a.join(' ')); }, preventDefaults(a) { if (!Ib) { var b = a.srcEvent, c = a.offsetDirection; if (this.manager.session.prevented) return b.preventDefault(), void 0; var d = this.actions, e = w(d, Mb), f = w(d, Ob), g = w(d, Nb); return e || f && c & X || g && c & Y ? this.preventSrc(b) : void 0; } }, preventSrc(a) { this.manager.session.prevented = !0, a.preventDefault(); } }; var Rb = 1, Sb = 2, Tb = 4, Ub = 8, Vb = Ub, Wb = 16, Xb = 32; Yb.prototype = { defaults: {}, set(a) { return n(this.options, a), this.manager && this.manager.touchAction.update(), this; }, recognizeWith(a) { if (l(a, 'recognizeWith', this)) return this; var b = this.simultaneous; return a = _b(a, this), b[a.id] || (b[a.id] = a, a.recognizeWith(this)), this; }, dropRecognizeWith(a) { return l(a, 'dropRecognizeWith', this) ? this : (a = _b(a, this), delete this.simultaneous[a.id], this); }, requireFailure(a) { if (l(a, 'requireFailure', this)) return this; var b = this.requireFail; return a = _b(a, this), -1 === y(b, a) && (b.push(a), a.requireFailure(this)), this; }, dropRequireFailure(a) { if (l(a, 'dropRequireFailure', this)) return this; a = _b(a, this); var b = y(this.requireFail, a); return b > -1 && this.requireFail.splice(b, 1), this; }, hasRequireFailures() { return this.requireFail.length > 0; }, canRecognizeWith(a) { return !!this.simultaneous[a.id]; }, emit(a) { function d(d) { b.manager.emit(b.options.event + (d ? Zb(c) : ''), a); } var b = this, c = this.state; Ub > c && d(!0), d(), c >= Ub && d(!0); }, tryEmit(a) { return this.canEmit() ? this.emit(a) : (this.state = Xb, void 0); }, canEmit() { for (var a = 0; a < this.requireFail.length;) { if (!(this.requireFail[a].state & (Xb | Rb))) return !1; a++; } return !0; }, recognize(a) { var b = n({}, a); return r(this.options.enable, [this, b]) ? (this.state & (Vb | Wb | Xb) && (this.state = Rb), this.state = this.process(b), this.state & (Sb | Tb | Ub | Wb) && this.tryEmit(b), void 0) : (this.reset(), this.state = Xb, void 0); }, process() {}, getTouchAction() {}, reset() {} }, p(ac, Yb, { defaults: { pointers: 1 }, attrTest(a) { var b = this.options.pointers; return 0 === b || a.pointers.length === b; }, process(a) { var b = this.state, c = a.eventType, d = b & (Sb | Tb), e = this.attrTest(a); return d && (c & R || !e) ? b | Wb : d || e ? c & Q ? b | Ub : b & Sb ? b | Tb : Sb : Xb; } }), p(bc, ac, { defaults: { event: 'pan', threshold: 10, pointers: 1, direction: Z }, getTouchAction() { var a = this.options.direction, b = []; return a & X && b.push(Ob), a & Y && b.push(Nb), b; }, directionTest(a) { var b = this.options, c = !0, d = a.distance, e = a.direction, f = a.deltaX, g = a.deltaY; return e & b.direction || (b.direction & X ? (e = 0 === f ? S : 0 > f ? T : U, c = f != this.pX, d = Math.abs(a.deltaX)) : (e = 0 === g ? S : 0 > g ? V : W, c = g != this.pY, d = Math.abs(a.deltaY))), a.direction = e, c && d > b.threshold && e & b.direction; }, attrTest(a) { return ac.prototype.attrTest.call(this, a) && (this.state & Sb || !(this.state & Sb) && this.directionTest(a)); }, emit(a) { this.pX = a.deltaX, this.pY = a.deltaY; var b = $b(a.direction); b && this.manager.emit(this.options.event + b, a), this._super.emit.call(this, a); } }), p(cc, ac, { defaults: { event: 'pinch', threshold: 0, pointers: 2 }, getTouchAction() { return [Mb]; }, attrTest(a) { return this._super.attrTest.call(this, a) && (Math.abs(a.scale - 1) > this.options.threshold || this.state & Sb); }, emit(a) { if (this._super.emit.call(this, a), 1 !== a.scale) { var b = a.scale < 1 ? 'in' : 'out'; this.manager.emit(this.options.event + b, a); } } }), p(dc, Yb, { defaults: { event: 'press', pointers: 1, time: 500, threshold: 5 }, getTouchAction() { return [Kb]; }, process(a) { var b = this.options, c = a.pointers.length === b.pointers, d = a.distance < b.threshold, e = a.deltaTime > b.time; if (this._input = a, !d || !c || a.eventType & (Q | R) && !e) this.reset(); else if (a.eventType & O) this.reset(), this._timer = k(function () { this.state = Vb, this.tryEmit(); }, b.time, this); else if (a.eventType & Q) return Vb; return Xb; }, reset() { clearTimeout(this._timer); }, emit(a) { this.state === Vb && (a && a.eventType & Q ? this.manager.emit(this.options.event + 'up', a) : (this._input.timeStamp = j(), this.manager.emit(this.options.event, this._input))); } }), p(ec, ac, { defaults: { event: 'rotate', threshold: 0, pointers: 2 }, getTouchAction() { return [Mb]; }, attrTest(a) { return this._super.attrTest.call(this, a) && (Math.abs(a.rotation) > this.options.threshold || this.state & Sb); } }), p(fc, ac, { defaults: { event: 'swipe', threshold: 10, velocity: .65, direction: X | Y, pointers: 1 }, getTouchAction() { return bc.prototype.getTouchAction.call(this); }, attrTest(a) { var c, b = this.options.direction; return b & (X | Y) ? c = a.velocity : b & X ? c = a.velocityX : b & Y && (c = a.velocityY), this._super.attrTest.call(this, a) && b & a.direction && a.distance > this.options.threshold && i(c) > this.options.velocity && a.eventType & Q; }, emit(a) { var b = $b(a.direction); b && this.manager.emit(this.options.event + b, a), this.manager.emit(this.options.event, a); } }), p(gc, Yb, { defaults: { event: 'tap', pointers: 1, taps: 1, interval: 300, time: 250, threshold: 2, posThreshold: 10 }, getTouchAction() { return [Lb]; }, process(a) { var b = this.options, c = a.pointers.length === b.pointers, d = a.distance < b.threshold, e = a.deltaTime < b.time; if (this.reset(), a.eventType & O && 0 === this.count) return this.failTimeout(); if (d && e && c) { if (a.eventType != Q) return this.failTimeout(); var f = this.pTime ? a.timeStamp - this.pTime < b.interval : !0, g = !this.pCenter || kb(this.pCenter, a.center) < b.posThreshold; this.pTime = a.timeStamp, this.pCenter = a.center, g && f ? this.count += 1 : this.count = 1, this._input = a; var h = this.count % b.taps; if (0 === h) return this.hasRequireFailures() ? (this._timer = k(function () { this.state = Vb, this.tryEmit(); }, b.interval, this), Sb) : Vb; } return Xb; }, failTimeout() { return this._timer = k(function () { this.state = Xb; }, this.options.interval, this), Xb; }, reset() { clearTimeout(this._timer); }, emit() { this.state == Vb && (this._input.tapCount = this.count, this.manager.emit(this.options.event, this._input)); } }), hc.VERSION = '2.0.4', hc.defaults = { domEvents: !1, touchAction: Jb, enable: !0, inputTarget: null, inputClass: null, preset: [[ec, { enable: !1 }], [cc, { enable: !1 }, ['rotate']], [fc, { direction: X }], [bc, { direction: X }, ['swipe']], [gc], [gc, { event: 'doubletap', taps: 2 }, ['tap']], [dc]], cssProps: { userSelect: 'default', touchSelect: 'none', touchCallout: 'none', contentZooming: 'none', userDrag: 'none', tapHighlightColor: 'rgba(0,0,0,0)' } }; var ic = 1, jc = 2; kc.prototype = { set(a) { return n(this.options, a), a.touchAction && this.touchAction.update(), a.inputTarget && (this.input.destroy(), this.input.target = a.inputTarget, this.input.init()), this; }, stop(a) { this.session.stopped = a ? jc : ic; }, recognize(a) { var b = this.session; if (!b.stopped) { this.touchAction.preventDefaults(a); var c, d = this.recognizers, e = b.curRecognizer; (!e || e && e.state & Vb) && (e = b.curRecognizer = null); for (var f = 0; f < d.length;)c = d[f], b.stopped === jc || e && c != e && !c.canRecognizeWith(e) ? c.reset() : c.recognize(a), !e && c.state & (Sb | Tb | Ub) && (e = b.curRecognizer = c), f++; } }, get(a) { if (a instanceof Yb) return a; for (var b = this.recognizers, c = 0; c < b.length; c++) if (b[c].options.event == a) return b[c]; return null; }, add(a) { if (l(a, 'add', this)) return this; var b = this.get(a.options.event); return b && this.remove(b), this.recognizers.push(a), a.manager = this, this.touchAction.update(), a; }, remove(a) { if (l(a, 'remove', this)) return this; var b = this.recognizers; return a = this.get(a), b.splice(y(b, a), 1), this.touchAction.update(), this; }, on(a, b) { var c = this.handlers; return m(x(a), function (a) { c[a] = c[a] || [], c[a].push(b); }), this; }, off(a, b) { var c = this.handlers; return m(x(a), function (a) { b ? c[a].splice(y(c[a], b), 1) : delete c[a]; }), this; }, emit(a, b) { this.options.domEvents && mc(a, b); var c = this.handlers[a] && this.handlers[a].slice(); if (c && c.length) { b.type = a, b.preventDefault = function () { b.srcEvent.preventDefault(); }; for (var d = 0; d < c.length;)c[d](b), d++; } }, destroy() { this.element && lc(this, !1), this.handlers = {}, this.session = {}, this.input.destroy(), this.element = null; } }, n(hc, { INPUT_START: O, INPUT_MOVE: P, INPUT_END: Q, INPUT_CANCEL: R, STATE_POSSIBLE: Rb, STATE_BEGAN: Sb, STATE_CHANGED: Tb, STATE_ENDED: Ub, STATE_RECOGNIZED: Vb, STATE_CANCELLED: Wb, STATE_FAILED: Xb, DIRECTION_NONE: S, DIRECTION_LEFT: T, DIRECTION_RIGHT: U, DIRECTION_UP: V, DIRECTION_DOWN: W, DIRECTION_HORIZONTAL: X, DIRECTION_VERTICAL: Y, DIRECTION_ALL: Z, Manager: kc, Input: ab, TouchAction: Pb, TouchInput: Eb, MouseInput: rb, PointerEventInput: wb, TouchMouseInput: Gb, SingleTouchInput: Ab, Recognizer: Yb, AttrRecognizer: ac, Tap: gc, Pan: bc, Swipe: fc, Pinch: cc, Rotate: ec, Press: dc, on: t, off: u, each: m, merge: o, extend: n, inherit: p, bindFn: q, prefixed: B }), typeof define == g && define.amd ? define(function () { return hc; }) : 'undefined' != typeof module && module.exports ? module.exports = hc : a[c] = hc; }(window, document, 'Hammer');


(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define(['jquery', 'hammerjs'], factory);
    } else if (typeof exports === 'object') {
        factory(require('jquery'), require('hammerjs'));
    } else {
        factory(jQuery, Hammer);
    }
}(function ($, Hammer) {
    function hammerify(el, options) {
        var $el = $(el);
        if (!$el.data('hammer')) {
            $el.data('hammer', new Hammer($el[0], options));
        }
    }

    $.fn.hammer = function (options) {
        return this.each(function () {
            hammerify(this, options);
        });
    };

    // extend the emit method to also trigger jQuery events
    Hammer.Manager.prototype.emit = (function (originalEmit) {
        return function (type, data) {
            originalEmit.call(this, type, data);
            $(this.element).trigger({
                type,
                gesture: data,
            });
        };
    })(Hammer.Manager.prototype.emit);
}));
// Required for Meteor package, the use of window prevents export by Meteor
(function (window) {
  if (window.Package) {
    Materialize = {};
  } else {
    window.Materialize = {};
  }
})(window);


// Unique ID
Materialize.guid = (function () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return function () {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
           s4() + '-' + s4() + s4() + s4();
  };
})();

Materialize.elementOrParentIsFixed = function (element) {
    var $element = $(element);
    var $checkElements = $element.add($element.parents());
    var isFixed = false;
    $checkElements.each(function () {
        if ($(this).css('position') === 'fixed') {
            isFixed = true;
            return false;
        }
    });
    return isFixed;
};

// Velocity has conflicts when loaded with jQuery, this will check for it
var Vel;
if ($) {
  Vel = $.Velocity;
} else if (jQuery) {
  Vel = jQuery.Velocity;
} else {
  Vel = Velocity;
}
  (function ($) {
  $.fn.collapsible = function (options) {
    var defaults = {
        accordion: undefined,
    };

    options = $.extend(defaults, options);


    return this.each(function () {

      var $this = $(this);

      var $panel_headers = $(this).find('> li > .collapsible-header');

      var collapsible_type = $this.data('collapsible');

      // Turn off any existing event handlers
       $this.off('click.collapse', '> li > .collapsible-header');
       $panel_headers.off('click.collapse');


       /** **************
       Helper Functions
       ****************/

      // Accordion Open
      function accordionOpen(object) {
        $panel_headers = $this.find('> li > .collapsible-header');
        if (object.hasClass('active')) {
            object.parent().addClass('active');
        }
        else {
            object.parent().removeClass('active');
        }
        if (object.parent().hasClass('active')) {
          object.siblings('.collapsible-body').stop(true, false).slideDown({ duration: 350, easing: 'easeOutQuart', queue: false, complete() { $(this).css('height', ''); } });
        }
        else {
          object.siblings('.collapsible-body').stop(true, false).slideUp({ duration: 350, easing: 'easeOutQuart', queue: false, complete() { $(this).css('height', ''); } });
        }

        $panel_headers.not(object).removeClass('active').parent().removeClass('active');
        $panel_headers.not(object).parent().children('.collapsible-body').stop(true, false).slideUp(
          {
            duration: 350,
            easing: 'easeOutQuart',
            queue: false,
            complete() {
                $(this).css('height', '');
              },
          });
      }

      // Expandable Open
      function expandableOpen(object) {
        if (object.hasClass('active')) {
            object.parent().addClass('active');
        }
        else {
            object.parent().removeClass('active');
        }
        if (object.parent().hasClass('active')) {
          object.siblings('.collapsible-body').stop(true, false).slideDown({ duration: 350, easing: 'easeOutQuart', queue: false, complete() { $(this).css('height', ''); } });
        }
        else {
          object.siblings('.collapsible-body').stop(true, false).slideUp({ duration: 350, easing: 'easeOutQuart', queue: false, complete() { $(this).css('height', ''); } });
        }
      }

      /**
       * Check if object is children of panel header
       * @param  {Object}  object Jquery object
       * @return {Boolean} true if it is children
       */
      function isChildrenOfPanelHeader(object) {

        var panelHeader = getPanelHeader(object);

        return panelHeader.length > 0;
      }

      /**
       * Get panel header from a children element
       * @param  {Object} object Jquery object
       * @return {Object} panel header object
       */
      function getPanelHeader(object) {

        return object.closest('li > .collapsible-header');
      }

      /** ***  End Helper Functions  *****/


      // Add click handler to only direct collapsible header children
      $this.on('click.collapse', '> li > .collapsible-header', function (e) {
        var $header = $(this),
            element = $(e.target);

        if (isChildrenOfPanelHeader(element)) {
          element = getPanelHeader(element);
        }

        element.toggleClass('active');

        if (options.accordion || collapsible_type === 'accordion' || collapsible_type === undefined) { // Handle Accordion
          accordionOpen(element);
        } else { // Handle Expandables
          expandableOpen(element);

          if ($header.hasClass('active')) {
            expandableOpen($header);
          }
        }
      });

      // Open first active
      var $panel_headers = $this.find('> li > .collapsible-header');
      if (options.accordion || collapsible_type === 'accordion' || collapsible_type === undefined) { // Handle Accordion
        accordionOpen($panel_headers.filter('.active').first());
      }
      else { // Handle Expandables
        $panel_headers.filter('.active').each(function () {
          expandableOpen($(this));
        });
      }

    });
  };

  $(document).ready(function () {
    $('.collapsible').collapsible();
  });
}(jQuery)); (function ($) {

  // Add posibility to scroll to selected option
  // usefull for select for example
  $.fn.scrollTo = function (elem) {
    $(this).scrollTop($(this).scrollTop() - $(this).offset().top + $(elem).offset().top);
    return this;
  };

  $.fn.dropdown = function (option) {
    var defaults = {
      inDuration: 300,
      outDuration: 225,
      constrain_width: true, // Constrains width of dropdown to the activator
      hover: false,
      gutter: 0, // Spacing from edge
      belowOrigin: false,
      alignment: 'left',
    };

    this.each(function () {
    var origin = $(this);
    var options = $.extend({}, defaults, option);
    var isFocused = false;

    // Dropdown menu
    var activates = $('#' + origin.attr('data-activates'));

    function updateOptions() {
      if (origin.data('induration') !== undefined)
        options.inDuration = origin.data('inDuration');
      if (origin.data('outduration') !== undefined)
        options.outDuration = origin.data('outDuration');
      if (origin.data('constrainwidth') !== undefined)
        options.constrain_width = origin.data('constrainwidth');
      if (origin.data('hover') !== undefined)
        options.hover = origin.data('hover');
      if (origin.data('gutter') !== undefined)
        options.gutter = origin.data('gutter');
      if (origin.data('beloworigin') !== undefined)
        options.belowOrigin = origin.data('beloworigin');
      if (origin.data('alignment') !== undefined)
        options.alignment = origin.data('alignment');
    }

    updateOptions();

    // Attach dropdown to its activator
    origin.after(activates);

    /*
      Helper function to position and resize dropdown.
      Used in hover and click handler.
    */
    function placeDropdown(eventType) {
      // Check for simultaneous focus and click events.
      if (eventType === 'focus') {
        isFocused = true;
      }

      // Check html data attributes
      updateOptions();

      // Set Dropdown state
      activates.addClass('active');
      origin.addClass('active');

      // Constrain width
      if (options.constrain_width === true) {
        activates.css('width', origin.outerWidth());

      } else {
        activates.css('white-space', 'nowrap');
      }

      // Offscreen detection
      var windowHeight = window.innerHeight;
      var originHeight = origin.innerHeight();
      var offsetLeft = origin.offset().left;
      var offsetTop = origin.offset().top - $(window).scrollTop();
      var currAlignment = options.alignment;
      var activatesLeft, gutterSpacing;

      // Below Origin
      var verticalOffset = 0;
      if (options.belowOrigin === true) {
        verticalOffset = originHeight;
      }

      if (offsetLeft + activates.innerWidth() > $(window).width()) {
        // Dropdown goes past screen on right, force right alignment
        currAlignment = 'right';

      } else if (offsetLeft - activates.innerWidth() + origin.innerWidth() < 0) {
        // Dropdown goes past screen on left, force left alignment
        currAlignment = 'left';
      }
      // Vertical bottom offscreen detection
      if (offsetTop + activates.innerHeight() > windowHeight) {
        // If going upwards still goes offscreen, just crop height of dropdown.
        if (offsetTop + originHeight - activates.innerHeight() < 0) {
          var adjustedHeight = windowHeight - offsetTop - verticalOffset;
          activates.css('max-height', adjustedHeight);
        } else {
          // Flow upwards.
          if (!verticalOffset) {
            verticalOffset += originHeight;
          }
          verticalOffset -= activates.innerHeight();
        }
      }

      // Handle edge alignment
      if (currAlignment === 'left') {
        gutterSpacing = options.gutter;
        leftPosition = origin.position().left + gutterSpacing;
      }
      else if (currAlignment === 'right') {
        var offsetRight = origin.position().left + origin.outerWidth() - activates.outerWidth();
        gutterSpacing = -options.gutter;
        leftPosition =  offsetRight + gutterSpacing;
      }

      // Position dropdown
      activates.css({
        position: 'absolute',
        top: origin.position().top + verticalOffset,
        left: leftPosition,
      });


      // Show dropdown
      activates.stop(true, true).css('opacity', 0)
        .slideDown({
        queue: false,
        duration: options.inDuration,
        easing: 'easeOutCubic',
        complete() {
          $(this).css('height', '');
        },
      })
        .animate({ opacity: 1 }, { queue: false, duration: options.inDuration, easing: 'easeOutSine' });
    }

    function hideDropdown() {
      // Check for simultaneous focus and click events.
      isFocused = false;
      activates.fadeOut(options.outDuration);
      activates.removeClass('active');
      origin.removeClass('active');
      setTimeout(function () { activates.css('max-height', ''); }, options.outDuration);
    }

    // Hover
    if (options.hover) {
      var open = false;
      origin.off('click.' + origin.attr('id'));
      // Hover handler to show dropdown
      origin.on('mouseenter', function (e) { // Mouse over
        if (open === false) {
          placeDropdown();
          open = true;
        }
      });
      origin.on('mouseleave', function (e) {
        // If hover on origin then to something other than dropdown content, then close
        var toEl = e.toElement || e.relatedTarget; // added browser compatibility for target element
        if (!$(toEl).closest('.dropdown-content').is(activates)) {
          activates.stop(true, true);
          hideDropdown();
          open = false;
        }
      });

      activates.on('mouseleave', function (e) { // Mouse out
        var toEl = e.toElement || e.relatedTarget;
        if (!$(toEl).closest('.dropdown-button').is(origin)) {
          activates.stop(true, true);
          hideDropdown();
          open = false;
        }
      });

    // Click
    } else {
      // Click handler to show dropdown
      origin.off('click.' + origin.attr('id'));
      origin.on('click.' + origin.attr('id'), function (e) {
        if (!isFocused) {
          if (origin[0] == e.currentTarget &&
               !origin.hasClass('active') &&
               ($(e.target).closest('.dropdown-content').length === 0)) {
            e.preventDefault(); // Prevents button click from moving window
            placeDropdown('click');
          }
          // If origin is clicked and menu is open, close menu
          else if (origin.hasClass('active')) {
            hideDropdown();
            $(document).off('click.' + activates.attr('id') + ' touchstart.' + activates.attr('id'));
          }
          // If menu open, add click close handler to document
          if (activates.hasClass('active')) {
            $(document).on('click.' + activates.attr('id') + ' touchstart.' + activates.attr('id'), function (e) {
              if (!activates.is(e.target) && !origin.is(e.target) && (!origin.find(e.target).length)) {
                hideDropdown();
                $(document).off('click.' + activates.attr('id') + ' touchstart.' + activates.attr('id'));
              }
            });
          }
        }
      });

    } // End else

    // Listen to open and close event - useful for select component
    origin.on('open', function (e, eventType) {
      placeDropdown(eventType);
    });
    origin.on('close', hideDropdown);


   });
  }; // End dropdown plugin

  $(document).ready(function () {
    $('.dropdown-button').dropdown();
  });
}(jQuery)); (function ($) {
    var _stack = 0,
    _lastID = 0,
    _generateID = function () {
      _lastID++;
      return 'materialize-lean-overlay-' + _lastID;
    };

  $.fn.extend({
    openModal(options) {

      $('body').css('overflow', 'hidden');

      var defaults = {
        opacity: 0.5,
        in_duration: 350,
        out_duration: 250,
        ready: undefined,
        complete: undefined,
        dismissible: true,
        starting_top: '4%',
      },
      overlayID = _generateID(),
      $modal = $(this),
      $overlay = $('<div class="lean-overlay"></div>'),
      lStack = (++_stack);

      // Store a reference of the overlay
      $overlay.attr('id', overlayID).css('z-index', 1000 + lStack * 2);
      $modal.data('overlay-id', overlayID).css('z-index', 1000 + lStack * 2 + 1);

      $('body').append($overlay);

      // Override defaults
      options = $.extend(defaults, options);

      if (options.dismissible) {
        $overlay.click(function () {
          $modal.closeModal(options);
        });
        // Return on ESC
        $(document).on('keyup.leanModal' + overlayID, function (e) {
          if (e.keyCode === 27) {   // ESC key
            $modal.closeModal(options);
          }
        });
      }

      $modal.find('.modal-close').on('click.close', function (e) {
        $modal.closeModal(options);
      });

      $overlay.css({ display: 'block', opacity: 0 });

      $modal.css({
        display: 'block',
        opacity: 0,
      });

      $overlay.velocity({ opacity: options.opacity }, { duration: options.in_duration, queue: false, ease: 'easeOutCubic' });
      $modal.data('associated-overlay', $overlay[0]);

      // Define Bottom Sheet animation
      if ($modal.hasClass('bottom-sheet')) {
        $modal.velocity({ bottom: '0', opacity: 1 }, {
          duration: options.in_duration,
          queue: false,
          ease: 'easeOutCubic',
          // Handle modal ready callback
          complete() {
            if (typeof (options.ready) === 'function') {
              options.ready();
            }
          },
        });
      }
      else {
        $.Velocity.hook($modal, 'scaleX', 0.7);
        $modal.css({ top: options.starting_top });
        $modal.velocity({ top: '10%', opacity: 1, scaleX: '1' }, {
          duration: options.in_duration,
          queue: false,
          ease: 'easeOutCubic',
          // Handle modal ready callback
          complete() {
            if (typeof (options.ready) === 'function') {
              options.ready();
            }
          },
        });
      }


    },
  });

  $.fn.extend({
    closeModal(options) {
      var defaults = {
        out_duration: 250,
        complete: undefined,
      },
      $modal = $(this),
      overlayID = $modal.data('overlay-id'),
      $overlay = $('#' + overlayID);

      options = $.extend(defaults, options);

      // Disable scrolling
      $('body').css('overflow', '');

      $modal.find('.modal-close').off('click.close');
      $(document).off('keyup.leanModal' + overlayID);

      $overlay.velocity({ opacity: 0 }, { duration: options.out_duration, queue: false, ease: 'easeOutQuart' });


      // Define Bottom Sheet animation
      if ($modal.hasClass('bottom-sheet')) {
        $modal.velocity({ bottom: '-100%', opacity: 0 }, {
          duration: options.out_duration,
          queue: false,
          ease: 'easeOutCubic',
          // Handle modal ready callback
          complete() {
            $overlay.css({ display: 'none' });

            // Call complete callback
            if (typeof (options.complete) === 'function') {
              options.complete();
            }
            $overlay.remove();
            _stack--;
          },
        });
      }
      else {
        $modal.velocity(
          { top: options.starting_top, opacity: 0, scaleX: 0.7 }, {
          duration: options.out_duration,
          complete() {

              $(this).css('display', 'none');
              // Call complete callback
              if (typeof (options.complete) === 'function') {
                options.complete();
              }
              $overlay.remove();
              _stack--;
            },
          }
        );
      }
    },
  });

  $.fn.extend({
    leanModal(option) {
      return this.each(function () {

        var defaults = {
          starting_top: '4%',
        },
        // Override defaults
        options = $.extend(defaults, option);

        // Close Handlers
        $(this).click(function (e) {
          options.starting_top = ($(this).offset().top - $(window).scrollTop()) / 1.15;
          var modal_id = $(this).attr('href') || '#' + $(this).data('target');
          $(modal_id).openModal(options);
          e.preventDefault();
        }); // done set on click
      }); // done return
    },
  });
})(jQuery);
(function ($) {

  $.fn.materialbox = function () {

    return this.each(function () {

      if ($(this).hasClass('initialized')) {
        return;
      }

      $(this).addClass('initialized');

      var overlayActive = false;
      var doneAnimating = true;
      var inDuration = 275;
      var outDuration = 200;
      var origin = $(this);
      var placeholder = $('<div></div>').addClass('material-placeholder');
      var originalWidth = 0;
      var originalHeight = 0;
      var ancestorsChanged;
      var ancestor;
      origin.wrap(placeholder);


      origin.on('click', function () {
        var placeholder = origin.parent('.material-placeholder');
        var windowWidth = window.innerWidth;
        var windowHeight = window.innerHeight;
        var originalWidth = origin.width();
        var originalHeight = origin.height();


        // If already modal, return to original
        if (doneAnimating === false) {
          returnToOriginal();
          return false;
        }
        else if (overlayActive && doneAnimating === true) {
          returnToOriginal();
          return false;
        }


        // Set states
        doneAnimating = false;
        origin.addClass('active');
        overlayActive = true;

        // Set positioning for placeholder
        placeholder.css({
          width: placeholder[0].getBoundingClientRect().width,
          height: placeholder[0].getBoundingClientRect().height,
          position: 'relative',
          top: 0,
          left: 0,
        });

        // Find ancestor with overflow: hidden; and remove it
        ancestorsChanged = undefined;
        ancestor = placeholder[0].parentNode;
        var count = 0;
        while (ancestor !== null && !$(ancestor).is(document)) {
          var curr = $(ancestor);
          if (curr.css('overflow') === 'hidden') {
            curr.css('overflow', 'visible');
            if (ancestorsChanged === undefined) {
              ancestorsChanged = curr;
            }
            else {
              ancestorsChanged = ancestorsChanged.add(curr);
            }
          }
          ancestor = ancestor.parentNode;
        }

        // Set css on origin
        origin.css({ position: 'absolute', 'z-index': 1000 })
        .data('width', originalWidth)
        .data('height', originalHeight);

        // Add overlay
        var overlay = $('<div id="materialbox-overlay"></div>')
          .css({
            opacity: 0,
          })
          .click(function () {
            if (doneAnimating === true)
            returnToOriginal();
          });
          // Animate Overlay
          $('body').append(overlay);
          overlay.velocity({ opacity: 1 }, { duration: inDuration, queue: false, easing: 'easeOutQuad' }
            );


        // Add and animate caption if it exists
        if (origin.data('caption') !== '') {
          var $photo_caption = $('<div class="materialbox-caption"></div>');
          $photo_caption.text(origin.data('caption'));
          $('body').append($photo_caption);
          $photo_caption.css({ 'display': 'inline' });
          $photo_caption.velocity({ opacity: 1 }, { duration: inDuration, queue: false, easing: 'easeOutQuad' });
        }


        // Resize Image
        var ratio = 0;
        var widthPercent = originalWidth / windowWidth;
        var heightPercent = originalHeight / windowHeight;
        var newWidth = 0;
        var newHeight = 0;

        if (widthPercent > heightPercent) {
          ratio = originalHeight / originalWidth;
          newWidth = windowWidth * 0.9;
          newHeight = windowWidth * 0.9 * ratio;
        }
        else {
          ratio = originalWidth / originalHeight;
          newWidth = (windowHeight * 0.9) * ratio;
          newHeight = windowHeight * 0.9;
        }

        // Animate image + set z-index
        if (origin.hasClass('responsive-img')) {
          origin.velocity({ 'max-width': newWidth, 'width': originalWidth }, { duration: 0, queue: false,
            complete() {
              origin.css({ left: 0, top: 0 })
              .velocity(
                {
                  height: newHeight,
                  width: newWidth,
                  left: $(document).scrollLeft() + windowWidth / 2 - origin.parent('.material-placeholder').offset().left - newWidth / 2,
                  top: $(document).scrollTop() + windowHeight / 2 - origin.parent('.material-placeholder').offset().top - newHeight / 2,
                },
                {
                  duration: inDuration,
                  queue: false,
                  easing: 'easeOutQuad',
                  complete() { doneAnimating = true; },
                }
              );
            }, // End Complete
          }); // End Velocity
        }
        else {
          origin.css('left', 0)
          .css('top', 0)
          .velocity(
            {
              height: newHeight,
              width: newWidth,
              left: $(document).scrollLeft() + windowWidth / 2 - origin.parent('.material-placeholder').offset().left - newWidth / 2,
              top: $(document).scrollTop() + windowHeight / 2 - origin.parent('.material-placeholder').offset().top - newHeight / 2,
            },
            {
              duration: inDuration,
              queue: false,
              easing: 'easeOutQuad',
              complete() { doneAnimating = true; },
            }
            ); // End Velocity
        }

    }); // End origin on click


      // Return on scroll
      $(window).scroll(function () {
        if (overlayActive) {
          returnToOriginal();
        }
      });

      // Return on ESC
      $(document).keyup(function (e) {

        if (e.keyCode === 27 && doneAnimating === true) {   // ESC key
          if (overlayActive) {
            returnToOriginal();
          }
        }
      });


      // This function returns the modaled image to the original spot
      function returnToOriginal() {

          doneAnimating = false;

          var placeholder = origin.parent('.material-placeholder');
          var windowWidth = window.innerWidth;
          var windowHeight = window.innerHeight;
          var originalWidth = origin.data('width');
          var originalHeight = origin.data('height');

          origin.velocity('stop', true);
          $('#materialbox-overlay').velocity('stop', true);
          $('.materialbox-caption').velocity('stop', true);


          $('#materialbox-overlay').velocity({ opacity: 0 }, {
            duration: outDuration, // Delay prevents animation overlapping
            queue: false, easing: 'easeOutQuad',
            complete() {
              // Remove Overlay
              overlayActive = false;
              $(this).remove();
            },
          });

          // Resize Image
          origin.velocity(
            {
              width: originalWidth,
              height: originalHeight,
              left: 0,
              top: 0,
            },
            {
              duration: outDuration,
              queue: false, easing: 'easeOutQuad',
            }
          );

          // Remove Caption + reset css settings on image
          $('.materialbox-caption').velocity({ opacity: 0 }, {
            duration: outDuration, // Delay prevents animation overlapping
            queue: false, easing: 'easeOutQuad',
            complete() {
              placeholder.css({
                height: '',
                width: '',
                position: '',
                top: '',
                left: '',
              });

              origin.css({
                height: '',
                top: '',
                left: '',
                width: '',
                'max-width': '',
                position: '',
                'z-index': '',
              });

              // Remove class
              origin.removeClass('active');
              doneAnimating = true;
              $(this).remove();

              // Remove overflow overrides on ancestors
              ancestorsChanged.css('overflow', '');
            },
          });

        }
        });
};

$(document).ready(function () {
  $('.materialboxed').materialbox();
});

}(jQuery));
(function ($) {

    $.fn.parallax = function () {
      var window_width = $(window).width();
      // Parallax Scripts
      return this.each(function (i) {
        var $this = $(this);
        $this.addClass('parallax');

        function updateParallax(initial) {
          var container_height;
          if (window_width < 601) {
            container_height = ($this.height() > 0) ? $this.height() : $this.children('img').height();
          }
          else {
            container_height = ($this.height() > 0) ? $this.height() : 500;
          }
          var $img = $this.children('img').first();
          var img_height = $img.height();
          var parallax_dist = img_height - container_height;
          var bottom = $this.offset().top + container_height;
          var top = $this.offset().top;
          var scrollTop = $(window).scrollTop();
          var windowHeight = window.innerHeight;
          var windowBottom = scrollTop + windowHeight;
          var percentScrolled = (windowBottom - top) / (container_height + windowHeight);
          var parallax = Math.round((parallax_dist * percentScrolled));

          if (initial) {
            $img.css('display', 'block');
          }
          if ((bottom > scrollTop) && (top < (scrollTop + windowHeight))) {
            $img.css('transform', 'translate3D(-50%,' + parallax + 'px, 0)');
          }

        }

        // Wait for image load
        $this.children('img').one('load', function () {
          updateParallax(true);
        }).each(function () {
          if (this.complete) $(this).load();
        });

        $(window).scroll(function () {
          window_width = $(window).width();
          updateParallax(false);
        });

        $(window).resize(function () {
          window_width = $(window).width();
          updateParallax(false);
        });

      });

    };
}(jQuery)); (function ($) {

  var methods = {
    init() {
      return this.each(function () {

      // For each set of tabs, we want to keep track of
      // which tab is active and its associated content
      var $this = $(this),
          window_width = $(window).width();

      $this.width('100%');
      var $active, $content, $links = $this.find('li.tab a'),
          $tabs_width = $this.width(),
          $tab_width = $this.find('li').first().outerWidth(),
          $index = 0;

      // If the location.hash matches one of the links, use that as the active tab.
      $active = $($links.filter('[href="' + location.hash + '"]'));

      // If no match is found, use the first link or any with class 'active' as the initial active tab.
      if ($active.length === 0) {
          $active = $(this).find('li.tab a.active').first();
      }
      if ($active.length === 0) {
        $active = $(this).find('li.tab a').first();
      }

      $active.addClass('active');
      $index = $links.index($active);
      if ($index < 0) {
        $index = 0;
      }

      $content = $($active[0].hash);

      // append indicator then set indicator width to tab width
      $this.append('<div class="indicator"></div>');
      var $indicator = $this.find('.indicator');
      if ($this.is(':visible')) {
        $indicator.css({ 'right': $tabs_width - (($index + 1) * $tab_width) });
        $indicator.css({ 'left': $index * $tab_width });
      }
      $(window).resize(function () {
        $tabs_width = $this.width();
        $tab_width = $this.find('li').first().outerWidth();
        if ($index < 0) {
          $index = 0;
        }
        if ($tab_width !== 0 && $tabs_width !== 0) {
          $indicator.css({ 'right': $tabs_width - (($index + 1) * $tab_width) });
          $indicator.css({ 'left': $index * $tab_width });
        }
      });

      // Hide the remaining content
      $links.not($active).each(function () {
        $(this.hash).hide();
      });


      // Bind the click event handler
      $this.on('click', 'a', function (e) {
        if ($(this).parent().hasClass('disabled')) {
          e.preventDefault();
          return;
        }

        $tabs_width = $this.width();
        $tab_width = $this.find('li').first().outerWidth();

        // Make the old tab inactive.
        $active.removeClass('active');
        $content.hide();

        // Update the variables with the new link and content
        $active = $(this);
        $content = $(this.hash);
        $links = $this.find('li.tab a');

        // Make the tab active.
        $active.addClass('active');
        var $prev_index = $index;
        $index = $links.index($(this));
        if ($index < 0) {
          $index = 0;
        }
        // Change url to current tab
        // window.location.hash = $active.attr('href');

        $content.show();

        // Update indicator
        if (($index - $prev_index) >= 0) {
          $indicator.velocity({ 'right': $tabs_width - (($index + 1) * $tab_width) }, { duration: 300, queue: false, easing: 'easeOutQuad' });
          $indicator.velocity({ 'left': $index * $tab_width }, { duration: 300, queue: false, easing: 'easeOutQuad', delay: 90 });

        }
        else {
          $indicator.velocity({ 'left': $index * $tab_width }, { duration: 300, queue: false, easing: 'easeOutQuad' });
          $indicator.velocity({ 'right': $tabs_width - (($index + 1) * $tab_width) }, { duration: 300, queue: false, easing: 'easeOutQuad', delay: 90 });
        }

        // Prevent the anchor's default click action
        e.preventDefault();
      });
    });

    },
    select_tab(id) {
      this.find('a[href="#' + id + '"]').trigger('click');
    },
  };

  $.fn.tabs = function (methodOrOptions) {
    if (methods[methodOrOptions]) {
      return methods[methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
    } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
      // Default to "init"
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' +  methodOrOptions + ' does not exist on jQuery.tooltip');
    }
  };

  $(document).ready(function () {
    $('ul.tabs').tabs();
  });
}(jQuery));
(function ($) {
    $.fn.tooltip = function (options) {
        var timeout = null,
        margin = 5;

      // Defaults
      var defaults = {
        delay: 350,
      };

      // Remove tooltip from the activator
      if (options === 'remove') {
        this.each(function () {
          $('#' + $(this).attr('data-tooltip-id')).remove();
          $(this).off('mouseenter.tooltip mouseleave.tooltip');
        });
        return false;
      }

      options = $.extend(defaults, options);


      return this.each(function () {
        var tooltipId = Materialize.guid();
        var origin = $(this);
        origin.attr('data-tooltip-id', tooltipId);

        // Create Text span
        var tooltip_text = $('<span></span>').text(origin.attr('data-tooltip'));

        // Create tooltip
        var newTooltip = $('<div></div>');
        newTooltip.addClass('material-tooltip').append(tooltip_text)
          .appendTo($('body'))
          .attr('id', tooltipId);

        var backdrop = $('<div></div>').addClass('backdrop');
        backdrop.appendTo(newTooltip);
        backdrop.css({ top: 0, left: 0 });


      // Destroy previously binded events
      origin.off('mouseenter.tooltip mouseleave.tooltip');
      // Mouse In
      var started = false, timeoutRef;
      origin.on({
        'mouseenter.tooltip'(e) {
          var tooltip_delay = origin.attr('data-delay');
          tooltip_delay = (tooltip_delay === undefined || tooltip_delay === '') ?
              options.delay : tooltip_delay;
          timeoutRef = setTimeout(function () {
            started = true;
            newTooltip.velocity('stop');
            backdrop.velocity('stop');
            newTooltip.css({ display: 'block', left: '0px', top: '0px' });

            // Set Tooltip text
            newTooltip.children('span').text(origin.attr('data-tooltip'));

            // Tooltip positioning
            var originWidth = origin.outerWidth();
            var originHeight = origin.outerHeight();
            var tooltipPosition =  origin.attr('data-position');
            var tooltipHeight = newTooltip.outerHeight();
            var tooltipWidth = newTooltip.outerWidth();
            var tooltipVerticalMovement = '0px';
            var tooltipHorizontalMovement = '0px';
            var scale_factor = 8;
            var targetTop, targetLeft, newCoordinates;

            if (tooltipPosition === 'top') {
              // Top Position
              targetTop = origin.offset().top - tooltipHeight - margin;
              targetLeft = origin.offset().left + originWidth / 2 - tooltipWidth / 2;
              newCoordinates = repositionWithinScreen(targetLeft, targetTop, tooltipWidth, tooltipHeight);

              tooltipVerticalMovement = '-10px';
              backdrop.css({
                borderRadius: '14px 14px 0 0',
                transformOrigin: '50% 90%',
                marginTop: tooltipHeight,
                marginLeft: (tooltipWidth / 2) - (backdrop.width() / 2),
              });
            }
            // Left Position
            else if (tooltipPosition === 'left') {
              targetTop = origin.offset().top + originHeight / 2 - tooltipHeight / 2;
              targetLeft =  origin.offset().left - tooltipWidth - margin;
              newCoordinates = repositionWithinScreen(targetLeft, targetTop, tooltipWidth, tooltipHeight);

              tooltipHorizontalMovement = '-10px';
              backdrop.css({
                width: '14px',
                height: '14px',
                borderRadius: '14px 0 0 14px',
                transformOrigin: '95% 50%',
                marginTop: tooltipHeight / 2,
                marginLeft: tooltipWidth,
              });
            }
            // Right Position
            else if (tooltipPosition === 'right') {
              targetTop = origin.offset().top + originHeight / 2 - tooltipHeight / 2;
              targetLeft = origin.offset().left + originWidth + margin;
              newCoordinates = repositionWithinScreen(targetLeft, targetTop, tooltipWidth, tooltipHeight);

              tooltipHorizontalMovement = '+10px';
              backdrop.css({
                width: '14px',
                height: '14px',
                borderRadius: '0 14px 14px 0',
                transformOrigin: '5% 50%',
                marginTop: tooltipHeight / 2,
                marginLeft: '0px',
              });
            }
            else {
              // Bottom Position
              targetTop = origin.offset().top + origin.outerHeight() + margin;
              targetLeft = origin.offset().left + originWidth / 2 - tooltipWidth / 2;
              newCoordinates = repositionWithinScreen(targetLeft, targetTop, tooltipWidth, tooltipHeight);
              tooltipVerticalMovement = '+10px';
              backdrop.css({
                marginLeft: (tooltipWidth / 2) - (backdrop.width() / 2),
              });
            }

            // Set tooptip css placement
            newTooltip.css({
              top: newCoordinates.y,
              left: newCoordinates.x,
            });

            // Calculate Scale to fill
            scale_factor = tooltipWidth / 8;
            if (scale_factor < 8) {
              scale_factor = 8;
            }
            if (tooltipPosition === 'right' || tooltipPosition === 'left') {
              scale_factor = tooltipWidth / 10;
              if (scale_factor < 6)
                scale_factor = 6;
            }

            newTooltip.velocity({ marginTop: tooltipVerticalMovement, marginLeft: tooltipHorizontalMovement }, { duration: 350, queue: false })
              .velocity({ opacity: 1 }, { duration: 300, delay: 50, queue: false });
            backdrop.css({ display: 'block' })
              .velocity({ opacity: 1 }, { duration: 55, delay: 0, queue: false })
              .velocity({ scale: scale_factor }, { duration: 300, delay: 0, queue: false, easing: 'easeInOutQuad' });


          }, tooltip_delay); // End Interval

        // Mouse Out
        },
        'mouseleave.tooltip'() {
          // Reset State
          started = false;
          clearTimeout(timeoutRef);

          // Animate back
          setTimeout(function () {
            if (started != true) {
              newTooltip.velocity({
                opacity: 0, marginTop: 0, marginLeft: 0 }, { duration: 225, queue: false });
              backdrop.velocity({ opacity: 0, scale: 1 }, {
                duration: 225,
                queue: false,
                complete() {
                  backdrop.css('display', 'none');
                  newTooltip.css('display', 'none');
                  started = false; },
              });
            }
          }, 225);
        },
        });
    });
  };

  var repositionWithinScreen = function (x, y, width, height) {
    var newX = x;
    var newY = y;

    if (newX < 0) {
      newX = 4;
    } else if (newX + width > window.innerWidth) {
      newX -= newX + width - window.innerWidth;
    }

    if (newY < 0) {
      newY = 4;
    } else if (newY + height > window.innerHeight + $(window).scrollTop) {
      newY -= newY + height - window.innerHeight;
    }

    return { x: newX, y: newY };
  };

  $(document).ready(function () {
     $('.tooltipped').tooltip();
   });
}(jQuery));
/*!
 * Waves v0.6.4
 * http://fian.my.id/Waves
 *
 * Copyright 2014 Alfiana E. Sibuea and other contributors
 * Released under the MIT license
 * https://github.com/fians/Waves/blob/master/LICENSE
 */

(function (window) {
    'use strict';

    var Waves = Waves || {};
    var $$ = document.querySelectorAll.bind(document);

    // Find exact position of element
    function isWindow(obj) {
        return obj !== null && obj === obj.window;
    }

    function getWindow(elem) {
        return isWindow(elem) ? elem : elem.nodeType === 9 && elem.defaultView;
    }

    function offset(elem) {
        var docElem, win,
            box = { top: 0, left: 0 },
            doc = elem && elem.ownerDocument;

        docElem = doc.documentElement;

        if (typeof elem.getBoundingClientRect !== typeof undefined) {
            box = elem.getBoundingClientRect();
        }
        win = getWindow(doc);
        return {
            top: box.top + win.pageYOffset - docElem.clientTop,
            left: box.left + win.pageXOffset - docElem.clientLeft,
        };
    }

    function convertStyle(obj) {
        var style = '';

        for (var a in obj) {
            if (obj.hasOwnProperty(a)) {
                style += (a + ':' + obj[a] + ';');
            }
        }

        return style;
    }

    var Effect = {

        // Effect delay
        duration: 750,

        show(e, element) {

            // Disable right click
            if (e.button === 2) {
                return false;
            }

            var el = element || this;

            // Create ripple
            var ripple = document.createElement('div');
            ripple.className = 'waves-ripple';
            el.appendChild(ripple);

            // Get click coordinate and element witdh
            var pos         = offset(el);
            var relativeY   = (e.pageY - pos.top);
            var relativeX   = (e.pageX - pos.left);
            var scale       = 'scale(' + ((el.clientWidth / 100) * 10) + ')';

            // Support for touch devices
            if ('touches' in e) {
              relativeY   = (e.touches[0].pageY - pos.top);
              relativeX   = (e.touches[0].pageX - pos.left);
            }

            // Attach data to element
            ripple.setAttribute('data-hold', Date.now());
            ripple.setAttribute('data-scale', scale);
            ripple.setAttribute('data-x', relativeX);
            ripple.setAttribute('data-y', relativeY);

            // Set ripple position
            var rippleStyle = {
                'top': relativeY + 'px',
                'left': relativeX + 'px',
            };

            ripple.className = ripple.className + ' waves-notransition';
            ripple.setAttribute('style', convertStyle(rippleStyle));
            ripple.className = ripple.className.replace('waves-notransition', '');

            // Scale the ripple
            rippleStyle['-webkit-transform'] = scale;
            rippleStyle['-moz-transform'] = scale;
            rippleStyle['-ms-transform'] = scale;
            rippleStyle['-o-transform'] = scale;
            rippleStyle.transform = scale;
            rippleStyle.opacity   = '1';

            rippleStyle['-webkit-transition-duration'] = Effect.duration + 'ms';
            rippleStyle['-moz-transition-duration']    = Effect.duration + 'ms';
            rippleStyle['-o-transition-duration']      = Effect.duration + 'ms';
            rippleStyle['transition-duration']         = Effect.duration + 'ms';

            rippleStyle['-webkit-transition-timing-function'] = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
            rippleStyle['-moz-transition-timing-function']    = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
            rippleStyle['-o-transition-timing-function']      = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';
            rippleStyle['transition-timing-function']         = 'cubic-bezier(0.250, 0.460, 0.450, 0.940)';

            ripple.setAttribute('style', convertStyle(rippleStyle));
        },

        hide(e) {
            TouchHandler.touchup(e);

            var el = this;
            var width = el.clientWidth * 1.4;

            // Get first ripple
            var ripple = null;
            var ripples = el.getElementsByClassName('waves-ripple');
            if (ripples.length > 0) {
                ripple = ripples[ripples.length - 1];
            } else {
                return false;
            }

            var relativeX   = ripple.getAttribute('data-x');
            var relativeY   = ripple.getAttribute('data-y');
            var scale       = ripple.getAttribute('data-scale');

            // Get delay beetween mousedown and mouse leave
            var diff = Date.now() - Number(ripple.getAttribute('data-hold'));
            var delay = 350 - diff;

            if (delay < 0) {
                delay = 0;
            }

            // Fade out ripple after delay
            setTimeout(function () {
                var style = {
                    'top': relativeY + 'px',
                    'left': relativeX + 'px',
                    'opacity': '0',

                    // Duration
                    '-webkit-transition-duration': Effect.duration + 'ms',
                    '-moz-transition-duration': Effect.duration + 'ms',
                    '-o-transition-duration': Effect.duration + 'ms',
                    'transition-duration': Effect.duration + 'ms',
                    '-webkit-transform': scale,
                    '-moz-transform': scale,
                    '-ms-transform': scale,
                    '-o-transform': scale,
                    'transform': scale,
                };

                ripple.setAttribute('style', convertStyle(style));

                setTimeout(function () {
                    try {
                        el.removeChild(ripple);
                    } catch (e) {
                        return false;
                    }
                }, Effect.duration);
            }, delay);
        },

        // Little hack to make <input> can perform waves effect
        wrapInput(elements) {
            for (var a = 0; a < elements.length; a++) {
                var el = elements[a];

                if (el.tagName.toLowerCase() === 'input') {
                    var parent = el.parentNode;

                    // If input already have parent just pass through
                    if (parent.tagName.toLowerCase() === 'i' && parent.className.indexOf('waves-effect') !== -1) {
                        continue;
                    }

                    // Put element class and style to the specified parent
                    var wrapper = document.createElement('i');
                    wrapper.className = el.className + ' waves-input-wrapper';

                    var elementStyle = el.getAttribute('style');

                    if (!elementStyle) {
                        elementStyle = '';
                    }

                    wrapper.setAttribute('style', elementStyle);

                    el.className = 'waves-button-input';
                    el.removeAttribute('style');

                    // Put element as child
                    parent.replaceChild(wrapper, el);
                    wrapper.appendChild(el);
                }
            }
        },
    };


    /**
     * Disable mousedown event for 500ms during and after touch
     */
    var TouchHandler = {
        /* uses an integer rather than bool so there's no issues with
         * needing to clear timeouts if another touch event occurred
         * within the 500ms. Cannot mouseup between touchstart and
         * touchend, nor in the 500ms after touchend. */
        touches: 0,
        allowEvent(e) {
            var allow = true;

            if (e.type === 'touchstart') {
                TouchHandler.touches += 1; // push
            } else if (e.type === 'touchend' || e.type === 'touchcancel') {
                setTimeout(function () {
                    if (TouchHandler.touches > 0) {
                        TouchHandler.touches -= 1; // pop after 500ms
                    }
                }, 500);
            } else if (e.type === 'mousedown' && TouchHandler.touches > 0) {
                allow = false;
            }

            return allow;
        },
        touchup(e) {
            TouchHandler.allowEvent(e);
        },
    };


    /**
     * Delegated click handler for .waves-effect element.
     * returns null when .waves-effect element not in "click tree"
     */
    function getWavesEffectElement(e) {
        if (TouchHandler.allowEvent(e) === false) {
            return null;
        }

        var element = null;
        var target = e.target || e.srcElement;

        while (target.parentElement !== null) {
            if (!(target instanceof SVGElement) && target.className.indexOf('waves-effect') !== -1) {
                element = target;
                break;
            } else if (target.classList.contains('waves-effect')) {
                element = target;
                break;
            }
            target = target.parentElement;
        }

        return element;
    }

    /**
     * Bubble the click and show effect if .waves-effect elem was found
     */
    function showEffect(e) {
        var element = getWavesEffectElement(e);

        if (element !== null) {
            Effect.show(e, element);

            if ('ontouchstart' in window) {
                element.addEventListener('touchend', Effect.hide, false);
                element.addEventListener('touchcancel', Effect.hide, false);
            }

            element.addEventListener('mouseup', Effect.hide, false);
            element.addEventListener('mouseleave', Effect.hide, false);
        }
    }

    Waves.displayEffect = function (options) {
        options = options || {};

        if ('duration' in options) {
            Effect.duration = options.duration;
        }

        // Wrap input inside <i> tag
        Effect.wrapInput($$('.waves-effect'));

        if ('ontouchstart' in window) {
            document.body.addEventListener('touchstart', showEffect, false);
        }

        document.body.addEventListener('mousedown', showEffect, false);
    };

    /**
     * Attach Waves to an input element (or any element which doesn't
     * bubble mouseup/mousedown events).
     *   Intended to be used with dynamically loaded forms/inputs, or
     * where the user doesn't want a delegated click handler.
     */
    Waves.attach = function (element) {
        // FUTURE: automatically add waves classes and allow users
        // to specify them with an options param? Eg. light/classic/button
        if (element.tagName.toLowerCase() === 'input') {
            Effect.wrapInput([element]);
            element = element.parentElement;
        }

        if ('ontouchstart' in window) {
            element.addEventListener('touchstart', showEffect, false);
        }

        element.addEventListener('mousedown', showEffect, false);
    };

    window.Waves = Waves;

    document.addEventListener('DOMContentLoaded', function () {
        Waves.displayEffect();
    }, false);

})(window);
Materialize.toast = function (message, displayLength, className, completeCallback) {
    className = className || '';

    var container = document.getElementById('toast-container');

    // Create toast container if it does not exist
    if (container === null) {
        // create notification container
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    // Select and append toast
    var newToast = createToast(message);

    // only append toast if message is not undefined
    if (message) {
        container.appendChild(newToast);
    }

    newToast.style.top = '35px';
    newToast.style.opacity = 0;

    // Animate toast in
    Vel(newToast, { 'top': '0px', opacity: 1 }, { duration: 300,
      easing: 'easeOutCubic',
      queue: false });

    // Allows timer to be pause while being panned
    var timeLeft = displayLength;
    var counterInterval = setInterval (function () {


      if (newToast.parentNode === null)
        window.clearInterval(counterInterval);

      // If toast is not being dragged, decrease its time remaining
      if (!newToast.classList.contains('panning')) {
        timeLeft -= 20;
      }

      if (timeLeft <= 0) {
        // Animate toast out
        Vel(newToast, { 'opacity': 0, marginTop: '-40px' }, { duration: 375,
            easing: 'easeOutExpo',
            queue: false,
            complete() {
              // Call the optional callback
              if (typeof (completeCallback) === 'function')
                completeCallback();
              // Remove toast after it times out
              this[0].parentNode.removeChild(this[0]);
            },
          });
        window.clearInterval(counterInterval);
      }
    }, 20);


    function createToast(html) {

        // Create toast
        var toast = document.createElement('div');
        toast.classList.add('toast');
        if (className) {
            var classes = className.split(' ');

            for (var i = 0, count = classes.length; i < count; i++) {
                toast.classList.add(classes[i]);
            }
        }
        // If type of parameter is HTML Element
        if (typeof HTMLElement === 'object' ? html instanceof HTMLElement : html && typeof html === 'object' && html !== null && html.nodeType === 1 && typeof html.nodeName === 'string'
) {
          toast.appendChild(html);
        }
        else if (html instanceof jQuery) {
          // Check if it is jQuery object
          toast.appendChild(html[0]);
        }
        else {
          // Insert as text;
          toast.innerHTML = html;
        }
        // Bind hammer
        var hammerHandler = new Hammer(toast, { prevent_default: false });
        hammerHandler.on('pan', function (e) {
          var deltaX = e.deltaX;
          var activationDistance = 80;

          // Change toast state
          if (!toast.classList.contains('panning')) {
            toast.classList.add('panning');
          }

          var opacityPercent = 1 - Math.abs(deltaX / activationDistance);
          if (opacityPercent < 0)
            opacityPercent = 0;

          Vel(toast, { left: deltaX, opacity: opacityPercent }, { duration: 50, queue: false, easing: 'easeOutQuad' });

        });

        hammerHandler.on('panend', function (e) {
          var deltaX = e.deltaX;
          var activationDistance = 80;

          // If toast dragged past activation point
          if (Math.abs(deltaX) > activationDistance) {
            Vel(toast, { marginTop: '-40px' }, { duration: 375,
                easing: 'easeOutExpo',
                queue: false,
                complete() {
                  if (typeof (completeCallback) === 'function') {
                    completeCallback();
                  }
                  toast.parentNode.removeChild(toast);
                },
            });

          } else {
            toast.classList.remove('panning');
            // Put toast back into original position
            Vel(toast, { left: 0, opacity: 1 }, { duration: 300,
              easing: 'easeOutExpo',
              queue: false,
            });

          }
        });

        return toast;
    }
};
(function ($) {

  var methods = {
    init(options) {
      var defaults = {
        menuWidth: 240,
        edge: 'left',
        closeOnClick: false,
      };
      options = $.extend(defaults, options);

      $(this).each(function () {
        var $this = $(this);
        var menu_id = $('#' + $this.attr('data-activates'));

        // Set to width
        if (options.menuWidth != 240) {
          menu_id.css('width', options.menuWidth);
        }

        // Add Touch Area
        var dragTarget = $('<div class="drag-target"></div>');
        $('body').append(dragTarget);

        if (options.edge == 'left') {
          menu_id.css('left', -1 * (options.menuWidth + 10));
          dragTarget.css({ 'left': 0 }); // Add Touch Area
        }
        else {
          menu_id.addClass('right-aligned') // Change text-alignment to right
            .css('right', -1 * (options.menuWidth + 10))
            .css('left', '');
          dragTarget.css({ 'right': 0 }); // Add Touch Area
        }

        // If fixed sidenav, bring menu out
        if (menu_id.hasClass('fixed')) {
            if (window.innerWidth > 992) {
              menu_id.css('left', 0);
            }
          }

        // Window resize to reset on large screens fixed
        if (menu_id.hasClass('fixed')) {
          $(window).resize(function () {
            if (window.innerWidth > 992) {
              // Close menu if window is resized bigger than 992 and user has fixed sidenav
              if ($('#sidenav-overlay').css('opacity') !== 0 && menuOut) {
                removeMenu(true);
              }
              else {
                menu_id.removeAttr('style');
                menu_id.css('width', options.menuWidth);
              }
            }
            else if (menuOut === false) {
              if (options.edge === 'left')
                menu_id.css('left', -1 * (options.menuWidth + 10));
              else
                menu_id.css('right', -1 * (options.menuWidth + 10));
            }

          });
        }

        // if closeOnClick, then add close event for all a tags in side sideNav
        if (options.closeOnClick === true) {
          menu_id.on('click.itemclick', 'a:not(.collapsible-header)', function () {
            removeMenu();
          });
        }

        function removeMenu(restoreNav) {
          panning = false;
          menuOut = false;

          // Reenable scrolling
          $('body').css('overflow', '');

          $('#sidenav-overlay').velocity({ opacity: 0 }, { duration: 200, queue: false, easing: 'easeOutQuad',
            complete() {
              $(this).remove();
            } });
          if (options.edge === 'left') {
            // Reset phantom div
            dragTarget.css({ width: '', right: '', left: '0' });
            menu_id.velocity(
              { left: -1 * (options.menuWidth + 10) },
              { duration: 200,
                queue: false,
                easing: 'easeOutCubic',
                complete() {
                  if (restoreNav === true) {
                    // Restore Fixed sidenav
                    menu_id.removeAttr('style');
                    menu_id.css('width', options.menuWidth);
                  }
                },

            });
          }
          else {
            // Reset phantom div
            dragTarget.css({ width: '', right: '0', left: '' });
            menu_id.velocity(
              { right: -1 * (options.menuWidth + 10) },
              { duration: 200,
                queue: false,
                easing: 'easeOutCubic',
                complete() {
                  if (restoreNav === true) {
                    // Restore Fixed sidenav
                    menu_id.removeAttr('style');
                    menu_id.css('width', options.menuWidth);
                  }
                },
              });
          }
        }


        // Touch Event
        var panning = false;
        var menuOut = false;

        dragTarget.on('click', function () {
          removeMenu();
        });

        dragTarget.hammer({
          prevent_default: false,
        }).on('pan', function (e) {

          if (e.gesture.pointerType == 'touch') {

            var direction = e.gesture.direction;
            var x = e.gesture.center.x;
            var y = e.gesture.center.y;
            var velocityX = e.gesture.velocityX;

            // Disable Scrolling
            $('body').css('overflow', 'hidden');

            // If overlay does not exist, create one and if it is clicked, close menu
            if ($('#sidenav-overlay').length === 0) {
              var overlay = $('<div id="sidenav-overlay"></div>');
              overlay.css('opacity', 0).click(function () {
                removeMenu();
              });
              $('body').append(overlay);
            }

            // Keep within boundaries
            if (options.edge === 'left') {
              if (x > options.menuWidth) { x = options.menuWidth; }
              else if (x < 0) { x = 0; }
            }

            if (options.edge === 'left') {
              // Left Direction
              if (x < (options.menuWidth / 2)) { menuOut = false; }
              // Right Direction
              else if (x >= (options.menuWidth / 2)) { menuOut = true; }

              menu_id.css('left', (x - options.menuWidth));
            }
            else {
              // Left Direction
              if (x < (window.innerWidth - options.menuWidth / 2)) {
                menuOut = true;
              }
              // Right Direction
              else if (x >= (window.innerWidth - options.menuWidth / 2)) {
               menuOut = false;
             }
              var rightPos = -1 * (x - options.menuWidth / 2);
              if (rightPos > 0) {
                rightPos = 0;
              }

              menu_id.css('right', rightPos);
            }


            // Percentage overlay
            var overlayPerc;
            if (options.edge === 'left') {
              overlayPerc = x / options.menuWidth;
              $('#sidenav-overlay').velocity({ opacity: overlayPerc }, { duration: 50, queue: false, easing: 'easeOutQuad' });
            }
            else {
              overlayPerc = Math.abs((x - window.innerWidth) / options.menuWidth);
              $('#sidenav-overlay').velocity({ opacity: overlayPerc }, { duration: 50, queue: false, easing: 'easeOutQuad' });
            }
          }

        }).on('panend', function (e) {

          if (e.gesture.pointerType == 'touch') {
            var velocityX = e.gesture.velocityX;
            panning = false;
            if (options.edge === 'left') {
              // If velocityX <= 0.3 then the user is flinging the menu closed so ignore menuOut
              if ((menuOut && velocityX <= 0.3) || velocityX < -0.5) {
                menu_id.velocity({ left: 0 }, { duration: 300, queue: false, easing: 'easeOutQuad' });
                $('#sidenav-overlay').velocity({ opacity: 1 }, { duration: 50, queue: false, easing: 'easeOutQuad' });
                dragTarget.css({ width: '50%', right: 0, left: '' });
              }
              else if (!menuOut || velocityX > 0.3) {
                // Enable Scrolling
                $('body').css('overflow', '');
                // Slide menu closed
                menu_id.velocity({ left: -1 * (options.menuWidth + 10) }, { duration: 200, queue: false, easing: 'easeOutQuad' });
                $('#sidenav-overlay').velocity({ opacity: 0 }, { duration: 200, queue: false, easing: 'easeOutQuad',
                  complete() {
                    $(this).remove();
                  } });
                dragTarget.css({ width: '10px', right: '', left: 0 });
              }
            }
            else {
              if ((menuOut && velocityX >= -0.3) || velocityX > 0.5) {
                menu_id.velocity({ right: 0 }, { duration: 300, queue: false, easing: 'easeOutQuad' });
                $('#sidenav-overlay').velocity({ opacity: 1 }, { duration: 50, queue: false, easing: 'easeOutQuad' });
                dragTarget.css({ width: '50%', right: '', left: 0 });
              }
              else if (!menuOut || velocityX < -0.3) {
                // Enable Scrolling
                $('body').css('overflow', '');
                // Slide menu closed
                menu_id.velocity({ right: -1 * (options.menuWidth + 10) }, { duration: 200, queue: false, easing: 'easeOutQuad' });
                $('#sidenav-overlay').velocity({ opacity: 0 }, { duration: 200, queue: false, easing: 'easeOutQuad',
                  complete() {
                    $(this).remove();
                  } });
                dragTarget.css({ width: '10px', right: 0, left: '' });
              }
            }

          }
        });

          $this.click(function () {
            if (menuOut === true) {
              menuOut = false;
              panning = false;
              removeMenu();
            }
            else {

              // Disable Scrolling
              $('body').css('overflow', 'hidden');
              // Push current drag target on top of DOM tree
              $('body').append(dragTarget);

              if (options.edge === 'left') {
                dragTarget.css({ width: '50%', right: 0, left: '' });
                menu_id.velocity({ left: 0 }, { duration: 300, queue: false, easing: 'easeOutQuad' });
              }
              else {
                dragTarget.css({ width: '50%', right: '', left: 0 });
                menu_id.velocity({ right: 0 }, { duration: 300, queue: false, easing: 'easeOutQuad' });
                menu_id.css('left', '');
              }

              var overlay = $('<div id="sidenav-overlay"></div>');
              overlay.css('opacity', 0)
              .click(function () {
                menuOut = false;
                panning = false;
                removeMenu();
                overlay.velocity({ opacity: 0 }, { duration: 300, queue: false, easing: 'easeOutQuad',
                  complete() {
                    $(this).remove();
                  } });

              });
              $('body').append(overlay);
              overlay.velocity({ opacity: 1 }, { duration: 300, queue: false, easing: 'easeOutQuad',
                complete() {
                  menuOut = true;
                  panning = false;
                },
              });
            }

            return false;
          });
      });


    },
    show() {
      this.trigger('click');
    },
    hide() {
      $('#sidenav-overlay').trigger('click');
    },
  };


    $.fn.sideNav = function (methodOrOptions) {
      if (methods[methodOrOptions]) {
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init"
        return methods.init.apply(this, arguments);
      } else {
        $.error('Method ' +  methodOrOptions + ' does not exist on jQuery.sideNav');
      }
    }; // Plugin end
}(jQuery));
/**
 * Extend jquery with a scrollspy plugin.
 * This watches the window scroll and fires events when elements are scrolled into viewport.
 *
 * throttle() and getTime() taken from Underscore.js
 * https://github.com/jashkenas/underscore
 *
 * @author Copyright 2013 John Smart
 * @license https://raw.github.com/thesmart/jquery-scrollspy/master/LICENSE
 * @see https://github.com/thesmart
 * @version 0.1.2
 */
(function ($) {

  var jWindow = $(window);
  var elements = [];
  var elementsInView = [];
  var isSpying = false;
  var ticks = 0;
  var unique_id = 1;
  var offset = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  /**
   * Find elements that are within the boundary
   * @param {number} top
   * @param {number} right
   * @param {number} bottom
   * @param {number} left
   * @return {jQuery}   A collection of elements
   */
  function findElements(top, right, bottom, left) {
    var hits = $();
    $.each(elements, function (i, element) {
      if (element.height() > 0) {
        var elTop = element.offset().top,
          elLeft = element.offset().left,
          elRight = elLeft + element.width(),
          elBottom = elTop + element.height();

        var isIntersect = !(elLeft > right ||
          elRight < left ||
          elTop > bottom ||
          elBottom < top);

        if (isIntersect) {
          hits.push(element);
        }
      }
    });

    return hits;
  }


  /**
   * Called when the user scrolls the window
   */
  function onScroll() {
    // unique tick id
    ++ticks;

    // viewport rectangle
    var top = jWindow.scrollTop(),
      left = jWindow.scrollLeft(),
      right = left + jWindow.width(),
      bottom = top + jWindow.height();

    // determine which elements are in view
//        + 60 accounts for fixed nav
    var intersections = findElements(top + offset.top + 200, right + offset.right, bottom + offset.bottom, left + offset.left);
    $.each(intersections, function (i, element) {

      var lastTick = element.data('scrollSpy:ticks');
      if (typeof lastTick != 'number') {
        // entered into view
        element.triggerHandler('scrollSpy:enter');
      }

      // update tick id
      element.data('scrollSpy:ticks', ticks);
    });

    // determine which elements are no longer in view
    $.each(elementsInView, function (i, element) {
      var lastTick = element.data('scrollSpy:ticks');
      if (typeof lastTick == 'number' && lastTick !== ticks) {
        // exited from view
        element.triggerHandler('scrollSpy:exit');
        element.data('scrollSpy:ticks', null);
      }
    });

    // remember elements in view for next tick
    elementsInView = intersections;
  }

  /**
   * Called when window is resized
  */
  function onWinSize() {
    jWindow.trigger('scrollSpy:winSize');
  }

  /**
   * Get time in ms
   * @license https://raw.github.com/jashkenas/underscore/master/LICENSE
   * @type {function}
   * @return {number}
   */
  var getTime = (Date.now || function () {
    return new Date().getTime();
  });

  /**
   * Returns a function, that, when invoked, will only be triggered at most once
   * during a given window of time. Normally, the throttled function will run
   * as much as it can, without ever going more than once per `wait` duration;
   * but if you'd like to disable the execution on the leading edge, pass
   * `{leading: false}`. To disable execution on the trailing edge, ditto.
   * @license https://raw.github.com/jashkenas/underscore/master/LICENSE
   * @param {function} func
   * @param {number} wait
   * @param {Object=} options
   * @returns {Function}
   */
  function throttle(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function () {
      previous = options.leading === false ? 0 : getTime();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function () {
      var now = getTime();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  }

  /**
   * Enables ScrollSpy using a selector
   * @param {jQuery|string} selector  The elements collection, or a selector
   * @param {Object=} options Optional.
        throttle : number -> scrollspy throttling. Default: 100 ms
        offsetTop : number -> offset from top. Default: 0
        offsetRight : number -> offset from right. Default: 0
        offsetBottom : number -> offset from bottom. Default: 0
        offsetLeft : number -> offset from left. Default: 0
   * @returns {jQuery}
   */
  $.scrollSpy = function (selector, options) {
    var visible = [];
    selector = $(selector);
    selector.each(function (i, element) {
      elements.push($(element));
      $(element).data('scrollSpy:id', i);
      // Smooth scroll to section
      $('a[href=#' + $(element).attr('id') + ']').click(function (e) {
        e.preventDefault();
        var offset = $(this.hash).offset().top + 1;

//          offset - 200 allows elements near bottom of page to scroll

        $('html, body').animate({ scrollTop: offset - 200 }, { duration: 400, queue: false, easing: 'easeOutCubic' });

      });
    });
    options = options || {
      throttle: 100,
    };

    offset.top = options.offsetTop || 0;
    offset.right = options.offsetRight || 0;
    offset.bottom = options.offsetBottom || 0;
    offset.left = options.offsetLeft || 0;

    var throttledScroll = throttle(onScroll, options.throttle || 100);
    var readyScroll = function () {
      $(document).ready(throttledScroll);
    };

    if (!isSpying) {
      jWindow.on('scroll', readyScroll);
      jWindow.on('resize', readyScroll);
      isSpying = true;
    }

    // perform a scan once, after current execution context, and after dom is ready
    setTimeout(readyScroll, 0);


    selector.on('scrollSpy:enter', function () {
      visible = $.grep(visible, function (value) {
        return value.height() != 0;
      });

      var $this = $(this);

      if (visible[0]) {
        $('a[href=#' + visible[0].attr('id') + ']').removeClass('active');
        if ($this.data('scrollSpy:id') < visible[0].data('scrollSpy:id')) {
          visible.unshift($(this));
        }
        else {
          visible.push($(this));
        }
      }
      else {
        visible.push($(this));
      }


      $('a[href=#' + visible[0].attr('id') + ']').addClass('active');
    });
    selector.on('scrollSpy:exit', function () {
      visible = $.grep(visible, function (value) {
        return value.height() != 0;
      });

      if (visible[0]) {
        $('a[href=#' + visible[0].attr('id') + ']').removeClass('active');
        var $this = $(this);
        visible = $.grep(visible, function (value) {
          return value.attr('id') != $this.attr('id');
        });
        if (visible[0]) { // Check if empty
          $('a[href=#' + visible[0].attr('id') + ']').addClass('active');
        }
      }
    });

    return selector;
  };

  /**
   * Listen for window resize events
   * @param {Object=} options           Optional. Set { throttle: number } to change throttling. Default: 100 ms
   * @returns {jQuery}    $(window)
   */
  $.winSizeSpy = function (options) {
    $.winSizeSpy = function () { return jWindow; }; // lock from multiple calls
    options = options || {
      throttle: 100,
    };
    return jWindow.on('resize', throttle(onWinSize, options.throttle || 100));
  };

  /**
   * Enables ScrollSpy on a collection of elements
   * e.g. $('.scrollSpy').scrollSpy()
   * @param {Object=} options Optional.
                      throttle : number -> scrollspy throttling. Default: 100 ms
                      offsetTop : number -> offset from top. Default: 0
                      offsetRight : number -> offset from right. Default: 0
                      offsetBottom : number -> offset from bottom. Default: 0
                      offsetLeft : number -> offset from left. Default: 0
   * @returns {jQuery}
   */
  $.fn.scrollSpy = function (options) {
    return $.scrollSpy($(this), options);
  };

})(jQuery); (function ($) {
  $(document).ready(function () {

    // Function to update labels of text fields
    Materialize.updateTextFields = function () {
      var input_selector = 'input[type=text], input[type=password], input[type=email], input[type=url], input[type=tel], input[type=number], input[type=search], textarea';
      $(input_selector).each(function (index, element) {
        if ($(element).val().length > 0 || element.autofocus || $(this).attr('placeholder') !== undefined || $(element)[0].validity.badInput === true) {
          $(this).siblings('label, i').addClass('active');
        }
        else {
          $(this).siblings('label, i').removeClass('active');
        }
      });
    };

    // Text based inputs
    var input_selector = 'input[type=text], input[type=password], input[type=email], input[type=url], input[type=tel], input[type=number], input[type=search], textarea';

    // Add active if form auto complete
    $(document).on('change', input_selector, function () {
      if ($(this).val().length !== 0 || $(this).attr('placeholder') !== undefined) {
        $(this).siblings('label').addClass('active');
      }
      validate_field($(this));
    });

    // Add active if input element has been pre-populated on document ready
    $(document).ready(function () {
      Materialize.updateTextFields();
    });

    // HTML DOM FORM RESET handling
    $(document).on('reset', function (e) {
      var formReset = $(e.target);
      if (formReset.is('form')) {
        formReset.find(input_selector).removeClass('valid').removeClass('invalid');
        formReset.find(input_selector).each(function () {
          if ($(this).attr('value') === '') {
            $(this).siblings('label, i').removeClass('active');
          }
        });

        // Reset select
        formReset.find('select.initialized').each(function () {
          var reset_text = formReset.find('option[selected]').text();
          formReset.siblings('input.select-dropdown').val(reset_text);
        });
      }
    });

    // Add active when element has focus
    $(document).on('focus', input_selector, function () {
      $(this).siblings('label, i').addClass('active');
    });

    $(document).on('blur', input_selector, function () {
      var $inputElement = $(this);
      if ($inputElement.val().length === 0 && $inputElement[0].validity.badInput !== true && $inputElement.attr('placeholder') === undefined) {
        $inputElement.siblings('label, i').removeClass('active');
      }

      if ($inputElement.val().length === 0 && $inputElement[0].validity.badInput !== true && $inputElement.attr('placeholder') !== undefined) {
        $inputElement.siblings('i').removeClass('active');
      }
      validate_field($inputElement);
    });

    window.validate_field = function (object) {
      var hasLength = object.attr('length') !== undefined;
      var lenAttr = parseInt(object.attr('length'));
      var len = object.val().length;

      if (object.val().length === 0 && object[0].validity.badInput === false) {
        if (object.hasClass('validate')) {
          object.removeClass('valid');
          object.removeClass('invalid');
        }
      }
      else {
        if (object.hasClass('validate')) {
          // Check for character counter attributes
          if ((object.is(':valid') && hasLength && (len <= lenAttr)) || (object.is(':valid') && !hasLength)) {
            object.removeClass('invalid');
            object.addClass('valid');
          }
          else {
            object.removeClass('valid');
            object.addClass('invalid');
          }
        }
      }
    };


    // Textarea Auto Resize
    var hiddenDiv = $('.hiddendiv').first();
    if (!hiddenDiv.length) {
      hiddenDiv = $('<div class="hiddendiv common"></div>');
      $('body').append(hiddenDiv);
    }
    var text_area_selector = '.materialize-textarea';

    function textareaAutoResize($textarea) {
      // Set font properties of hiddenDiv

      var fontFamily = $textarea.css('font-family');
      var fontSize = $textarea.css('font-size');

      if (fontSize) { hiddenDiv.css('font-size', fontSize); }
      if (fontFamily) { hiddenDiv.css('font-family', fontFamily); }

      if ($textarea.attr('wrap') === 'off') {
        hiddenDiv.css('overflow-wrap', 'normal')
                 .css('white-space', 'pre');
      }

      hiddenDiv.text($textarea.val() + '\n');
      var content = hiddenDiv.html().replace(/\n/g, '<br>');
      hiddenDiv.html(content);


      // When textarea is hidden, width goes crazy.
      // Approximate with half of window size

      if ($textarea.is(':visible')) {
        hiddenDiv.css('width', $textarea.width());
      }
      else {
        hiddenDiv.css('width', $(window).width() / 2);
      }

      $textarea.css('height', hiddenDiv.height());
    }

    $(text_area_selector).each(function () {
      var $textarea = $(this);
      if ($textarea.val().length) {
        textareaAutoResize($textarea);
      }
    });

    $('body').on('keyup keydown autoresize', text_area_selector, function () {
      textareaAutoResize($(this));
    });

    // File Input Path
    $(document).on('change', '.file-field input[type="file"]', function () {
      var file_field = $(this).closest('.file-field');
      var path_input = file_field.find('input.file-path');
      var files      = $(this)[0].files;
      var file_names = [];
      for (var i = 0; i < files.length; i++) {
        file_names.push(files[i].name);
      }
      path_input.val(file_names.join(', '));
      path_input.trigger('change');
    });

    /** **************
    *  Range Input  *
    ****************/

    var range_type = 'input[type=range]';
    var range_mousedown = false;
    var left;

    $(range_type).each(function () {
      var thumb = $('<span class="thumb"><span class="value"></span></span>');
      $(this).after(thumb);
    });

    var range_wrapper = '.range-field';
    $(document).on('change', range_type, function (e) {
      var thumb = $(this).siblings('.thumb');
      thumb.find('.value').html($(this).val());
    });

    $(document).on('input mousedown touchstart', range_type, function (e) {
      var thumb = $(this).siblings('.thumb');
      var width = $(this).outerWidth();

      // If thumb indicator does not exist yet, create it
      if (thumb.length <= 0) {
        thumb = $('<span class="thumb"><span class="value"></span></span>');
        $(this).after(thumb);
      }

      // Set indicator value
      thumb.find('.value').html($(this).val());

      range_mousedown = true;
      $(this).addClass('active');

      if (!thumb.hasClass('active')) {
        thumb.velocity({ height: '30px', width: '30px', top: '-20px', marginLeft: '-15px' }, { duration: 300, easing: 'easeOutExpo' });
      }

      if (e.type !== 'input') {
        if (e.pageX === undefined || e.pageX === null) { // mobile
           left = e.originalEvent.touches[0].pageX - $(this).offset().left;
        }
        else { // desktop
           left = e.pageX - $(this).offset().left;
        }
        if (left < 0) {
          left = 0;
        }
        else if (left > width) {
          left = width;
        }
        thumb.addClass('active').css('left', left);
      }

      thumb.find('.value').html($(this).val());
    });

    $(document).on('mouseup touchend', range_wrapper, function () {
      range_mousedown = false;
      $(this).removeClass('active');
    });

    $(document).on('mousemove touchmove', range_wrapper, function (e) {
      var thumb = $(this).children('.thumb');
      var left;
      if (range_mousedown) {
        if (!thumb.hasClass('active')) {
          thumb.velocity({ height: '30px', width: '30px', top: '-20px', marginLeft: '-15px' }, { duration: 300, easing: 'easeOutExpo' });
        }
        if (e.pageX === undefined || e.pageX === null) { // mobile
          left = e.originalEvent.touches[0].pageX - $(this).offset().left;
        }
        else { // desktop
          left = e.pageX - $(this).offset().left;
        }
        var width = $(this).outerWidth();

        if (left < 0) {
          left = 0;
        }
        else if (left > width) {
          left = width;
        }
        thumb.addClass('active').css('left', left);
        thumb.find('.value').html(thumb.siblings(range_type).val());
      }
    });

    $(document).on('mouseout touchleave', range_wrapper, function () {
      if (!range_mousedown) {

        var thumb = $(this).children('.thumb');

        if (thumb.hasClass('active')) {
          thumb.velocity({ height: '0', width: '0', top: '10px', marginLeft: '-6px' }, { duration: 100 });
        }
        thumb.removeClass('active');
      }
    });
  }); // End of $(document).ready

  /** *****************
   *  Select Plugin  *
   ******************/
  $.fn.material_select = function (callback) {
    $(this).each(function () {
      var $select = $(this);

      if ($select.hasClass('browser-default')) {
        return; // Continue to next (return false breaks out of entire loop)
      }

      var multiple = $select.attr('multiple') ? true : false,
          lastID = $select.data('select-id'); // Tear down structure if Select needs to be rebuilt

      if (lastID) {
        $select.parent().find('span.caret').remove();
        $select.parent().find('input').remove();

        $select.unwrap();
        $('ul#select-options-' + lastID).remove();
      }

      // If destroying the select, remove the selelct-id and reset it to it's uninitialized state.
      if (callback === 'destroy') {
        $select.data('select-id', null).removeClass('initialized');
        return;
      }

      var uniqueID = Materialize.guid();
      $select.data('select-id', uniqueID);
      var wrapper = $('<div class="select-wrapper"></div>');
      wrapper.addClass($select.attr('class'));
      var options = $('<ul id="select-options-' + uniqueID + '" class="dropdown-content select-dropdown ' + (multiple ? 'multiple-select-dropdown' : '') + '"></ul>'),
          selectChildren = $select.children('option, optgroup'),
          valuesSelected = [],
          optionsHover = false;

      var label = $select.find('option:selected').html() || $select.find('option:first').html() || '';

      // Function that renders and appends the option taking into
      // account type and possible image icon.
      var appendOptionWithIcon = function (select, option, type) {
        // Add disabled attr if disabled
        var disabledClass = (option.is(':disabled')) ? 'disabled ' : '';

        // add icons
        var icon_url = option.data('icon');
        var classes = option.attr('class');
        if (!!icon_url) {
          var classString = '';
          if (!!classes) classString = ' class="' + classes + '"';

          // Check for multiple type.
          if (type === 'multiple') {
            options.append($('<li class="' + disabledClass + '"><img src="' + icon_url + '"' + classString + '><span><input type="checkbox"' + disabledClass + '/><label></label>' + option.html() + '</span></li>'));
          } else {
            options.append($('<li class="' + disabledClass + '"><img src="' + icon_url + '"' + classString + '><span>' + option.html() + '</span></li>'));
          }
          return true;
        }

        // Check for multiple type.
        if (type === 'multiple') {
          options.append($('<li class="' + disabledClass + '"><span><input type="checkbox"' + disabledClass + '/><label></label>' + option.html() + '</span></li>'));
        } else {
          options.append($('<li class="' + disabledClass + '"><span>' + option.html() + '</span></li>'));
        }
      };

      /* Create dropdown structure. */
      if (selectChildren.length) {
        selectChildren.each(function () {
          if ($(this).is('option')) {
            // Direct descendant option.
            if (multiple) {
              appendOptionWithIcon($select, $(this), 'multiple');

            } else {
              appendOptionWithIcon($select, $(this));
            }
          } else if ($(this).is('optgroup')) {
            // Optgroup.
            var selectOptions = $(this).children('option');
            options.append($('<li class="optgroup"><span>' + $(this).attr('label') + '</span></li>'));

            selectOptions.each(function () {
              appendOptionWithIcon($select, $(this));
            });
          }
        });
      }

      options.find('li:not(.optgroup)').each(function (i) {
        $(this).click(function (e) {
          // Check if option element is disabled
          if (!$(this).hasClass('disabled') && !$(this).hasClass('optgroup')) {
            var selected = true;

            if (multiple) {
              $('input[type="checkbox"]', this).prop('checked', function (i, v) { return !v; });
              selected = toggleEntryFromArray(valuesSelected, $(this).index(), $select);
              $newSelect.trigger('focus');
            } else {
              options.find('li').removeClass('active');
              $(this).toggleClass('active');
              $newSelect.val($(this).text());
            }

            activateOption(options, $(this));
            $select.find('option').eq(i).prop('selected', selected);
            // Trigger onchange() event
            $select.trigger('change');
            if (typeof callback !== 'undefined') callback();
          }

          e.stopPropagation();
        });
      });

      // Wrap Elements
      $select.wrap(wrapper);
      // Add Select Display Element
      var dropdownIcon = $('<span class="caret">&#9660;</span>');
      if ($select.is(':disabled'))
        dropdownIcon.addClass('disabled');

      // escape double quotes
      var sanitizedLabelHtml = label.replace(/"/g, '&quot;');

      var $newSelect = $('<input type="text" class="select-dropdown" readonly="true" ' + (($select.is(':disabled')) ? 'disabled' : '') + ' data-activates="select-options-' + uniqueID + '" value="' + sanitizedLabelHtml + '"/>');
      $select.before($newSelect);
      $newSelect.before(dropdownIcon);

      $newSelect.after(options);
      // Check if section element is disabled
      if (!$select.is(':disabled')) {
        $newSelect.dropdown({ 'hover': false, 'closeOnClick': false });
      }

      // Copy tabindex
      if ($select.attr('tabindex')) {
        $($newSelect[0]).attr('tabindex', $select.attr('tabindex'));
      }

      $select.addClass('initialized');

      $newSelect.on({
        'focus'() {
          if ($('ul.select-dropdown').not(options[0]).is(':visible')) {
            $('input.select-dropdown').trigger('close');
          }
          if (!options.is(':visible')) {
            $(this).trigger('open', ['focus']);
            var label = $(this).val();
            var selectedOption = options.find('li').filter(function () {
              return $(this).text().toLowerCase() === label.toLowerCase();
            })[0];
            activateOption(options, selectedOption);
          }
        },
        'click'(e) {
          e.stopPropagation();
        },
      });

      $newSelect.on('blur', function () {
        if (!multiple) {
          $(this).trigger('close');
        }
        options.find('li.selected').removeClass('selected');
      });

      options.hover(function () {
        optionsHover = true;
      }, function () {
        optionsHover = false;
      });

      $(window).on({
        'click'() {
          multiple && (optionsHover || $newSelect.trigger('close'));
        },
      });

      // Add initial multiple selections.
      if (multiple) {
        $select.find('option:selected:not(:disabled)').each(function () {
          var index = $(this).index();

          toggleEntryFromArray(valuesSelected, index, $select);
          options.find('li').eq(index).find(':checkbox').prop('checked', true);
        });
      }

      // Make option as selected and scroll to selected position
      activateOption = function (collection, newOption) {
        if (newOption) {
          collection.find('li.selected').removeClass('selected');
          var option = $(newOption);
          option.addClass('selected');
          options.scrollTo(option);
        }
      };

      // Allow user to search by typing
      // this array is cleared after 1 second
      var filterQuery = [],
          onKeyDown = function (e) {
            // TAB - switch to another input
            if (e.which == 9) {
              $newSelect.trigger('close');
              return;
            }

            // ARROW DOWN WHEN SELECT IS CLOSED - open select options
            if (e.which == 40 && !options.is(':visible')) {
              $newSelect.trigger('open');
              return;
            }

            // ENTER WHEN SELECT IS CLOSED - submit form
            if (e.which == 13 && !options.is(':visible')) {
              return;
            }

            e.preventDefault();

            // CASE WHEN USER TYPE LETTERS
            var letter = String.fromCharCode(e.which).toLowerCase(),
                nonLetters = [9, 13, 27, 38, 40];
            if (letter && (nonLetters.indexOf(e.which) === -1)) {
              filterQuery.push(letter);

              var string = filterQuery.join(''),
                  newOption = options.find('li').filter(function () {
                    return $(this).text().toLowerCase().indexOf(string) === 0;
                  })[0];

              if (newOption) {
                activateOption(options, newOption);
              }
            }

            // ENTER - select option and close when select options are opened
            if (e.which == 13) {
              var activeOption = options.find('li.selected:not(.disabled)')[0];
              if (activeOption) {
                $(activeOption).trigger('click');
                if (!multiple) {
                  $newSelect.trigger('close');
                }
              }
            }

            // ARROW DOWN - move to next not disabled option
            if (e.which == 40) {
              if (options.find('li.selected').length) {
                newOption = options.find('li.selected').next('li:not(.disabled)')[0];
              } else {
                newOption = options.find('li:not(.disabled)')[0];
              }
              activateOption(options, newOption);
            }

            // ESC - close options
            if (e.which == 27) {
              $newSelect.trigger('close');
            }

            // ARROW UP - move to previous not disabled option
            if (e.which == 38) {
              newOption = options.find('li.selected').prev('li:not(.disabled)')[0];
              if (newOption)
                activateOption(options, newOption);
            }

            // Automaticaly clean filter query so user can search again by starting letters
            setTimeout(function () { filterQuery = []; }, 1000);
          };

      $newSelect.on('keydown', onKeyDown);
    });

    function toggleEntryFromArray(entriesArray, entryIndex, select) {
      var index = entriesArray.indexOf(entryIndex),
          notAdded = index === -1;

      if (notAdded) {
        entriesArray.push(entryIndex);
      } else {
        entriesArray.splice(index, 1);
      }

      select.siblings('ul.dropdown-content').find('li').eq(entryIndex).toggleClass('active');

      // use notAdded instead of true (to detect if the option is selected or not)
      select.find('option').eq(entryIndex).prop('selected', notAdded);
      setValueToInput(entriesArray, select);

      return notAdded;
    }

    function setValueToInput(entriesArray, select) {
      var value = '';

      for (var i = 0, count = entriesArray.length; i < count; i++) {
        var text = select.find('option').eq(entriesArray[i]).text();

        i === 0 ? value += text : value += ', ' + text;
      }

      if (value === '') {
        value = select.find('option:disabled').eq(0).text();
      }

      select.siblings('input.select-dropdown').val(value);
    }
  };

}(jQuery));
(function ($) {

  var methods = {

    init(options) {
      var defaults = {
        indicators: true,
        height: 400,
        transition: 500,
        interval: 6000,
      };
      options = $.extend(defaults, options);

      return this.each(function () {

        // For each slider, we want to keep track of
        // which slide is active and its associated content
        var $this = $(this);
        var $slider = $this.find('ul.slides').first();
        var $slides = $slider.find('li');
        var $active_index = $slider.find('.active').index();
        var $active, $indicators, $interval;
        if ($active_index != -1) { $active = $slides.eq($active_index); }

        // Transitions the caption depending on alignment
        function captionTransition(caption, duration) {
          if (caption.hasClass('center-align')) {
            caption.velocity({ opacity: 0, translateY: -100 }, { duration, queue: false });
          }
          else if (caption.hasClass('right-align')) {
            caption.velocity({ opacity: 0, translateX: 100 }, { duration, queue: false });
          }
          else if (caption.hasClass('left-align')) {
            caption.velocity({ opacity: 0, translateX: -100 }, { duration, queue: false });
          }
        }

        // This function will transition the slide to any index of the next slide
        function moveToSlide(index) {
          // Wrap around indices.
          if (index >= $slides.length) index = 0;
          else if (index < 0) index = $slides.length - 1;

          $active_index = $slider.find('.active').index();

          // Only do if index changes
          if ($active_index != index) {
            $active = $slides.eq($active_index);
            $caption = $active.find('.caption');

            $active.removeClass('active');
            $active.velocity({ opacity: 0 }, { duration: options.transition, queue: false, easing: 'easeOutQuad',
                              complete() {
                                $slides.not('.active').velocity({ opacity: 0, translateX: 0, translateY: 0 }, { duration: 0, queue: false });
                              } });
            captionTransition($caption, options.transition);


            // Update indicators
            if (options.indicators) {
              $indicators.eq($active_index).removeClass('active');
            }

            $slides.eq(index).velocity({ opacity: 1 }, { duration: options.transition, queue: false, easing: 'easeOutQuad' });
            $slides.eq(index).find('.caption').velocity({ opacity: 1, translateX: 0, translateY: 0 }, { duration: options.transition, delay: options.transition, queue: false, easing: 'easeOutQuad' });
            $slides.eq(index).addClass('active');


            // Update indicators
            if (options.indicators) {
              $indicators.eq(index).addClass('active');
            }
          }
        }

        // Set height of slider
        // If fullscreen, do nothing
        if (!$this.hasClass('fullscreen')) {
          if (options.indicators) {
            // Add height if indicators are present
            $this.height(options.height + 40);
          }
          else {
            $this.height(options.height);
          }
          $slider.height(options.height);
        }


        // Set initial positions of captions
        $slides.find('.caption').each(function () {
          captionTransition($(this), 0);
        });

        // Move img src into background-image
        $slides.find('img').each(function () {
          var placeholderBase64 = 'data:image/gif;base64,R0lGODlhAQABAIABAP///wAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
          if ($(this).attr('src') !== placeholderBase64) {
            $(this).css('background-image', 'url(' + $(this).attr('src') + ')');
            $(this).attr('src', placeholderBase64);
          }
        });

        // dynamically add indicators
        if (options.indicators) {
          $indicators = $('<ul class="indicators"></ul>');
          $slides.each(function (index) {
            var $indicator = $('<li class="indicator-item"></li>');

            // Handle clicks on indicators
            $indicator.click(function () {
              var $parent = $slider.parent();
              var curr_index = $parent.find($(this)).index();
              moveToSlide(curr_index);

              // reset interval
              clearInterval($interval);
              $interval = setInterval(
                function () {
                  $active_index = $slider.find('.active').index();
                  if ($slides.length == $active_index + 1) $active_index = 0; // loop to start
                  else $active_index += 1;

                  moveToSlide($active_index);

                }, options.transition + options.interval
              );
            });
            $indicators.append($indicator);
          });
          $this.append($indicators);
          $indicators = $this.find('ul.indicators').find('li.indicator-item');
        }

        if ($active) {
          $active.show();
        }
        else {
          $slides.first().addClass('active').velocity({ opacity: 1 }, { duration: options.transition, queue: false, easing: 'easeOutQuad' });

          $active_index = 0;
          $active = $slides.eq($active_index);

          // Update indicators
          if (options.indicators) {
            $indicators.eq($active_index).addClass('active');
          }
        }

        // Adjust height to current slide
        $active.find('img').each(function () {
          $active.find('.caption').velocity({ opacity: 1, translateX: 0, translateY: 0 }, { duration: options.transition, queue: false, easing: 'easeOutQuad' });
        });

        // auto scroll
        $interval = setInterval(
          function () {
            $active_index = $slider.find('.active').index();
            moveToSlide($active_index + 1);

          }, options.transition + options.interval
        );


        // HammerJS, Swipe navigation

        // Touch Event
        var panning = false;
        var swipeLeft = false;
        var swipeRight = false;

        $this.hammer({
            prevent_default: false,
        }).on('pan', function (e) {
          if (e.gesture.pointerType === 'touch') {

            // reset interval
            clearInterval($interval);

            var direction = e.gesture.direction;
            var x = e.gesture.deltaX;
            var velocityX = e.gesture.velocityX;

            $curr_slide = $slider.find('.active');
            $curr_slide.velocity({ translateX: x,
                }, { duration: 50, queue: false, easing: 'easeOutQuad' });

            // Swipe Left
            if (direction === 4 && (x > ($this.innerWidth() / 2) || velocityX < -0.65)) {
              swipeRight = true;
            }
            // Swipe Right
            else if (direction === 2 && (x < (-1 * $this.innerWidth() / 2) || velocityX > 0.65)) {
              swipeLeft = true;
            }

            // Make Slide Behind active slide visible
            var next_slide;
            if (swipeLeft) {
              next_slide = $curr_slide.next();
              if (next_slide.length === 0) {
                next_slide = $slides.first();
              }
              next_slide.velocity({ opacity: 1,
                  }, { duration: 300, queue: false, easing: 'easeOutQuad' });
            }
            if (swipeRight) {
              next_slide = $curr_slide.prev();
              if (next_slide.length === 0) {
                next_slide = $slides.last();
              }
              next_slide.velocity({ opacity: 1,
                  }, { duration: 300, queue: false, easing: 'easeOutQuad' });
            }


          }

        }).on('panend', function (e) {
          if (e.gesture.pointerType === 'touch') {

            $curr_slide = $slider.find('.active');
            panning = false;
            curr_index = $slider.find('.active').index();

            if (!swipeRight && !swipeLeft) {
              // Return to original spot
              $curr_slide.velocity({ translateX: 0,
                  }, { duration: 300, queue: false, easing: 'easeOutQuad' });
            }
            else if (swipeLeft) {
              moveToSlide(curr_index + 1);
              $curr_slide.velocity({ translateX: -1 * $this.innerWidth() }, { duration: 300, queue: false, easing: 'easeOutQuad',
                                    complete() {
                                      $curr_slide.velocity({ opacity: 0, translateX: 0 }, { duration: 0, queue: false });
                                    } });
            }
            else if (swipeRight) {
              moveToSlide(curr_index - 1);
              $curr_slide.velocity({ translateX: $this.innerWidth() }, { duration: 300, queue: false, easing: 'easeOutQuad',
                                    complete() {
                                      $curr_slide.velocity({ opacity: 0, translateX: 0 }, { duration: 0, queue: false });
                                    } });
            }
            swipeLeft = false;
            swipeRight = false;

            // Restart interval
            clearInterval($interval);
            $interval = setInterval(
              function () {
                $active_index = $slider.find('.active').index();
                if ($slides.length == $active_index + 1) $active_index = 0; // loop to start
                else $active_index += 1;

                moveToSlide($active_index);

              }, options.transition + options.interval
            );
          }
        });

        $this.on('sliderPause', function () {
          clearInterval($interval);
        });

        $this.on('sliderStart', function () {
          clearInterval($interval);
          $interval = setInterval(
            function () {
              $active_index = $slider.find('.active').index();
              if ($slides.length == $active_index + 1) $active_index = 0; // loop to start
              else $active_index += 1;

              moveToSlide($active_index);

            }, options.transition + options.interval
          );
        });

        $this.on('sliderNext', function () {
          $active_index = $slider.find('.active').index();
          moveToSlide($active_index + 1);
        });

        $this.on('sliderPrev', function () {
          $active_index = $slider.find('.active').index();
          moveToSlide($active_index - 1);
        });

      });


    },
    pause() {
      $(this).trigger('sliderPause');
    },
    start() {
      $(this).trigger('sliderStart');
    },
    next() {
      $(this).trigger('sliderNext');
    },
    prev() {
      $(this).trigger('sliderPrev');
    },
  };


    $.fn.slider = function (methodOrOptions) {
      if (methods[methodOrOptions]) {
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init"
        return methods.init.apply(this, arguments);
      } else {
        $.error('Method ' +  methodOrOptions + ' does not exist on jQuery.tooltip');
      }
    }; // Plugin end
}(jQuery)); (function ($) {
  $(document).ready(function () {

    $(document).on('click.card', '.card', function (e) {
      if ($(this).find('> .card-reveal').length) {
        if ($(e.target).is($('.card-reveal .card-title')) || $(e.target).is($('.card-reveal .card-title i'))) {
          // Make Reveal animate down and display none
          $(this).find('.card-reveal').velocity(
            { translateY: 0 }, {
              duration: 225,
              queue: false,
              easing: 'easeInOutQuad',
              complete() { $(this).css({ display: 'none' }); },
            }
          );
        }
        else if ($(e.target).is($('.card .activator')) ||
                 $(e.target).is($('.card .activator i'))) {
          $(e.target).closest('.card').css('overflow', 'hidden');
          $(this).find('.card-reveal').css({ display: 'block' }).velocity('stop', false).velocity({ translateY: '-100%' }, { duration: 300, queue: false, easing: 'easeInOutQuad' });
        }
      }

      $('.card-reveal').closest('.card').css('overflow', 'hidden');

    });

  });
}(jQuery)); (function ($) {
  $(document).ready(function () {

    $(document).on('click.chip', '.chip .material-icons', function (e) {
      $(this).parent().remove();
    });

  });
}(jQuery)); (function ($) {
  $(document).ready(function () {

    $.fn.pushpin = function (options) {

      var defaults = {
        top: 0,
        bottom: Infinity,
        offset: 0,
      };
      options = $.extend(defaults, options);

      $index = 0;
      return this.each(function () {
        var $uniqueId = Materialize.guid(),
            $this = $(this),
            $original_offset = $(this).offset().top;

        function removePinClasses(object) {
          object.removeClass('pin-top');
          object.removeClass('pinned');
          object.removeClass('pin-bottom');
        }

        function updateElements(objects, scrolled) {
          objects.each(function () {
            // Add position fixed (because its between top and bottom)
            if (options.top <= scrolled && options.bottom >= scrolled && !$(this).hasClass('pinned')) {
              removePinClasses($(this));
              $(this).css('top', options.offset);
              $(this).addClass('pinned');
            }

            // Add pin-top (when scrolled position is above top)
            if (scrolled < options.top && !$(this).hasClass('pin-top')) {
              removePinClasses($(this));
              $(this).css('top', 0);
              $(this).addClass('pin-top');
            }

            // Add pin-bottom (when scrolled position is below bottom)
            if (scrolled > options.bottom && !$(this).hasClass('pin-bottom')) {
              removePinClasses($(this));
              $(this).addClass('pin-bottom');
              $(this).css('top', options.bottom - $original_offset);
            }
          });
        }

        updateElements($this, $(window).scrollTop());
        $(window).on('scroll.' + $uniqueId, function () {
          var $scrolled = $(window).scrollTop() + options.offset;
          updateElements($this, $scrolled);
        });

      });

    };


  });
}(jQuery)); (function ($) {
  $(document).ready(function () {

    // jQuery reverse
    $.fn.reverse = [].reverse;

    // Hover behaviour: make sure this doesn't work on .click-to-toggle FABs!
    $(document).on('mouseenter.fixedActionBtn', '.fixed-action-btn:not(.click-to-toggle)', function (e) {
      var $this = $(this);
      openFABMenu($this);
    });
    $(document).on('mouseleave.fixedActionBtn', '.fixed-action-btn:not(.click-to-toggle)', function (e) {
      var $this = $(this);
      closeFABMenu($this);
    });

    // Toggle-on-click behaviour.
    $(document).on('click.fixedActionBtn', '.fixed-action-btn.click-to-toggle > a', function (e) {
      var $this = $(this);
      var $menu = $this.parent();
      if ($menu.hasClass('active')) {
        closeFABMenu($menu);
      } else {
        openFABMenu($menu);
      }
    });

  });

  $.fn.extend({
    openFAB() {
      openFABMenu($(this));
    },
    closeFAB() {
      closeFABMenu($(this));
    },
  });


  var openFABMenu = function (btn) {
    $this = btn;
    if ($this.hasClass('active') === false) {

      // Get direction option
      var horizontal = $this.hasClass('horizontal');
      var offsetY, offsetX;

      if (horizontal === true) {
        offsetX = 40;
      } else {
        offsetY = 40;
      }

      $this.addClass('active');
      $this.find('ul .btn-floating').velocity(
        { scaleY: '.4', scaleX: '.4', translateY: offsetY + 'px', translateX: offsetX + 'px' },
        { duration: 0 });

      var time = 0;
      $this.find('ul .btn-floating').reverse().each(function () {
        $(this).velocity(
          { opacity: '1', scaleX: '1', scaleY: '1', translateY: '0', translateX: '0' },
          { duration: 80, delay: time });
        time += 40;
      });
    }
  };

  var closeFABMenu = function (btn) {
    $this = btn;
    // Get direction option
    var horizontal = $this.hasClass('horizontal');
    var offsetY, offsetX;

    if (horizontal === true) {
      offsetX = 40;
    } else {
      offsetY = 40;
    }

    $this.removeClass('active');
    var time = 0;
    $this.find('ul .btn-floating').velocity('stop', true);
    $this.find('ul .btn-floating').velocity(
      { opacity: '0', scaleX: '.4', scaleY: '.4', translateY: offsetY + 'px', translateX: offsetX + 'px' },
      { duration: 80 }
    );
  };


}(jQuery));
(function ($) {
  // Image transition function
  Materialize.fadeInImage =  function (selector) {
    var element = $(selector);
    element.css({ opacity: 0 });
    $(element).velocity({ opacity: 1 }, {
        duration: 650,
        queue: false,
        easing: 'easeOutSine',
      });
    $(element).velocity({ opacity: 1 }, {
          duration: 1300,
          queue: false,
          easing: 'swing',
          step(now, fx) {
              fx.start = 100;
              var grayscale_setting = now / 100;
              var brightness_setting = 150 - (100 - now) / 1.75;

              if (brightness_setting < 100) {
                brightness_setting = 100;
              }
              if (now >= 0) {
                $(this).css({
                    '-webkit-filter': 'grayscale(' + grayscale_setting + ')' + 'brightness(' + brightness_setting + '%)',
                    'filter': 'grayscale(' + grayscale_setting + ')' + 'brightness(' + brightness_setting + '%)',
                });
              }
          },
      });
  };

  // Horizontal staggered list
  Materialize.showStaggeredList = function (selector) {
    var time = 0;
    $(selector).find('li').velocity(
        { translateX: '-100px' },
        { duration: 0 });

    $(selector).find('li').each(function () {
      $(this).velocity(
        { opacity: '1', translateX: '0' },
        { duration: 800, delay: time, easing: [60, 10] });
      time += 120;
    });
  };


  $(document).ready(function () {
    // Hardcoded .staggered-list scrollFire
    // var staggeredListOptions = [];
    // $('ul.staggered-list').each(function (i) {

    //   var label = 'scrollFire-' + i;
    //   $(this).addClass(label);
    //   staggeredListOptions.push(
    //     {selector: 'ul.staggered-list.' + label,
    //      offset: 200,
    //      callback: 'showStaggeredList("ul.staggered-list.' + label + '")'});
    // });
    // scrollFire(staggeredListOptions);

    // HammerJS, Swipe navigation

    // Touch Event
    var swipeLeft = false;
    var swipeRight = false;


    // Dismissible Collections
    $('.dismissable').each(function () {
      $(this).hammer({
        prevent_default: false,
      }).on('pan', function (e) {
        if (e.gesture.pointerType === 'touch') {
          var $this = $(this);
          var direction = e.gesture.direction;
          var x = e.gesture.deltaX;
          var velocityX = e.gesture.velocityX;

          $this.velocity({ translateX: x,
              }, { duration: 50, queue: false, easing: 'easeOutQuad' });

          // Swipe Left
          if (direction === 4 && (x > ($this.innerWidth() / 2) || velocityX < -0.75)) {
            swipeLeft = true;
          }

          // Swipe Right
          if (direction === 2 && (x < (-1 * $this.innerWidth() / 2) || velocityX > 0.75)) {
            swipeRight = true;
          }
        }
      }).on('panend', function (e) {
        // Reset if collection is moved back into original position
        if (Math.abs(e.gesture.deltaX) < ($(this).innerWidth() / 2)) {
          swipeRight = false;
          swipeLeft = false;
        }

        if (e.gesture.pointerType === 'touch') {
          var $this = $(this);
          if (swipeLeft || swipeRight) {
            var fullWidth;
            if (swipeLeft) { fullWidth = $this.innerWidth(); }
            else { fullWidth = -1 * $this.innerWidth(); }

            $this.velocity({ translateX: fullWidth,
              }, { duration: 100, queue: false, easing: 'easeOutQuad', complete() {
                $this.css('border', 'none');
                $this.velocity({ height: 0, padding: 0,
                  }, { duration: 200, queue: false, easing: 'easeOutQuad', complete() { $this.remove(); },
                  });
              },
            });
          }
          else {
            $this.velocity({ translateX: 0,
              }, { duration: 100, queue: false, easing: 'easeOutQuad' });
          }
          swipeLeft = false;
          swipeRight = false;
        }
      });

    });


    // time = 0
    // // Vertical Staggered list
    // $('ul.staggered-list.vertical li').velocity(
    //     { translateY: "100px"},
    //     { duration: 0 });

    // $('ul.staggered-list.vertical li').each(function() {
    //   $(this).velocity(
    //     { opacity: "1", translateY: "0"},
    //     { duration: 800, delay: time, easing: [60, 25] });
    //   time += 120;
    // });

    // // Fade in and Scale
    // $('.fade-in.scale').velocity(
    //     { scaleX: .4, scaleY: .4, translateX: -600},
    //     { duration: 0});
    // $('.fade-in').each(function() {
    //   $(this).velocity(
    //     { opacity: "1", scaleX: 1, scaleY: 1, translateX: 0},
    //     { duration: 800, easing: [60, 10] });
    // });
  });
}(jQuery));
(function ($) {

  // Input: Array of JSON objects {selector, offset, callback}

  Materialize.scrollFire = function (options) {

    var didScroll = false;

    window.addEventListener('scroll', function () {
      didScroll = true;
    });

    // Rate limit to 100ms
    setInterval(function () {
      if (didScroll) {
          didScroll = false;

          var windowScroll = window.pageYOffset + window.innerHeight;

          for (var i = 0; i < options.length; i++) {
            // Get options from each line
            var value = options[i];
            var selector = value.selector,
                offset = value.offset,
                callback = value.callback;

            var currentElement = document.querySelector(selector);
            if (currentElement !== null) {
              var elementOffset = currentElement.getBoundingClientRect().top + window.pageYOffset;

              if (windowScroll > (elementOffset + offset)) {
                if (value.done !== true) {
                  var callbackFunc = new Function(callback);
                  callbackFunc();
                  value.done = true;
                }
              }
            }
          }
      }
    }, 100);
  };

})(jQuery);/*!
 * pickadate.js v3.5.0, 2014/04/13
 * By Amsul, http://amsul.ca
 * Hosted on http://amsul.github.io/pickadate.js
 * Licensed under MIT
 */

(function (factory) {

    // AMD.
    if (typeof define == 'function' && define.amd)
        define('picker', ['jquery'], factory);

    // Node.js/browserify.
    else if (typeof exports == 'object')
        module.exports = factory(require('jquery'));

    // Browser globals.
    else this.Picker = factory(jQuery);

}(function ($) {

var $window = $(window);
var $document = $(document);
var $html = $(document.documentElement);


/**
 * The picker constructor that creates a blank picker.
 */
function PickerConstructor(ELEMENT, NAME, COMPONENT, OPTIONS) {

    // If there’s no element, return the picker constructor.
    if (!ELEMENT) return PickerConstructor;


    var
        IS_DEFAULT_THEME = false,


        // The state of the picker.
        STATE = {
            id: ELEMENT.id || 'P' + Math.abs(~~(Math.random() * new Date())),
        },


        // Merge the defaults and options passed.
        SETTINGS = COMPONENT ? $.extend(true, {}, COMPONENT.defaults, OPTIONS) : OPTIONS || {},


        // Merge the default classes with the settings classes.
        CLASSES = $.extend({}, PickerConstructor.klasses(), SETTINGS.klass),


        // The element node wrapper into a jQuery object.
        $ELEMENT = $(ELEMENT),


        // Pseudo picker constructor.
        PickerInstance = function () {
            return this.start();
        },


        // The picker prototype.
        P = PickerInstance.prototype = {

            constructor: PickerInstance,

            $node: $ELEMENT,


            /**
             * Initialize everything
             */
            start() {

                // If it’s already started, do nothing.
                if (STATE && STATE.start) return P;


                // Update the picker states.
                STATE.methods = {};
                STATE.start = true;
                STATE.open = false;
                STATE.type = ELEMENT.type;


                // Confirm focus state, convert into text input to remove UA stylings,
                // and set as readonly to prevent keyboard popup.
                ELEMENT.autofocus = ELEMENT == getActiveElement();
                ELEMENT.readOnly = !SETTINGS.editable;
                ELEMENT.id = ELEMENT.id || STATE.id;
                if (ELEMENT.type != 'text') {
                    ELEMENT.type = 'text';
                }


                // Create a new picker component with the settings.
                P.component = new COMPONENT(P, SETTINGS);


                // Create the picker root with a holder and then prepare it.
                P.$root = $(PickerConstructor._.node('div', createWrappedComponent(), CLASSES.picker, 'id="' + ELEMENT.id + '_root" tabindex="0"'));
                prepareElementRoot();


                // If there’s a format for the hidden input element, create the element.
                if (SETTINGS.formatSubmit) {
                    prepareElementHidden();
                }


                // Prepare the input element.
                prepareElement();


                // Insert the root as specified in the settings.
                if (SETTINGS.container) $(SETTINGS.container).append(P.$root);
                else $ELEMENT.after(P.$root);


                // Bind the default component and settings events.
                P.on({
                    start: P.component.onStart,
                    render: P.component.onRender,
                    stop: P.component.onStop,
                    open: P.component.onOpen,
                    close: P.component.onClose,
                    set: P.component.onSet,
                }).on({
                    start: SETTINGS.onStart,
                    render: SETTINGS.onRender,
                    stop: SETTINGS.onStop,
                    open: SETTINGS.onOpen,
                    close: SETTINGS.onClose,
                    set: SETTINGS.onSet,
                });


                // Once we’re all set, check the theme in use.
                IS_DEFAULT_THEME = isUsingDefaultTheme(P.$root.children()[0]);


                // If the element has autofocus, open the picker.
                if (ELEMENT.autofocus) {
                    P.open();
                }


                // Trigger queued the “start” and “render” events.
                return P.trigger('start').trigger('render');
            }, // start


            /**
             * Render a new picker
             */
            render(entireComponent) {

                // Insert a new component holder in the root or box.
                if (entireComponent) P.$root.html(createWrappedComponent());
                else P.$root.find('.' + CLASSES.box).html(P.component.nodes(STATE.open));

                // Trigger the queued “render” events.
                return P.trigger('render');
            }, // render


            /**
             * Destroy everything
             */
            stop() {

                // If it’s already stopped, do nothing.
                if (!STATE.start) return P;

                // Then close the picker.
                P.close();

                // Remove the hidden field.
                if (P._hidden) {
                    P._hidden.parentNode.removeChild(P._hidden);
                }

                // Remove the root.
                P.$root.remove();

                // Remove the input class, remove the stored data, and unbind
                // the events (after a tick for IE - see `P.close`).
                $ELEMENT.removeClass(CLASSES.input).removeData(NAME);
                setTimeout(function () {
                    $ELEMENT.off('.' + STATE.id);
                }, 0);

                // Restore the element state
                ELEMENT.type = STATE.type;
                ELEMENT.readOnly = false;

                // Trigger the queued “stop” events.
                P.trigger('stop');

                // Reset the picker states.
                STATE.methods = {};
                STATE.start = false;

                return P;
            }, // stop


            /**
             * Open up the picker
             */
            open(dontGiveFocus) {

                // If it’s already open, do nothing.
                if (STATE.open) return P;

                // Add the “active” class.
                $ELEMENT.addClass(CLASSES.active);
                aria(ELEMENT, 'expanded', true);

                // * A Firefox bug, when `html` has `overflow:hidden`, results in
                //   killing transitions :(. So add the “opened” state on the next tick.
                //   Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=625289
                setTimeout(function () {

                    // Add the “opened” class to the picker root.
                    P.$root.addClass(CLASSES.opened);
                    aria(P.$root[0], 'hidden', false);

                }, 0);

                // If we have to give focus, bind the element and doc events.
                if (dontGiveFocus !== false) {

                    // Set it as open.
                    STATE.open = true;

                    // Prevent the page from scrolling.
                    if (IS_DEFAULT_THEME) {
                        $html.
                            css('overflow', 'hidden').
                            css('padding-right', '+=' + getScrollbarWidth());
                    }

                    // Pass focus to the root element’s jQuery object.
                    // * Workaround for iOS8 to bring the picker’s root into view.
                    P.$root[0].focus();

                    // Bind the document events.
                    $document.on('click.' + STATE.id + ' focusin.' + STATE.id, function (event) {

                        var target = event.target;

                        // If the target of the event is not the element, close the picker picker.
                        // * Don’t worry about clicks or focusins on the root because those don’t bubble up.
                        //   Also, for Firefox, a click on an `option` element bubbles up directly
                        //   to the doc. So make sure the target wasn't the doc.
                        // * In Firefox stopPropagation() doesn’t prevent right-click events from bubbling,
                        //   which causes the picker to unexpectedly close when right-clicking it. So make
                        //   sure the event wasn’t a right-click.
                        if (target != ELEMENT && target != document && event.which != 3) {

                            // If the target was the holder that covers the screen,
                            // keep the element focused to maintain tabindex.
                            P.close(target === P.$root.children()[0]);
                        }

                    }).on('keydown.' + STATE.id, function (event) {

                        var
                            // Get the keycode.
                            keycode = event.keyCode,

                            // Translate that to a selection change.
                            keycodeToMove = P.component.key[keycode],

                            // Grab the target.
                            target = event.target;


                        // On escape, close the picker and give focus.
                        if (keycode == 27) {
                            P.close(true);
                        }


                        // Check if there is a key movement or “enter” keypress on the element.
                        else if (target == P.$root[0] && (keycodeToMove || keycode == 13)) {

                            // Prevent the default action to stop page movement.
                            event.preventDefault();

                            // Trigger the key movement action.
                            if (keycodeToMove) {
                                PickerConstructor._.trigger(P.component.key.go, P, [PickerConstructor._.trigger(keycodeToMove)]);
                            }

                            // On “enter”, if the highlighted item isn’t disabled, set the value and close.
                            else if (!P.$root.find('.' + CLASSES.highlighted).hasClass(CLASSES.disabled)) {
                                P.set('select', P.component.item.highlight).close();
                            }
                        }


                        // If the target is within the root and “enter” is pressed,
                        // prevent the default action and trigger a click on the target instead.
                        else if ($.contains(P.$root[0], target) && keycode == 13) {
                            event.preventDefault();
                            target.click();
                        }
                    });
                }

                // Trigger the queued “open” events.
                return P.trigger('open');
            }, // open


            /**
             * Close the picker
             */
            close(giveFocus) {

                // If we need to give focus, do it before changing states.
                if (giveFocus) {
                    // ....ah yes! It would’ve been incomplete without a crazy workaround for IE :|
                    // The focus is triggered *after* the close has completed - causing it
                    // to open again. So unbind and rebind the event at the next tick.
                    P.$root.off('focus.toOpen')[0].focus();
                    setTimeout(function () {
                        P.$root.on('focus.toOpen', handleFocusToOpenEvent);
                    }, 0);
                }

                // Remove the “active” class.
                $ELEMENT.removeClass(CLASSES.active);
                aria(ELEMENT, 'expanded', false);

                // * A Firefox bug, when `html` has `overflow:hidden`, results in
                //   killing transitions :(. So remove the “opened” state on the next tick.
                //   Bug: https://bugzilla.mozilla.org/show_bug.cgi?id=625289
                setTimeout(function () {

                    // Remove the “opened” and “focused” class from the picker root.
                    P.$root.removeClass(CLASSES.opened + ' ' + CLASSES.focused);
                    aria(P.$root[0], 'hidden', true);

                }, 0);

                // If it’s already closed, do nothing more.
                if (!STATE.open) return P;

                // Set it as closed.
                STATE.open = false;

                // Allow the page to scroll.
                if (IS_DEFAULT_THEME) {
                    $html.
                        css('overflow', '').
                        css('padding-right', '-=' + getScrollbarWidth());
                }

                // Unbind the document events.
                $document.off('.' + STATE.id);

                // Trigger the queued “close” events.
                return P.trigger('close');
            }, // close


            /**
             * Clear the values
             */
            clear(options) {
                return P.set('clear', null, options);
            }, // clear


            /**
             * Set something
             */
            set(thing, value, options) {

                var thingItem, thingValue,
                    thingIsObject = $.isPlainObject(thing),
                    thingObject = thingIsObject ? thing : {};

                // Make sure we have usable options.
                options = thingIsObject && $.isPlainObject(value) ? value : options || {};

                if (thing) {

                    // If the thing isn’t an object, make it one.
                    if (!thingIsObject) {
                        thingObject[thing] = value;
                    }

                    // Go through the things of items to set.
                    for (thingItem in thingObject) {

                        // Grab the value of the thing.
                        thingValue = thingObject[thingItem];

                        // First, if the item exists and there’s a value, set it.
                        if (thingItem in P.component.item) {
                            if (thingValue === undefined) thingValue = null;
                            P.component.set(thingItem, thingValue, options);
                        }

                        // Then, check to update the element value and broadcast a change.
                        if (thingItem == 'select' || thingItem == 'clear') {
                            $ELEMENT.
                                val(thingItem == 'clear' ? '' : P.get(thingItem, SETTINGS.format)).
                                trigger('change');
                        }
                    }

                    // Render a new picker.
                    P.render();
                }

                // When the method isn’t muted, trigger queued “set” events and pass the `thingObject`.
                return options.muted ? P : P.trigger('set', thingObject);
            }, // set


            /**
             * Get something
             */
            get(thing, format) {

                // Make sure there’s something to get.
                thing = thing || 'value';

                // If a picker state exists, return that.
                if (STATE[thing] != null) {
                    return STATE[thing];
                }

                // Return the submission value, if that.
                if (thing == 'valueSubmit') {
                    if (P._hidden) {
                        return P._hidden.value;
                    }
                    thing = 'value';
                }

                // Return the value, if that.
                if (thing == 'value') {
                    return ELEMENT.value;
                }

                // Check if a component item exists, return that.
                if (thing in P.component.item) {
                    if (typeof format == 'string') {
                        var thingValue = P.component.get(thing);
                        return thingValue ?
                            PickerConstructor._.trigger(
                                P.component.formats.toString,
                                P.component,
                                [format, thingValue]
                            ) : '';
                    }
                    return P.component.get(thing);
                }
            }, // get


            /**
             * Bind events on the things.
             */
            on(thing, method, internal) {

                var thingName, thingMethod,
                    thingIsObject = $.isPlainObject(thing),
                    thingObject = thingIsObject ? thing : {};

                if (thing) {

                    // If the thing isn’t an object, make it one.
                    if (!thingIsObject) {
                        thingObject[thing] = method;
                    }

                    // Go through the things to bind to.
                    for (thingName in thingObject) {

                        // Grab the method of the thing.
                        thingMethod = thingObject[thingName];

                        // If it was an internal binding, prefix it.
                        if (internal) {
                            thingName = '_' + thingName;
                        }

                        // Make sure the thing methods collection exists.
                        STATE.methods[thingName] = STATE.methods[thingName] || [];

                        // Add the method to the relative method collection.
                        STATE.methods[thingName].push(thingMethod);
                    }
                }

                return P;
            }, // on


            /**
             * Unbind events on the things.
             */
            off() {
                var i, thingName,
                    names = arguments;
                for (i = 0, namesCount = names.length; i < namesCount; i += 1) {
                    thingName = names[i];
                    if (thingName in STATE.methods) {
                        delete STATE.methods[thingName];
                    }
                }
                return P;
            },


            /**
             * Fire off method events.
             */
            trigger(name, data) {
                var _trigger = function (name) {
                    var methodList = STATE.methods[name];
                    if (methodList) {
                        methodList.map(function (method) {
                            PickerConstructor._.trigger(method, P, [data]);
                        });
                    }
                };
                _trigger('_' + name);
                _trigger(name);
                return P;
            }, // trigger
        }; // PickerInstance.prototype


    /**
     * Wrap the picker holder components together.
     */
    function createWrappedComponent() {

        // Create a picker wrapper holder
        return PickerConstructor._.node('div',

            // Create a picker wrapper node
            PickerConstructor._.node('div',

                // Create a picker frame
                PickerConstructor._.node('div',

                    // Create a picker box node
                    PickerConstructor._.node('div',

                        // Create the components nodes.
                        P.component.nodes(STATE.open),

                        // The picker box class
                        CLASSES.box
                    ),

                    // Picker wrap class
                    CLASSES.wrap
                ),

                // Picker frame class
                CLASSES.frame
            ),

            // Picker holder class
            CLASSES.holder
        ); // endreturn
    } // createWrappedComponent


    /**
     * Prepare the input element with all bindings.
     */
    function prepareElement() {

        $ELEMENT.

            // Store the picker data by component name.
            data(NAME, P).

            // Add the “input” class name.
            addClass(CLASSES.input).

            // Remove the tabindex.
            attr('tabindex', -1).

            // If there’s a `data-value`, update the value of the element.
            val($ELEMENT.data('value') ?
                P.get('select', SETTINGS.format) :
                ELEMENT.value
            );


        // Only bind keydown events if the element isn’t editable.
        if (!SETTINGS.editable) {

            $ELEMENT.

                // On focus/click, focus onto the root to open it up.
                on('focus.' + STATE.id + ' click.' + STATE.id, function (event) {
                    event.preventDefault();
                    P.$root[0].focus();
                }).

                // Handle keyboard event based on the picker being opened or not.
                on('keydown.' + STATE.id, handleKeydownEvent);
        }


        // Update the aria attributes.
        aria(ELEMENT, {
            haspopup: true,
            expanded: false,
            readonly: false,
            owns: ELEMENT.id + '_root',
        });
    }


    /**
     * Prepare the root picker element with all bindings.
     */
    function prepareElementRoot() {

        P.$root.

            on({

                // For iOS8.
                keydown: handleKeydownEvent,

                // When something within the root is focused, stop from bubbling
                // to the doc and remove the “focused” state from the root.
                focusin(event) {
                    P.$root.removeClass(CLASSES.focused);
                    event.stopPropagation();
                },

                // When something within the root holder is clicked, stop it
                // from bubbling to the doc.
                'mousedown click'(event) {

                    var target = event.target;

                    // Make sure the target isn’t the root holder so it can bubble up.
                    if (target != P.$root.children()[0]) {

                        event.stopPropagation();

                        // * For mousedown events, cancel the default action in order to
                        //   prevent cases where focus is shifted onto external elements
                        //   when using things like jQuery mobile or MagnificPopup (ref: #249 & #120).
                        //   Also, for Firefox, don’t prevent action on the `option` element.
                        if (event.type == 'mousedown' && !$(target).is('input, select, textarea, button, option')) {

                            event.preventDefault();

                            // Re-focus onto the root so that users can click away
                            // from elements focused within the picker.
                            P.$root[0].focus();
                        }
                    }
                },
            }).

            // Add/remove the “target” class on focus and blur.
            on({
                focus() {
                    $ELEMENT.addClass(CLASSES.target);
                },
                blur() {
                    $ELEMENT.removeClass(CLASSES.target);
                },
            }).

            // Open the picker and adjust the root “focused” state
            on('focus.toOpen', handleFocusToOpenEvent).

            // If there’s a click on an actionable element, carry out the actions.
            on('click', '[data-pick], [data-nav], [data-clear], [data-close]', function () {

                var $target = $(this),
                    targetData = $target.data(),
                    targetDisabled = $target.hasClass(CLASSES.navDisabled) || $target.hasClass(CLASSES.disabled),

                    // * For IE, non-focusable elements can be active elements as well
                    //   (http://stackoverflow.com/a/2684561).
                    activeElement = getActiveElement();
                    activeElement = activeElement && (activeElement.type || activeElement.href);

                // If it’s disabled or nothing inside is actively focused, re-focus the element.
                if (targetDisabled || activeElement && !$.contains(P.$root[0], activeElement)) {
                    P.$root[0].focus();
                }

                // If something is superficially changed, update the `highlight` based on the `nav`.
                if (!targetDisabled && targetData.nav) {
                    P.set('highlight', P.component.item.highlight, { nav: targetData.nav });
                }

                // If something is picked, set `select` then close with focus.
                else if (!targetDisabled && 'pick' in targetData) {
                    P.set('select', targetData.pick);
                }

                // If a “clear” button is pressed, empty the values and close with focus.
                else if (targetData.clear) {
                    P.clear().close(true);
                }

                else if (targetData.close) {
                    P.close(true);
                }

            }); // P.$root

        aria(P.$root[0], 'hidden', true);
    }


     /**
      * Prepare the hidden input element along with all bindings.
      */
    function prepareElementHidden() {

        var name;

        if (SETTINGS.hiddenName === true) {
            name = ELEMENT.name;
            ELEMENT.name = '';
        }
        else {
            name = [
                typeof SETTINGS.hiddenPrefix == 'string' ? SETTINGS.hiddenPrefix : '',
                typeof SETTINGS.hiddenSuffix == 'string' ? SETTINGS.hiddenSuffix : '_submit',
            ];
            name = name[0] + ELEMENT.name + name[1];
        }

        P._hidden = $(
            '<input ' +
            'type=hidden ' +

            // Create the name using the original input’s with a prefix and suffix.
            'name="' + name + '"' +

            // If the element has a value, set the hidden value as well.
            (
                $ELEMENT.data('value') || ELEMENT.value ?
                    ' value="' + P.get('select', SETTINGS.formatSubmit) + '"' :
                    ''
            ) +
            '>'
        )[0];

        $ELEMENT.

            // If the value changes, update the hidden input with the correct format.
            on('change.' + STATE.id, function () {
                P._hidden.value = ELEMENT.value ?
                    P.get('select', SETTINGS.formatSubmit) :
                    '';
            });


        // Insert the hidden input as specified in the settings.
        if (SETTINGS.container) $(SETTINGS.container).append(P._hidden);
        else $ELEMENT.after(P._hidden);
    }


    // For iOS8.
    function handleKeydownEvent(event) {

        var keycode = event.keyCode,

            // Check if one of the delete keys was pressed.
            isKeycodeDelete = /^(8|46)$/.test(keycode);

        // For some reason IE clears the input value on “escape”.
        if (keycode == 27) {
            P.close();
            return false;
        }

        // Check if `space` or `delete` was pressed or the picker is closed with a key movement.
        if (keycode == 32 || isKeycodeDelete || !STATE.open && P.component.key[keycode]) {

            // Prevent it from moving the page and bubbling to doc.
            event.preventDefault();
            event.stopPropagation();

            // If `delete` was pressed, clear the values and close the picker.
            // Otherwise open the picker.
            if (isKeycodeDelete) { P.clear().close(); }
            else { P.open(); }
        }
    }


    // Separated for IE
    function handleFocusToOpenEvent(event) {

        // Stop the event from propagating to the doc.
        event.stopPropagation();

        // If it’s a focus event, add the “focused” class to the root.
        if (event.type == 'focus') {
            P.$root.addClass(CLASSES.focused);
        }

        // And then finally open the picker.
        P.open();
    }


    // Return a new picker instance.
    return new PickerInstance();
} // PickerConstructor


/**
 * The default classes and prefix to use for the HTML classes.
 */
PickerConstructor.klasses = function (prefix) {
    prefix = prefix || 'picker';
    return {

        picker: prefix,
        opened: prefix + '--opened',
        focused: prefix + '--focused',

        input: prefix + '__input',
        active: prefix + '__input--active',
        target: prefix + '__input--target',

        holder: prefix + '__holder',

        frame: prefix + '__frame',
        wrap: prefix + '__wrap',

        box: prefix + '__box',
    };
}; // PickerConstructor.klasses


/**
 * Check if the default theme is being used.
 */
function isUsingDefaultTheme(element) {

    var theme,
        prop = 'position';

    // For IE.
    if (element.currentStyle) {
        theme = element.currentStyle[prop];
    }

    // For normal browsers.
    else if (window.getComputedStyle) {
        theme = getComputedStyle(element)[prop];
    }

    return theme == 'fixed';
}


/**
 * Get the width of the browser’s scrollbar.
 * Taken from: https://github.com/VodkaBears/Remodal/blob/master/src/jquery.remodal.js
 */
function getScrollbarWidth() {

    if ($html.height() <= $window.height()) {
        return 0;
    }

    var $outer = $('<div style="visibility:hidden;width:100px" />').
        appendTo('body');

    // Get the width without scrollbars.
    var widthWithoutScroll = $outer[0].offsetWidth;

    // Force adding scrollbars.
    $outer.css('overflow', 'scroll');

    // Add the inner div.
    var $inner = $('<div style="width:100%" />').appendTo($outer);

    // Get the width with scrollbars.
    var widthWithScroll = $inner[0].offsetWidth;

    // Remove the divs.
    $outer.remove();

    // Return the difference between the widths.
    return widthWithoutScroll - widthWithScroll;
}


/**
 * PickerConstructor helper methods.
 */
PickerConstructor._ = {

    /**
     * Create a group of nodes. Expects:
     * `
        {
            min:    {Integer},
            max:    {Integer},
            i:      {Integer},
            node:   {String},
            item:   {Function}
        }
     * `
     */
    group(groupObject) {

        var
            // Scope for the looped object
            loopObjectScope,

            // Create the nodes list
            nodesList = '',

            // The counter starts from the `min`
            counter = PickerConstructor._.trigger(groupObject.min, groupObject);


        // Loop from the `min` to `max`, incrementing by `i`
        for (; counter <= PickerConstructor._.trigger(groupObject.max, groupObject, [counter]); counter += groupObject.i) {

            // Trigger the `item` function within scope of the object
            loopObjectScope = PickerConstructor._.trigger(groupObject.item, groupObject, [counter]);

            // Splice the subgroup and create nodes out of the sub nodes
            nodesList += PickerConstructor._.node(
                groupObject.node,
                loopObjectScope[0],   // the node
                loopObjectScope[1],   // the classes
                loopObjectScope[2]    // the attributes
            );
        }

        // Return the list of nodes
        return nodesList;
    }, // group


    /**
     * Create a dom node string
     */
    node(wrapper, item, klass, attribute) {

        // If the item is false-y, just return an empty string
        if (!item) return '';

        // If the item is an array, do a join
        item = $.isArray(item) ? item.join('') : item;

        // Check for the class
        klass = klass ? ' class="' + klass + '"' : '';

        // Check for any attributes
        attribute = attribute ? ' ' + attribute : '';

        // Return the wrapped item
        return '<' + wrapper + klass + attribute + '>' + item + '</' + wrapper + '>';
    }, // node


    /**
     * Lead numbers below 10 with a zero.
     */
    lead(number) {
        return (number < 10 ? '0' : '') + number;
    },


    /**
     * Trigger a function otherwise return the value.
     */
    trigger(callback, scope, args) {
        return typeof callback == 'function' ? callback.apply(scope, args || []) : callback;
    },


    /**
     * If the second character is a digit, length is 2 otherwise 1.
     */
    digits(string) {
        return (/\d/).test(string[1]) ? 2 : 1;
    },


    /**
     * Tell if something is a date object.
     */
    isDate(value) {
        return {}.toString.call(value).indexOf('Date') > -1 && this.isInteger(value.getDate());
    },


    /**
     * Tell if something is an integer.
     */
    isInteger(value) {
        return {}.toString.call(value).indexOf('Number') > -1 && value % 1 === 0;
    },


    /**
     * Create ARIA attribute strings.
     */
    ariaAttr,
}; // PickerConstructor._


/**
 * Extend the picker with a component and defaults.
 */
PickerConstructor.extend = function (name, Component) {

    // Extend jQuery.
    $.fn[name] = function (options, action) {

        // Grab the component data.
        var componentData = this.data(name);

        // If the picker is requested, return the data object.
        if (options == 'picker') {
            return componentData;
        }

        // If the component data exists and `options` is a string, carry out the action.
        if (componentData && typeof options == 'string') {
            return PickerConstructor._.trigger(componentData[options], componentData, [action]);
        }

        // Otherwise go through each matched element and if the component
        // doesn’t exist, create a new picker using `this` element
        // and merging the defaults and options with a deep copy.
        return this.each(function () {
            var $this = $(this);
            if (!$this.data(name)) {
                new PickerConstructor(this, name, Component, options);
            }
        });
    };

    // Set the defaults.
    $.fn[name].defaults = Component.defaults;
}; // PickerConstructor.extend


function aria(element, attribute, value) {
    if ($.isPlainObject(attribute)) {
        for (var key in attribute) {
            ariaSet(element, key, attribute[key]);
        }
    }
    else {
        ariaSet(element, attribute, value);
    }
}
function ariaSet(element, attribute, value) {
    element.setAttribute(
        (attribute == 'role' ? '' : 'aria-') + attribute,
        value
    );
}
function ariaAttr(attribute, data) {
    if (!$.isPlainObject(attribute)) {
        attribute = { attribute: data };
    }
    data = '';
    for (var key in attribute) {
        var attr = (key == 'role' ? '' : 'aria-') + key,
            attrVal = attribute[key];
        data += attrVal == null ? '' : attr + '="' + attribute[key] + '"';
    }
    return data;
}

// IE8 bug throws an error for activeElements within iframes.
function getActiveElement() {
    try {
        return document.activeElement;
    } catch (err) { }
}


// Expose the picker constructor.
return PickerConstructor;


}));


/*!
 * Date picker for pickadate.js v3.5.0
 * http://amsul.github.io/pickadate.js/date.htm
 */

(function (factory) {

    // AMD.
    if (typeof define == 'function' && define.amd)
        define(['picker', 'jquery'], factory);

    // Node.js/browserify.
    else if (typeof exports == 'object')
        module.exports = factory(require('./picker.js'), require('jquery'));

    // Browser globals.
    else factory(Picker, jQuery);

}(function (Picker, $) {


/**
 * Globals and constants
 */
var DAYS_IN_WEEK = 7,
    WEEKS_IN_CALENDAR = 6,
    _ = Picker._;


/**
 * The date picker constructor
 */
function DatePicker(picker, settings) {

    var calendar = this,
        element = picker.$node[0],
        elementValue = element.value,
        elementDataValue = picker.$node.data('value'),
        valueString = elementDataValue || elementValue,
        formatString = elementDataValue ? settings.formatSubmit : settings.format,
        isRTL = function () {

            return element.currentStyle ?

                // For IE.
                element.currentStyle.direction == 'rtl' :

                // For normal browsers.
                getComputedStyle(picker.$root[0]).direction == 'rtl';
        };

    calendar.settings = settings;
    calendar.$node = picker.$node;

    // The queue of methods that will be used to build item objects.
    calendar.queue = {
        min: 'measure create',
        max: 'measure create',
        now: 'now create',
        select: 'parse create validate',
        highlight: 'parse navigate create validate',
        view: 'parse create validate viewset',
        disable: 'deactivate',
        enable: 'activate',
    };

    // The component's item object.
    calendar.item = {};

    calendar.item.clear = null;
    calendar.item.disable = (settings.disable || []).slice(0);
    calendar.item.enable = -(function (collectionDisabled) {
        return collectionDisabled[0] === true ? collectionDisabled.shift() : -1;
    })(calendar.item.disable);

    calendar.
        set('min', settings.min).
        set('max', settings.max).
        set('now');

    // When there’s a value, set the `select`, which in turn
    // also sets the `highlight` and `view`.
    if (valueString) {
        calendar.set('select', valueString, { format: formatString });
    }

    // If there’s no value, default to highlighting “today”.
    else {
        calendar.
            set('select', null).
            set('highlight', calendar.item.now);
    }


    // The keycode to movement mapping.
    calendar.key = {
        40: 7, // Down
        38: -7, // Up
        39() { return isRTL() ? -1 : 1; }, // Right
        37() { return isRTL() ? 1 : -1; }, // Left
        go(timeChange) {
            var highlightedObject = calendar.item.highlight,
                targetDate = new Date(highlightedObject.year, highlightedObject.month, highlightedObject.date + timeChange);
            calendar.set(
                'highlight',
                targetDate,
                { interval: timeChange }
            );
            this.render();
        },
    };


    // Bind some picker events.
    picker.
        on('render', function () {
            picker.$root.find('.' + settings.klass.selectMonth).on('change', function () {
                var value = this.value;
                if (value) {
                    picker.set('highlight', [picker.get('view').year, value, picker.get('highlight').date]);
                    picker.$root.find('.' + settings.klass.selectMonth).trigger('focus');
                }
            });
            picker.$root.find('.' + settings.klass.selectYear).on('change', function () {
                var value = this.value;
                if (value) {
                    picker.set('highlight', [value, picker.get('view').month, picker.get('highlight').date]);
                    picker.$root.find('.' + settings.klass.selectYear).trigger('focus');
                }
            });
        }, 1).
        on('open', function () {
            var includeToday = '';
            if (calendar.disabled(calendar.get('now'))) {
                includeToday = ':not(.' + settings.klass.buttonToday + ')';
            }
            picker.$root.find('button' + includeToday + ', select').attr('disabled', false);
        }, 1).
        on('close', function () {
            picker.$root.find('button, select').attr('disabled', true);
        }, 1);

} // DatePicker


/**
 * Set a datepicker item object.
 */
DatePicker.prototype.set = function (type, value, options) {

    var calendar = this,
        calendarItem = calendar.item;

    // If the value is `null` just set it immediately.
    if (value === null) {
        if (type == 'clear') type = 'select';
        calendarItem[type] = value;
        return calendar;
    }

    // Otherwise go through the queue of methods, and invoke the functions.
    // Update this as the time unit, and set the final value as this item.
    // * In the case of `enable`, keep the queue but set `disable` instead.
    //   And in the case of `flip`, keep the queue but set `enable` instead.
    calendarItem[ (type == 'enable' ? 'disable' : type == 'flip' ? 'enable' : type) ] = calendar.queue[type].split(' ').map(function (method) {
        value = calendar[method](type, value, options);
        return value;
    }).pop();

    // Check if we need to cascade through more updates.
    if (type == 'select') {
        calendar.set('highlight', calendarItem.select, options);
    }
    else if (type == 'highlight') {
        calendar.set('view', calendarItem.highlight, options);
    }
    else if (type.match(/^(flip|min|max|disable|enable)$/)) {
        if (calendarItem.select && calendar.disabled(calendarItem.select)) {
            calendar.set('select', calendarItem.select, options);
        }
        if (calendarItem.highlight && calendar.disabled(calendarItem.highlight)) {
            calendar.set('highlight', calendarItem.highlight, options);
        }
    }

    return calendar;
}; // DatePicker.prototype.set


/**
 * Get a datepicker item object.
 */
DatePicker.prototype.get = function (type) {
    return this.item[type];
}; // DatePicker.prototype.get


/**
 * Create a picker date object.
 */
DatePicker.prototype.create = function (type, value, options) {

    var isInfiniteValue,
        calendar = this;

    // If there’s no value, use the type as the value.
    value = value === undefined ? type : value;


    // If it’s infinity, update the value.
    if (value == -Infinity || value == Infinity) {
        isInfiniteValue = value;
    }

    // If it’s an object, use the native date object.
    else if ($.isPlainObject(value) && _.isInteger(value.pick)) {
        value = value.obj;
    }

    // If it’s an array, convert it into a date and make sure
    // that it’s a valid date – otherwise default to today.
    else if ($.isArray(value)) {
        value = new Date(value[0], value[1], value[2]);
        value = _.isDate(value) ? value : calendar.create().obj;
    }

    // If it’s a number or date object, make a normalized date.
    else if (_.isInteger(value) || _.isDate(value)) {
        value = calendar.normalize(new Date(value), options);
    }

    // If it’s a literal true or any other case, set it to now.
    else /* if ( value === true )*/ {
        value = calendar.now(type, value, options);
    }

    // Return the compiled object.
    return {
        year: isInfiniteValue || value.getFullYear(),
        month: isInfiniteValue || value.getMonth(),
        date: isInfiniteValue || value.getDate(),
        day: isInfiniteValue || value.getDay(),
        obj: isInfiniteValue || value,
        pick: isInfiniteValue || value.getTime(),
    };
}; // DatePicker.prototype.create


/**
 * Create a range limit object using an array, date object,
 * literal “true”, or integer relative to another time.
 */
DatePicker.prototype.createRange = function (from, to) {

    var calendar = this,
        createDate = function (date) {
            if (date === true || $.isArray(date) || _.isDate(date)) {
                return calendar.create(date);
            }
            return date;
        };

    // Create objects if possible.
    if (!_.isInteger(from)) {
        from = createDate(from);
    }
    if (!_.isInteger(to)) {
        to = createDate(to);
    }

    // Create relative dates.
    if (_.isInteger(from) && $.isPlainObject(to)) {
        from = [to.year, to.month, to.date + from];
    }
    else if (_.isInteger(to) && $.isPlainObject(from)) {
        to = [from.year, from.month, from.date + to];
    }

    return {
        from: createDate(from),
        to: createDate(to),
    };
}; // DatePicker.prototype.createRange


/**
 * Check if a date unit falls within a date range object.
 */
DatePicker.prototype.withinRange = function (range, dateUnit) {
    range = this.createRange(range.from, range.to);
    return dateUnit.pick >= range.from.pick && dateUnit.pick <= range.to.pick;
};


/**
 * Check if two date range objects overlap.
 */
DatePicker.prototype.overlapRanges = function (one, two) {

    var calendar = this;

    // Convert the ranges into comparable dates.
    one = calendar.createRange(one.from, one.to);
    two = calendar.createRange(two.from, two.to);

    return calendar.withinRange(one, two.from) || calendar.withinRange(one, two.to) ||
        calendar.withinRange(two, one.from) || calendar.withinRange(two, one.to);
};


/**
 * Get the date today.
 */
DatePicker.prototype.now = function (type, value, options) {
    value = new Date();
    if (options && options.rel) {
        value.setDate(value.getDate() + options.rel);
    }
    return this.normalize(value, options);
};


/**
 * Navigate to next/prev month.
 */
DatePicker.prototype.navigate = function (type, value, options) {

    var targetDateObject,
        targetYear,
        targetMonth,
        targetDate,
        isTargetArray = $.isArray(value),
        isTargetObject = $.isPlainObject(value),
        viewsetObject = this.item.view;/* ,
        safety = 100*/


    if (isTargetArray || isTargetObject) {

        if (isTargetObject) {
            targetYear = value.year;
            targetMonth = value.month;
            targetDate = value.date;
        }
        else {
            targetYear = +value[0];
            targetMonth = +value[1];
            targetDate = +value[2];
        }

        // If we’re navigating months but the view is in a different
        // month, navigate to the view’s year and month.
        if (options && options.nav && viewsetObject && viewsetObject.month !== targetMonth) {
            targetYear = viewsetObject.year;
            targetMonth = viewsetObject.month;
        }

        // Figure out the expected target year and month.
        targetDateObject = new Date(targetYear, targetMonth + (options && options.nav ? options.nav : 0), 1);
        targetYear = targetDateObject.getFullYear();
        targetMonth = targetDateObject.getMonth();

        // If the month we’re going to doesn’t have enough days,
        // keep decreasing the date until we reach the month’s last date.
        while (/* safety &&*/ new Date(targetYear, targetMonth, targetDate).getMonth() !== targetMonth) {
            targetDate -= 1;
            /* safety -= 1
            if ( !safety ) {
                throw 'Fell into an infinite loop while navigating to ' + new Date( targetYear, targetMonth, targetDate ) + '.'
            }*/
        }

        value = [targetYear, targetMonth, targetDate];
    }

    return value;
}; // DatePicker.prototype.navigate


/**
 * Normalize a date by setting the hours to midnight.
 */
DatePicker.prototype.normalize = function (value/* , options*/) {
    value.setHours(0, 0, 0, 0);
    return value;
};


/**
 * Measure the range of dates.
 */
DatePicker.prototype.measure = function (type, value/* , options*/) {

    var calendar = this;

    // If it’s anything false-y, remove the limits.
    if (!value) {
        value = type == 'min' ? -Infinity : Infinity;
    }

    // If it’s a string, parse it.
    else if (typeof value == 'string') {
        value = calendar.parse(type, value);
    }

    // If it's an integer, get a date relative to today.
    else if (_.isInteger(value)) {
        value = calendar.now(type, value, { rel: value });
    }

    return value;
}; // /DatePicker.prototype.measure


/**
 * Create a viewset object based on navigation.
 */
DatePicker.prototype.viewset = function (type, dateObject/* , options*/) {
    return this.create([dateObject.year, dateObject.month, 1]);
};


/**
 * Validate a date as enabled and shift if needed.
 */
DatePicker.prototype.validate = function (type, dateObject, options) {

    var calendar = this,

        // Keep a reference to the original date.
        originalDateObject = dateObject,

        // Make sure we have an interval.
        interval = options && options.interval ? options.interval : 1,

        // Check if the calendar enabled dates are inverted.
        isFlippedBase = calendar.item.enable === -1,

        // Check if we have any enabled dates after/before now.
        hasEnabledBeforeTarget, hasEnabledAfterTarget,

        // The min & max limits.
        minLimitObject = calendar.item.min,
        maxLimitObject = calendar.item.max,

        // Check if we’ve reached the limit during shifting.
        reachedMin, reachedMax,

        // Check if the calendar is inverted and at least one weekday is enabled.
        hasEnabledWeekdays = isFlippedBase && calendar.item.disable.filter(function (value) {

            // If there’s a date, check where it is relative to the target.
            if ($.isArray(value)) {
                var dateTime = calendar.create(value).pick;
                if (dateTime < dateObject.pick) hasEnabledBeforeTarget = true;
                else if (dateTime > dateObject.pick) hasEnabledAfterTarget = true;
            }

            // Return only integers for enabled weekdays.
            return _.isInteger(value);
        }).length;/* ,

        safety = 100*/


    // Cases to validate for:
    // [1] Not inverted and date disabled.
    // [2] Inverted and some dates enabled.
    // [3] Not inverted and out of range.
    //
    // Cases to **not** validate for:
    // • Navigating months.
    // • Not inverted and date enabled.
    // • Inverted and all dates disabled.
    // • ..and anything else.
    if (!options || !options.nav) if (
        /* 1 */ (!isFlippedBase && calendar.disabled(dateObject)) ||
        /* 2 */ (isFlippedBase && calendar.disabled(dateObject) && (hasEnabledWeekdays || hasEnabledBeforeTarget || hasEnabledAfterTarget)) ||
        /* 3 */ (!isFlippedBase && (dateObject.pick <= minLimitObject.pick || dateObject.pick >= maxLimitObject.pick))
    ) {


        // When inverted, flip the direction if there aren’t any enabled weekdays
        // and there are no enabled dates in the direction of the interval.
        if (isFlippedBase && !hasEnabledWeekdays && ((!hasEnabledAfterTarget && interval > 0) || (!hasEnabledBeforeTarget && interval < 0))) {
            interval *= -1;
        }


        // Keep looping until we reach an enabled date.
        while (/* safety &&*/ calendar.disabled(dateObject)) {

            /* safety -= 1
            if ( !safety ) {
                throw 'Fell into an infinite loop while validating ' + dateObject.obj + '.'
            }*/


            // If we’ve looped into the next/prev month with a large interval, return to the original date and flatten the interval.
            if (Math.abs(interval) > 1 && (dateObject.month < originalDateObject.month || dateObject.month > originalDateObject.month)) {
                dateObject = originalDateObject;
                interval = interval > 0 ? 1 : -1;
            }


            // If we’ve reached the min/max limit, reverse the direction, flatten the interval and set it to the limit.
            if (dateObject.pick <= minLimitObject.pick) {
                reachedMin = true;
                interval = 1;
                dateObject = calendar.create([
                    minLimitObject.year,
                    minLimitObject.month,
                    minLimitObject.date + (dateObject.pick === minLimitObject.pick ? 0 : -1),
                ]);
            }
            else if (dateObject.pick >= maxLimitObject.pick) {
                reachedMax = true;
                interval = -1;
                dateObject = calendar.create([
                    maxLimitObject.year,
                    maxLimitObject.month,
                    maxLimitObject.date + (dateObject.pick === maxLimitObject.pick ? 0 : 1),
                ]);
            }


            // If we’ve reached both limits, just break out of the loop.
            if (reachedMin && reachedMax) {
                break;
            }


            // Finally, create the shifted date using the interval and keep looping.
            dateObject = calendar.create([dateObject.year, dateObject.month, dateObject.date + interval]);
        }

    } // endif


    // Return the date object settled on.
    return dateObject;
}; // DatePicker.prototype.validate


/**
 * Check if a date is disabled.
 */
DatePicker.prototype.disabled = function (dateToVerify) {

    var
        calendar = this,

        // Filter through the disabled dates to check if this is one.
        isDisabledMatch = calendar.item.disable.filter(function (dateToDisable) {

            // If the date is a number, match the weekday with 0index and `firstDay` check.
            if (_.isInteger(dateToDisable)) {
                return dateToVerify.day === (calendar.settings.firstDay ? dateToDisable : dateToDisable - 1) % 7;
            }

            // If it’s an array or a native JS date, create and match the exact date.
            if ($.isArray(dateToDisable) || _.isDate(dateToDisable)) {
                return dateToVerify.pick === calendar.create(dateToDisable).pick;
            }

            // If it’s an object, match a date within the “from” and “to” range.
            if ($.isPlainObject(dateToDisable)) {
                return calendar.withinRange(dateToDisable, dateToVerify);
            }
        });

    // If this date matches a disabled date, confirm it’s not inverted.
    isDisabledMatch = isDisabledMatch.length && !isDisabledMatch.filter(function (dateToDisable) {
        return $.isArray(dateToDisable) && dateToDisable[3] == 'inverted' ||
            $.isPlainObject(dateToDisable) && dateToDisable.inverted;
    }).length;

    // Check the calendar “enabled” flag and respectively flip the
    // disabled state. Then also check if it’s beyond the min/max limits.
    return calendar.item.enable === -1 ? !isDisabledMatch : isDisabledMatch ||
        dateToVerify.pick < calendar.item.min.pick ||
        dateToVerify.pick > calendar.item.max.pick;

}; // DatePicker.prototype.disabled


/**
 * Parse a string into a usable type.
 */
DatePicker.prototype.parse = function (type, value, options) {

    var calendar = this,
        parsingObject = {};

    // If it’s already parsed, we’re good.
    if (!value || typeof value != 'string') {
        return value;
    }

    // We need a `.format` to parse the value with.
    if (!(options && options.format)) {
        options = options || {};
        options.format = calendar.settings.format;
    }

    // Convert the format into an array and then map through it.
    calendar.formats.toArray(options.format).map(function (label) {

        var
            // Grab the formatting label.
            formattingLabel = calendar.formats[label],

            // The format length is from the formatting label function or the
            // label length without the escaping exclamation (!) mark.
            formatLength = formattingLabel ? _.trigger(formattingLabel, calendar, [value, parsingObject]) : label.replace(/^!/, '').length;

        // If there's a format label, split the value up to the format length.
        // Then add it to the parsing object with appropriate label.
        if (formattingLabel) {
            parsingObject[label] = value.substr(0, formatLength);
        }

        // Update the value as the substring from format length to end.
        value = value.substr(formatLength);
    });

    // Compensate for month 0index.
    return [
        parsingObject.yyyy || parsingObject.yy,
        +(parsingObject.mm || parsingObject.m) - 1,
        parsingObject.dd || parsingObject.d,
    ];
}; // DatePicker.prototype.parse


/**
 * Various formats to display the object in.
 */
DatePicker.prototype.formats = (function () {

    // Return the length of the first word in a collection.
    function getWordLengthFromCollection(string, collection, dateObject) {

        // Grab the first word from the string.
        var word = string.match(/\w+/)[0];

        // If there's no month index, add it to the date object
        if (!dateObject.mm && !dateObject.m) {
            dateObject.m = collection.indexOf(word) + 1;
        }

        // Return the length of the word.
        return word.length;
    }

    // Get the length of the first word in a string.
    function getFirstWordLength(string) {
        return string.match(/\w+/)[0].length;
    }

    return {

        d(string, dateObject) {

            // If there's string, then get the digits length.
            // Otherwise return the selected date.
            return string ? _.digits(string) : dateObject.date;
        },
        dd(string, dateObject) {

            // If there's a string, then the length is always 2.
            // Otherwise return the selected date with a leading zero.
            return string ? 2 : _.lead(dateObject.date);
        },
        ddd(string, dateObject) {

            // If there's a string, then get the length of the first word.
            // Otherwise return the short selected weekday.
            return string ? getFirstWordLength(string) : this.settings.weekdaysShort[dateObject.day];
        },
        dddd(string, dateObject) {

            // If there's a string, then get the length of the first word.
            // Otherwise return the full selected weekday.
            return string ? getFirstWordLength(string) : this.settings.weekdaysFull[dateObject.day];
        },
        m(string, dateObject) {

            // If there's a string, then get the length of the digits
            // Otherwise return the selected month with 0index compensation.
            return string ? _.digits(string) : dateObject.month + 1;
        },
        mm(string, dateObject) {

            // If there's a string, then the length is always 2.
            // Otherwise return the selected month with 0index and leading zero.
            return string ? 2 : _.lead(dateObject.month + 1);
        },
        mmm(string, dateObject) {

            var collection = this.settings.monthsShort;

            // If there's a string, get length of the relevant month from the short
            // months collection. Otherwise return the selected month from that collection.
            return string ? getWordLengthFromCollection(string, collection, dateObject) : collection[dateObject.month];
        },
        mmmm(string, dateObject) {

            var collection = this.settings.monthsFull;

            // If there's a string, get length of the relevant month from the full
            // months collection. Otherwise return the selected month from that collection.
            return string ? getWordLengthFromCollection(string, collection, dateObject) : collection[dateObject.month];
        },
        yy(string, dateObject) {

            // If there's a string, then the length is always 2.
            // Otherwise return the selected year by slicing out the first 2 digits.
            return string ? 2 : ('' + dateObject.year).slice(2);
        },
        yyyy(string, dateObject) {

            // If there's a string, then the length is always 4.
            // Otherwise return the selected year.
            return string ? 4 : dateObject.year;
        },

        // Create an array by splitting the formatting string passed.
        toArray(formatString) { return formatString.split(/(d{1,4}|m{1,4}|y{4}|yy|!.)/g); },

        // Format an object into a string using the formatting options.
        toString(formatString, itemObject) {
            var calendar = this;
            return calendar.formats.toArray(formatString).map(function (label) {
                return _.trigger(calendar.formats[label], calendar, [0, itemObject]) || label.replace(/^!/, '');
            }).join('');
        },
    };
})(); // DatePicker.prototype.formats


/**
 * Check if two date units are the exact.
 */
DatePicker.prototype.isDateExact = function (one, two) {

    var calendar = this;

    // When we’re working with weekdays, do a direct comparison.
    if (
        (_.isInteger(one) && _.isInteger(two)) ||
        (typeof one == 'boolean' && typeof two == 'boolean')
     ) {
        return one === two;
    }

    // When we’re working with date representations, compare the “pick” value.
    if (
        (_.isDate(one) || $.isArray(one)) &&
        (_.isDate(two) || $.isArray(two))
    ) {
        return calendar.create(one).pick === calendar.create(two).pick;
    }

    // When we’re working with range objects, compare the “from” and “to”.
    if ($.isPlainObject(one) && $.isPlainObject(two)) {
        return calendar.isDateExact(one.from, two.from) && calendar.isDateExact(one.to, two.to);
    }

    return false;
};


/**
 * Check if two date units overlap.
 */
DatePicker.prototype.isDateOverlap = function (one, two) {

    var calendar = this,
        firstDay = calendar.settings.firstDay ? 1 : 0;

    // When we’re working with a weekday index, compare the days.
    if (_.isInteger(one) && (_.isDate(two) || $.isArray(two))) {
        one = one % 7 + firstDay;
        return one === calendar.create(two).day + 1;
    }
    if (_.isInteger(two) && (_.isDate(one) || $.isArray(one))) {
        two = two % 7 + firstDay;
        return two === calendar.create(one).day + 1;
    }

    // When we’re working with range objects, check if the ranges overlap.
    if ($.isPlainObject(one) && $.isPlainObject(two)) {
        return calendar.overlapRanges(one, two);
    }

    return false;
};


/**
 * Flip the “enabled” state.
 */
DatePicker.prototype.flipEnable = function (val) {
    var itemObject = this.item;
    itemObject.enable = val || (itemObject.enable == -1 ? 1 : -1);
};


/**
 * Mark a collection of dates as “disabled”.
 */
DatePicker.prototype.deactivate = function (type, datesToDisable) {

    var calendar = this,
        disabledItems = calendar.item.disable.slice(0);


    // If we’re flipping, that’s all we need to do.
    if (datesToDisable == 'flip') {
        calendar.flipEnable();
    }

    else if (datesToDisable === false) {
        calendar.flipEnable(1);
        disabledItems = [];
    }

    else if (datesToDisable === true) {
        calendar.flipEnable(-1);
        disabledItems = [];
    }

    // Otherwise go through the dates to disable.
    else {

        datesToDisable.map(function (unitToDisable) {

            var matchFound;

            // When we have disabled items, check for matches.
            // If something is matched, immediately break out.
            for (var index = 0; index < disabledItems.length; index += 1) {
                if (calendar.isDateExact(unitToDisable, disabledItems[index])) {
                    matchFound = true;
                    break;
                }
            }

            // If nothing was found, add the validated unit to the collection.
            if (!matchFound) {
                if (
                    _.isInteger(unitToDisable) ||
                    _.isDate(unitToDisable) ||
                    $.isArray(unitToDisable) ||
                    ($.isPlainObject(unitToDisable) && unitToDisable.from && unitToDisable.to)
                ) {
                    disabledItems.push(unitToDisable);
                }
            }
        });
    }

    // Return the updated collection.
    return disabledItems;
}; // DatePicker.prototype.deactivate


/**
 * Mark a collection of dates as “enabled”.
 */
DatePicker.prototype.activate = function (type, datesToEnable) {

    var calendar = this,
        disabledItems = calendar.item.disable,
        disabledItemsCount = disabledItems.length;

    // If we’re flipping, that’s all we need to do.
    if (datesToEnable == 'flip') {
        calendar.flipEnable();
    }

    else if (datesToEnable === true) {
        calendar.flipEnable(1);
        disabledItems = [];
    }

    else if (datesToEnable === false) {
        calendar.flipEnable(-1);
        disabledItems = [];
    }

    // Otherwise go through the disabled dates.
    else {

        datesToEnable.map(function (unitToEnable) {

            var matchFound,
                disabledUnit,
                index,
                isExactRange;

            // Go through the disabled items and try to find a match.
            for (index = 0; index < disabledItemsCount; index += 1) {

                disabledUnit = disabledItems[index];

                // When an exact match is found, remove it from the collection.
                if (calendar.isDateExact(disabledUnit, unitToEnable)) {
                    matchFound = disabledItems[index] = null;
                    isExactRange = true;
                    break;
                }

                // When an overlapped match is found, add the “inverted” state to it.
                else if (calendar.isDateOverlap(disabledUnit, unitToEnable)) {
                    if ($.isPlainObject(unitToEnable)) {
                        unitToEnable.inverted = true;
                        matchFound = unitToEnable;
                    }
                    else if ($.isArray(unitToEnable)) {
                        matchFound = unitToEnable;
                        if (!matchFound[3]) matchFound.push('inverted');
                    }
                    else if (_.isDate(unitToEnable)) {
                        matchFound = [unitToEnable.getFullYear(), unitToEnable.getMonth(), unitToEnable.getDate(), 'inverted'];
                    }
                    break;
                }
            }

            // If a match was found, remove a previous duplicate entry.
            if (matchFound) for (index = 0; index < disabledItemsCount; index += 1) {
                if (calendar.isDateExact(disabledItems[index], unitToEnable)) {
                    disabledItems[index] = null;
                    break;
                }
            }

            // In the event that we’re dealing with an exact range of dates,
            // make sure there are no “inverted” dates because of it.
            if (isExactRange) for (index = 0; index < disabledItemsCount; index += 1) {
                if (calendar.isDateOverlap(disabledItems[index], unitToEnable)) {
                    disabledItems[index] = null;
                    break;
                }
            }

            // If something is still matched, add it into the collection.
            if (matchFound) {
                disabledItems.push(matchFound);
            }
        });
    }

    // Return the updated collection.
    return disabledItems.filter(function (val) { return val != null; });
}; // DatePicker.prototype.activate


/**
 * Create a string for the nodes in the picker.
 */
DatePicker.prototype.nodes = function (isOpen) {

    var
        calendar = this,
        settings = calendar.settings,
        calendarItem = calendar.item,
        nowObject = calendarItem.now,
        selectedObject = calendarItem.select,
        highlightedObject = calendarItem.highlight,
        viewsetObject = calendarItem.view,
        disabledCollection = calendarItem.disable,
        minLimitObject = calendarItem.min,
        maxLimitObject = calendarItem.max,


        // Create the calendar table head using a copy of weekday labels collection.
        // * We do a copy so we don't mutate the original array.
        tableHead = (function (collection, fullCollection) {

            // If the first day should be Monday, move Sunday to the end.
            if (settings.firstDay) {
                collection.push(collection.shift());
                fullCollection.push(fullCollection.shift());
            }

            // Create and return the table head group.
            return _.node(
                'thead',
                _.node(
                    'tr',
                    _.group({
                        min: 0,
                        max: DAYS_IN_WEEK - 1,
                        i: 1,
                        node: 'th',
                        item(counter) {
                            return [
                                collection[counter],
                                settings.klass.weekdays,
                                'scope=col title="' + fullCollection[counter] + '"',
                            ];
                        },
                    })
                )
            ); // endreturn

        // Materialize modified
        })((settings.showWeekdaysFull ? settings.weekdaysFull : settings.weekdaysLetter).slice(0), settings.weekdaysFull.slice(0)), // tableHead


        // Create the nav for next/prev month.
        createMonthNav = function (next) {

            // Otherwise, return the created month tag.
            return _.node(
                'div',
                ' ',
                settings.klass['nav' + (next ? 'Next' : 'Prev')] + (

                    // If the focused month is outside the range, disabled the button.
                    (next && viewsetObject.year >= maxLimitObject.year && viewsetObject.month >= maxLimitObject.month) ||
                    (!next && viewsetObject.year <= minLimitObject.year && viewsetObject.month <= minLimitObject.month) ?
                    ' ' + settings.klass.navDisabled : ''
                ),
                'data-nav=' + (next || -1) + ' ' +
                _.ariaAttr({
                    role: 'button',
                    controls: calendar.$node[0].id + '_table',
                }) + ' ' +
                'title="' + (next ? settings.labelMonthNext : settings.labelMonthPrev) + '"'
            ); // endreturn
        }, // createMonthNav


        // Create the month label.
        // Materialize modified
        createMonthLabel = function (override) {

            var monthsCollection = settings.showMonthsShort ? settings.monthsShort : settings.monthsFull;

             // Materialize modified
            if (override == 'short_months') {
              monthsCollection = settings.monthsShort;
            }

            // If there are months to select, add a dropdown menu.
            if (settings.selectMonths  && override == undefined) {

                return _.node('select',
                    _.group({
                        min: 0,
                        max: 11,
                        i: 1,
                        node: 'option',
                        item(loopedMonth) {

                            return [

                                // The looped month and no classes.
                                monthsCollection[loopedMonth], 0,

                                // Set the value and selected index.
                                'value=' + loopedMonth +
                                (viewsetObject.month == loopedMonth ? ' selected' : '') +
                                (
                                    (
                                        (viewsetObject.year == minLimitObject.year && loopedMonth < minLimitObject.month) ||
                                        (viewsetObject.year == maxLimitObject.year && loopedMonth > maxLimitObject.month)
                                    ) ?
                                    ' disabled' : ''
                                ),
                            ];
                        },
                    }),
                    settings.klass.selectMonth + ' browser-default',
                    (isOpen ? '' : 'disabled') + ' ' +
                    _.ariaAttr({ controls: calendar.$node[0].id + '_table' }) + ' ' +
                    'title="' + settings.labelMonthSelect + '"'
                );
            }

            // Materialize modified
            if (override == 'short_months')
                if (selectedObject != null)
                return _.node('div', monthsCollection[selectedObject.month]);
                else return _.node('div', monthsCollection[viewsetObject.month]);

            // If there's a need for a month selector
            return _.node('div', monthsCollection[viewsetObject.month], settings.klass.month);
        }, // createMonthLabel


        // Create the year label.
        // Materialize modified
        createYearLabel = function (override) {

            var focusedYear = viewsetObject.year,

            // If years selector is set to a literal "true", set it to 5. Otherwise
            // divide in half to get half before and half after focused year.
            numberYears = settings.selectYears === true ? 5 : ~~(settings.selectYears / 2);

            // If there are years to select, add a dropdown menu.
            if (numberYears) {

                var
                    minYear = minLimitObject.year,
                    maxYear = maxLimitObject.year,
                    lowestYear = focusedYear - numberYears,
                    highestYear = focusedYear + numberYears;

                // If the min year is greater than the lowest year, increase the highest year
                // by the difference and set the lowest year to the min year.
                if (minYear > lowestYear) {
                    highestYear += minYear - lowestYear;
                    lowestYear = minYear;
                }

                // If the max year is less than the highest year, decrease the lowest year
                // by the lower of the two: available and needed years. Then set the
                // highest year to the max year.
                if (maxYear < highestYear) {

                    var availableYears = lowestYear - minYear,
                        neededYears = highestYear - maxYear;

                    lowestYear -= availableYears > neededYears ? neededYears : availableYears;
                    highestYear = maxYear;
                }

                if (settings.selectYears  && override == undefined) {
                    return _.node('select',
                        _.group({
                            min: lowestYear,
                            max: highestYear,
                            i: 1,
                            node: 'option',
                            item(loopedYear) {
                                return [

                                    // The looped year and no classes.
                                    loopedYear, 0,

                                    // Set the value and selected index.
                                    'value=' + loopedYear + (focusedYear == loopedYear ? ' selected' : ''),
                                ];
                            },
                        }),
                        settings.klass.selectYear + ' browser-default',
                        (isOpen ? '' : 'disabled') + ' ' + _.ariaAttr({ controls: calendar.$node[0].id + '_table' }) + ' ' +
                        'title="' + settings.labelYearSelect + '"'
                    );
                }
            }

            // Materialize modified
            if (override == 'raw')
                return _.node('div', focusedYear);

            // Otherwise just return the year focused
            return _.node('div', focusedYear, settings.klass.year);
        }; // createYearLabel


        // Materialize modified
        createDayLabel = function () {
                if (selectedObject != null)
                    return _.node('div', selectedObject.date);
                else return _.node('div', nowObject.date);
            };
        createWeekdayLabel = function () {
            var display_day;

            if (selectedObject != null)
                display_day = selectedObject.day;
            else
                display_day = nowObject.day;
            var weekday = settings.weekdaysFull[display_day];
            return weekday;
        };


    // Create and return the entire calendar.
return _.node(
        // Date presentation View
        'div',
            _.node(
                'div',
                createWeekdayLabel(),
                'picker__weekday-display'
            ) +
            _.node(
                // Div for short Month
                'div',
                createMonthLabel('short_months'),
                settings.klass.month_display
            ) +
            _.node(
                // Div for Day
                'div',
                createDayLabel(),
                settings.klass.day_display
            ) +
            _.node(
                // Div for Year
                'div',
                createYearLabel('raw'),
                settings.klass.year_display
            ),
        settings.klass.date_display
    ) +
    // Calendar container
    _.node('div',
        _.node('div',
        (settings.selectYears ?  createMonthLabel() + createYearLabel() : createMonthLabel() + createYearLabel()) +
        createMonthNav() + createMonthNav(1),
        settings.klass.header
    ) + _.node(
        'table',
        tableHead +
        _.node(
            'tbody',
            _.group({
                min: 0,
                max: WEEKS_IN_CALENDAR - 1,
                i: 1,
                node: 'tr',
                item(rowCounter) {

                    // If Monday is the first day and the month starts on Sunday, shift the date back a week.
                    var shiftDateBy = settings.firstDay && calendar.create([viewsetObject.year, viewsetObject.month, 1]).day === 0 ? -7 : 0;

                    return [
                        _.group({
                            min: DAYS_IN_WEEK * rowCounter - viewsetObject.day + shiftDateBy + 1, // Add 1 for weekday 0index
                            max() {
                                return this.min + DAYS_IN_WEEK - 1;
                            },
                            i: 1,
                            node: 'td',
                            item(targetDate) {

                                // Convert the time date from a relative date to a target date.
                                targetDate = calendar.create([viewsetObject.year, viewsetObject.month, targetDate + (settings.firstDay ? 1 : 0)]);

                                var isSelected = selectedObject && selectedObject.pick == targetDate.pick,
                                    isHighlighted = highlightedObject && highlightedObject.pick == targetDate.pick,
                                    isDisabled = disabledCollection && calendar.disabled(targetDate) || targetDate.pick < minLimitObject.pick || targetDate.pick > maxLimitObject.pick,
                                    formattedDate = _.trigger(calendar.formats.toString, calendar, [settings.format, targetDate]);

                                return [
                                    _.node(
                                        'div',
                                        targetDate.date,
                                        (function (klasses) {

                                            // Add the `infocus` or `outfocus` classes based on month in view.
                                            klasses.push(viewsetObject.month == targetDate.month ? settings.klass.infocus : settings.klass.outfocus);

                                            // Add the `today` class if needed.
                                            if (nowObject.pick == targetDate.pick) {
                                                klasses.push(settings.klass.now);
                                            }

                                            // Add the `selected` class if something's selected and the time matches.
                                            if (isSelected) {
                                                klasses.push(settings.klass.selected);
                                            }

                                            // Add the `highlighted` class if something's highlighted and the time matches.
                                            if (isHighlighted) {
                                                klasses.push(settings.klass.highlighted);
                                            }

                                            // Add the `disabled` class if something's disabled and the object matches.
                                            if (isDisabled) {
                                                klasses.push(settings.klass.disabled);
                                            }

                                            return klasses.join(' ');
                                        })([settings.klass.day]),
                                        'data-pick=' + targetDate.pick + ' ' + _.ariaAttr({
                                            role: 'gridcell',
                                            label: formattedDate,
                                            selected: isSelected && calendar.$node.val() === formattedDate ? true : null,
                                            activedescendant: isHighlighted ? true : null,
                                            disabled: isDisabled ? true : null,
                                        })
                                    ),
                                    '',
                                    _.ariaAttr({ role: 'presentation' }),
                                ]; // endreturn
                            },
                        }),
                    ]; // endreturn
                },
            })
        ),
        settings.klass.table,
        'id="' + calendar.$node[0].id + '_table' + '" ' + _.ariaAttr({
            role: 'grid',
            controls: calendar.$node[0].id,
            readonly: true,
        })
    )
    , settings.klass.calendar_container) // end calendar

     +

    // * For Firefox forms to submit, make sure to set the buttons’ `type` attributes as “button”.
    _.node(
        'div',
        _.node('button', settings.today, 'btn-flat picker__today',
            'type=button data-pick=' + nowObject.pick +
            (isOpen && !calendar.disabled(nowObject) ? '' : ' disabled') + ' ' +
            _.ariaAttr({ controls: calendar.$node[0].id })) +
        _.node('button', settings.clear, 'btn-flat picker__clear',
            'type=button data-clear=1' +
            (isOpen ? '' : ' disabled') + ' ' +
            _.ariaAttr({ controls: calendar.$node[0].id })) +
        _.node('button', settings.close, 'btn-flat picker__close',
            'type=button data-close=true ' +
            (isOpen ? '' : ' disabled') + ' ' +
            _.ariaAttr({ controls: calendar.$node[0].id })),
        settings.klass.footer
    ); // endreturn
}; // DatePicker.prototype.nodes


/**
 * The date picker defaults.
 */
DatePicker.defaults = (function (prefix) {

    return {

        // The title label to use for the month nav buttons
        labelMonthNext: 'Next month',
        labelMonthPrev: 'Previous month',

        // The title label to use for the dropdown selectors
        labelMonthSelect: 'Select a month',
        labelYearSelect: 'Select a year',

        // Months and weekdays
        monthsFull: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        weekdaysFull: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

        // Materialize modified
        weekdaysLetter: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],

        // Today and clear
        today: 'Today',
        clear: 'Clear',
        close: 'Close',

        // The format to show on the `input` element
        format: 'd mmmm, yyyy',

        // Classes
        klass: {

            table: prefix + 'table',

            header: prefix + 'header',


            // Materialize Added klasses
            date_display: prefix + 'date-display',
            day_display: prefix + 'day-display',
            month_display: prefix + 'month-display',
            year_display: prefix + 'year-display',
            calendar_container: prefix + 'calendar-container',
            // end


            navPrev: prefix + 'nav--prev',
            navNext: prefix + 'nav--next',
            navDisabled: prefix + 'nav--disabled',

            month: prefix + 'month',
            year: prefix + 'year',

            selectMonth: prefix + 'select--month',
            selectYear: prefix + 'select--year',

            weekdays: prefix + 'weekday',

            day: prefix + 'day',
            disabled: prefix + 'day--disabled',
            selected: prefix + 'day--selected',
            highlighted: prefix + 'day--highlighted',
            now: prefix + 'day--today',
            infocus: prefix + 'day--infocus',
            outfocus: prefix + 'day--outfocus',

            footer: prefix + 'footer',

            buttonClear: prefix + 'button--clear',
            buttonToday: prefix + 'button--today',
            buttonClose: prefix + 'button--close',
        },
    };
})(Picker.klasses().picker + '__');


/**
 * Extend the picker to add the date picker.
 */
Picker.extend('pickadate', DatePicker);


}));

(function ($) {

  var methods = {

    init(options) {
      var defaults = {
        time_constant: 200, // ms
        dist: -100, // zoom scale TODO: make this more intuitive as an option
        shift: 0, // spacing for center image
        padding: 0, // Padding between non center items
        full_width: false, // Change to full width styles
      };
      options = $.extend(defaults, options);

      return this.each(function () {

        var images, offset, center, pressed, dim, count,
            reference, referenceY, amplitude, target, velocity,
            xform, frame, timestamp, ticker, dragged, vertical_dragged;

        // Initialize
        var view = $(this);
        // Don't double initialize.
        if (view.hasClass('initialized')) {
          return true;
        }

        // Options
        if (options.full_width) {
          options.dist = 0;
          imageHeight = view.find('.carousel-item img').first().load(function () {
            view.css('height', $(this).height());
          });
        }

        view.addClass('initialized');
        pressed = false;
        offset = target = 0;
        images = [];
        item_width = view.find('.carousel-item').first().innerWidth();
        dim = item_width * 2 + options.padding;

        view.find('.carousel-item').each(function () {
          images.push($(this)[0]);
        });

        count = images.length;


        function setupEvents() {
          if (typeof window.ontouchstart !== 'undefined') {
            view[0].addEventListener('touchstart', tap);
            view[0].addEventListener('touchmove', drag);
            view[0].addEventListener('touchend', release);
          }
          view[0].addEventListener('mousedown', tap);
          view[0].addEventListener('mousemove', drag);
          view[0].addEventListener('mouseup', release);
          view[0].addEventListener('click', click);
        }

        function xpos(e) {
          // touch event
          if (e.targetTouches && (e.targetTouches.length >= 1)) {
            return e.targetTouches[0].clientX;
          }

          // mouse event
          return e.clientX;
        }

        function ypos(e) {
          // touch event
          if (e.targetTouches && (e.targetTouches.length >= 1)) {
            return e.targetTouches[0].clientY;
          }

          // mouse event
          return e.clientY;
        }

        function wrap(x) {
          return (x >= count) ? (x % count) : (x < 0) ? wrap(count + (x % count)) : x;
        }

        function scroll(x) {
          var i, half, delta, dir, tween, el, alignment, xTranslation;

          offset = (typeof x === 'number') ? x : offset;
          center = Math.floor((offset + dim / 2) / dim);
          delta = offset - center * dim;
          dir = (delta < 0) ? 1 : -1;
          tween = -dir * delta * 2 / dim;

          if (!options.full_width) {
            alignment = 'translateX(' + (view[0].clientWidth - item_width) / 2 + 'px) ';
            alignment += 'translateY(' + (view[0].clientHeight - item_width) / 2 + 'px)';
          } else {
            alignment = 'translateX(0)';
          }

          // center
          el = images[wrap(center)];
          el.style[xform] = alignment +
            ' translateX(' + (-delta / 2) + 'px)' +
            ' translateX(' + (dir * options.shift * tween * i) + 'px)' +
            ' translateZ(' + (options.dist * tween) + 'px)';
          el.style.zIndex = 0;
          if (options.full_width) { tweenedOpacity = 1; }
          else { tweenedOpacity = 1 - 0.2 * tween; }
          el.style.opacity = tweenedOpacity;
          half = count >> 1;

          for (i = 1; i <= half; ++i) {
            // right side
            if (options.full_width) {
              zTranslation = options.dist;
              tweenedOpacity = (i === half && delta < 0) ? 1 - tween : 1;
            } else {
              zTranslation = options.dist * (i * 2 + tween * dir);
              tweenedOpacity = 1 - 0.2 * (i * 2 + tween * dir);
            }
            el = images[wrap(center + i)];
            el.style[xform] = alignment +
              ' translateX(' + (options.shift + (dim * i - delta) / 2) + 'px)' +
              ' translateZ(' + zTranslation + 'px)';
            el.style.zIndex = -i;
            el.style.opacity = tweenedOpacity;


            // left side
            if (options.full_width) {
              zTranslation = options.dist;
              tweenedOpacity = (i === half && delta > 0) ? 1 - tween : 1;
            } else {
              zTranslation = options.dist * (i * 2 - tween * dir);
              tweenedOpacity = 1 - 0.2 * (i * 2 - tween * dir);
            }
            el = images[wrap(center - i)];
            el.style[xform] = alignment +
              ' translateX(' + (-options.shift + (-dim * i - delta) / 2) + 'px)' +
              ' translateZ(' + zTranslation + 'px)';
            el.style.zIndex = -i;
            el.style.opacity = tweenedOpacity;
          }

          // center
          el = images[wrap(center)];
          el.style[xform] = alignment +
            ' translateX(' + (-delta / 2) + 'px)' +
            ' translateX(' + (dir * options.shift * tween) + 'px)' +
            ' translateZ(' + (options.dist * tween) + 'px)';
          el.style.zIndex = 0;
          if (options.full_width) { tweenedOpacity = 1; }
          else { tweenedOpacity = 1 - 0.2 * tween; }
          el.style.opacity = tweenedOpacity;
        }

        function track() {
          var now, elapsed, delta, v;

          now = Date.now();
          elapsed = now - timestamp;
          timestamp = now;
          delta = offset - frame;
          frame = offset;

          v = 1000 * delta / (1 + elapsed);
          velocity = 0.8 * v + 0.2 * velocity;
        }

        function autoScroll() {
          var elapsed, delta;

          if (amplitude) {
            elapsed = Date.now() - timestamp;
            delta = amplitude * Math.exp(-elapsed / options.time_constant);
            if (delta > 2 || delta < -2) {
                scroll(target - delta);
                requestAnimationFrame(autoScroll);
            } else {
                scroll(target);
            }
          }
        }

        function click(e) {
          // Disable clicks if carousel was dragged.
          if (dragged) {
            e.preventDefault();
            e.stopPropagation();
            return false;

          } else if (!options.full_width) {
            var clickedIndex = $(e.target).closest('.carousel-item').index();
            var diff = (center % count) - clickedIndex;

            // Account for wraparound.
            if (diff < 0) {
              if (Math.abs(diff + count) < Math.abs(diff)) { diff += count; }

            } else if (diff > 0) {
              if (Math.abs(diff - count) < diff) { diff -= count; }
            }

            // Call prev or next accordingly.
            if (diff < 0) {
              $(this).trigger('carouselNext', [Math.abs(diff)]);

            } else if (diff > 0) {
              $(this).trigger('carouselPrev', [diff]);
            }
          }
        }

        function tap(e) {
          pressed = true;
          dragged = false;
          vertical_dragged = false;
          reference = xpos(e);
          referenceY = ypos(e);

          velocity = amplitude = 0;
          frame = offset;
          timestamp = Date.now();
          clearInterval(ticker);
          ticker = setInterval(track, 100);

        }

        function drag(e) {
          var x, delta, deltaY;
          if (pressed) {
            x = xpos(e);
            y = ypos(e);
            delta = reference - x;
            deltaY = Math.abs(referenceY - y);
            if (deltaY < 30 && !vertical_dragged) {
              // If vertical scrolling don't allow dragging.
              if (delta > 2 || delta < -2) {
                dragged = true;
                reference = x;
                scroll(offset + delta);
              }

            } else if (dragged) {
              // If dragging don't allow vertical scroll.
              e.preventDefault();
              e.stopPropagation();
              return false;

            } else {
              // Vertical scrolling.
              vertical_dragged = true;
            }
          }

          if (dragged) {
            // If dragging don't allow vertical scroll.
            e.preventDefault();
            e.stopPropagation();
            return false;
          }
        }

        function release(e) {
          pressed = false;

          clearInterval(ticker);
          target = offset;
          if (velocity > 10 || velocity < -10) {
            amplitude = 0.9 * velocity;
            target = offset + amplitude;
          }
          target = Math.round(target / dim) * dim;
          amplitude = target - offset;
          timestamp = Date.now();
          requestAnimationFrame(autoScroll);

          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        xform = 'transform';
        ['webkit', 'Moz', 'O', 'ms'].every(function (prefix) {
          var e = prefix + 'Transform';
          if (typeof document.body.style[e] !== 'undefined') {
            xform = e;
            return false;
          }
          return true;
        });


        window.onresize = scroll;

        setupEvents();
        scroll(offset);

        $(this).on('carouselNext', function (e, n) {
          if (n === undefined) {
            n = 1;
          }
          target = offset + dim * n;
          if (offset !== target) {
            amplitude = target - offset;
            timestamp = Date.now();
            requestAnimationFrame(autoScroll);
          }
        });

        $(this).on('carouselPrev', function (e, n) {
          if (n === undefined) {
            n = 1;
          }
          target = offset - dim * n;
          if (offset !== target) {
            amplitude = target - offset;
            timestamp = Date.now();
            requestAnimationFrame(autoScroll);
          }
        });

      });


    },
    next(n) {
      $(this).trigger('carouselNext', [n]);
    },
    prev(n) {
      $(this).trigger('carouselPrev', [n]);
    },
  };


    $.fn.carousel = function (methodOrOptions) {
      if (methods[methodOrOptions]) {
        return methods[methodOrOptions].apply(this, Array.prototype.slice.call(arguments, 1));
      } else if (typeof methodOrOptions === 'object' || !methodOrOptions) {
        // Default to "init"
        return methods.init.apply(this, arguments);
      } else {
        $.error('Method ' +  methodOrOptions + ' does not exist on jQuery.carousel');
      }
    }; // Plugin end
}(jQuery));
