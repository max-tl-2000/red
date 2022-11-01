/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

/* eslint-disable */
var Aptexx = (function (){

  var SUCCESS_STATUS = 1;
  var CANCELED_STATUS = 3;

  var findUrlParameter = function (parameterName) {
    var parameter = null;
    var undecodedParamaters = [];

    location.search.substr(1).split('&').forEach(function (item) {
        undecodedParamaters = item.split('=');
        if (undecodedParamaters[0] === parameterName) {
          parameter = decodeURIComponent(undecodedParamaters[1]);
        }
    });
    return parameter;
  }

  var send = function (url, method, data) {
    return new Promise(function(resolve, reject) {
      var xmlHttpRequest = new XMLHttpRequest();
      xmlHttpRequest.open(method, url, true);

      xmlHttpRequest.onload = function() {
        if (xmlHttpRequest.status == 200) {
          var response = xmlHttpRequest.response ;
          resolve(JSON.parse(response || '{"status": 1}'));
        } else {
          reject(Error(xmlHttpRequest.statusText));
        }
      };
      xmlHttpRequest.onerror = function() {
        reject(Error('API Call Failed'));
      };
      xmlHttpRequest.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      xmlHttpRequest.send(data);
    });
  };

  var post = function (url, data) {
    var query = [];
    for (var key in data) {
      query.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
    return send(url, 'POST', query.join('&'));
  };

  var disableButtons = function(disable) {
    document.getElementById('btnReviewPayment').disabled = disable;
    document.getElementById('btnCancel').disabled = disable;
  };

  var invoiceId = findUrlParameter('invoiceId');

  var isNotButton = function (type) {
    return (type !== 'button' && type !== 'submit') ? true : false;
  };

  var getFormData = function(disable) {
    var form = document.getElementById('form');
    var inputs = form.getElementsByTagName('input');

    var formData = {};
    for(var i=0; i< inputs.length; i++){
      if (isNotButton(inputs[i].type)) {
        formData[inputs[i].name] = inputs[i].value;
      }
    }
    formData['expirationdate'] = document.getElementsByName('month')[0].value + '/'+ document.getElementsByName('year')[0].value;
    formData['invoiceId'] = invoiceId;
    return formData;
  };

  var verifyPayment = function(invoiceId, redirectUrl) {
    var tenantId = findUrlParameter('tenantId');
    var token = findUrlParameter('token');
    var personApplicationId = findUrlParameter('personApplicationId');
    var propertyId = findUrlParameter('propertyId');
    post('/api/webhooks/paymentNotification?token=' + token, { invoiceId, tenantId, personApplicationId, propertyId }).then(function onResponse(result) {
      if (result.status === SUCCESS_STATUS) {
        window.location.href = redirectUrl;
      }
    });
  };

  var handleSuccessPayment = function(formData, result) {
    if (formData.name === 'Missing Notification') {
      window.location.href = result.redirectUrl;
      return;
    }
    if (formData.name === 'Delay Notification') {
      setTimeout(function() { verifyPayment(formData.invoiceId, result.redirectUrl); }, 180000);
      return;
    }
    verifyPayment(formData.invoiceId, result.redirectUrl);
  };

  var submitPayment = function() {
    disableButtons(true);
    var formData = getFormData();

    post('/aptexx/simulatePayment', formData).then(function onResponse(result) {
      disableButtons(false);
      if (result.status === SUCCESS_STATUS) {
        handleSuccessPayment(formData, result);
      } else {
        document.getElementById('error-message').className = 'error-message';
      }
    });
  };


  var cancelPayment = function() {
    disableButtons(true);
    window.location = 'payment-cancel.html';
  };

  return {
    submitPayment: submitPayment,
    cancelPayment: cancelPayment,
  };

})();
