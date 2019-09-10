// August 1st patch level
var MINIMUM_ANDROID_VERSION = new Date(2019, 8, 5);
var MINIMUM_IOS_VERSION = splitOSVersion("12.4.1");
var MINIMUM_CHROMEOS_VERSION = splitOSVersion("76.0.3809.102");

function checkOutdatedMobileDevice(device) {
  if (device.type == "ANDROID") {
    if (device.securityPatchLevel == "0") {
      return;
    }
    var version = new Date(parseFloat(device.securityPatchLevel));
    if (version < MINIMUM_ANDROID_VERSION) {
      return {name: device.email[0], version: version};
    }
  } else if (device.type == "IOS_SYNC") {
    if (device.os == "") {
      return;
    }
    var version = /iOS ([\d\.]+)/.exec(device.os);
    if (compareOSVersions(splitOSVersion(version[1]), MINIMUM_IOS_VERSION) < 0) {
      return {name: device.email[0], version: version[1]};
    }
  } else {
    return {error: "Unexpected type: " + device.type};
  }
}

function getAllOutdatedMobileDevices(customerId) {
  var pageToken;
  var results = [];
  var totalDevices = 0;
  do {
    var page = AdminDirectory.Mobiledevices.list(customerId, {
      maxResults: 100,
      pageToken: pageToken
    });
    for (var i = 0; i < page.mobiledevices.length; i++) {
      totalDevices++;
      var result = checkOutdatedMobileDevice(page.mobiledevices[i]);
      if (result) {
        results.push(result);
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken)
  return {totalDevices: totalDevices, results: results};
}

function splitOSVersion(v) {
  return v.split(".").map(function(c) { return parseInt(c); });
}

function compareOSVersions(v1, v2) {
  for (var i = 0; i < Math.min(v1.length, v2.length); i++) {
    if (v1[i] < v2[i]) {
      return -1;
    } else if (v1[i] > v2[i]) {
      return 1;
    }
  }

  if (v1.length != v2.length) {
    return -1;
  }

  return 0;
}

function checkOutdatedChromeOSDevice(device) {
  var version = splitOSVersion(device.osVersion);
  if (compareOSVersions(version, MINIMUM_CHROMEOS_VERSION) < 0) {
    return {name: device.annotatedUser, version: device.osVersion};
  }
}

function getAllOutdatedChromeOSDevices(customerId) {
  var pageToken;
  var results = [];
  var totalDevices = 0;
  do {
    var page = AdminDirectory.Chromeosdevices.list(customerId, {
      maxResults: 200,
      pageToken: pageToken,
      query: "status:ACTIVE",
    });
    if (page.chromeosdevices === undefined) {
      // ChromeOS devices are not enabled on this account.
      break;
    }
    for (var i = 0; i < page.chromeosdevices.length; i++) {
      totalDevices++;
      var result = checkOutdatedChromeOSDevice(page.chromeosdevices[i]);
      if (result) {
        results.push(result);
      }
    }
    pageToken = page.nextPageToken;
  } while (pageToken)
  return {totalDevices: totalDevices, results: results};
}

function getCustomerId(exampleUser) {
  var userKey = AdminDirectory.Users.get(exampleUser);
  return userKey.customerId;
}

function main() {
  var scriptProperties = PropertiesService.getScriptProperties()

  var customerId = getCustomerId(scriptProperties.getProperty("EXAMPLE_USER"));
  var outdatedMobileDevices = getAllOutdatedMobileDevices(customerId);
  var outdatedChromeOSDevices = getAllOutdatedChromeOSDevices(customerId);
  var messageBody = "";
  var errorBody = "";

  messageBody += "Found " + outdatedMobileDevices.totalDevices + " mobile devices.\n";
  if (outdatedMobileDevices.results.length > 0) {
    messageBody += "Outdated mobile devices owned by:\n";
    for (var i = 0; i < outdatedMobileDevices.results.length; i++) {
      if (outdatedMobileDevices.results[i].error) {
        errorBody += "- " + outdatedMobileDevices.results[i].error + "\n";
      } else {
        messageBody += "- " + outdatedMobileDevices.results[i].name + " (" + outdatedMobileDevices.results[i].version + ")\n";
      }
    }
  } else {
    messageBody += "No outdated mobile devices\n";
  }

  messageBody += "\nFound " + outdatedChromeOSDevices.totalDevices + " ChromeOS devices.\n";
  if (outdatedChromeOSDevices.results.length > 0) {
    messageBody += "Outdated ChromeOS devices owned by:\n";
    for (var i = 0; i < outdatedChromeOSDevices.results.length; i++) {
      messageBody += "- " + outdatedChromeOSDevices.results[i].name + " (" + outdatedChromeOSDevices.results[i].version + ")\n";
    }
  } else {
    messageBody += "No outdated ChromeOS devices\n";
  }

  var recipients = JSON.parse(scriptProperties.getProperty("REPORT_RECIPIENTS"));
  MailApp.sendEmail({
    to: recipients[0],
    cc: recipients.slice(1).join(","),
    subject: "Device OS report",
    body: messageBody + errorBody
  });
}
