"use strict";

const request = require("request");
const camelCase = require("camelcase");
const config = require("./config");

var userProfile = {};

async function getUserProfile(senderID) {
  try {
    userProfile = await callUserProfileAPI(senderID);

    for (const key in userProfile) {
      const camelizedKey = camelCase(key);
      const value = userProfile[key];
      delete userProfile[key];
      userProfile[camelizedKey] = value;
    }

    return userProfile;
  } catch (err) {
    console.log("Fetch failed:", err);
  }
}
function callUserProfileAPI(senderID) {
  return new Promise(function (resolve, reject) {
    let body = [];

    // Send the HTTP request to the Graph API
    request({
      uri: `${config.mPlatfom}/${senderID}`,
      qs: {
        access_token: config.pageAccesToken,
        fields: "first_name, last_name",
      },
      method: "GET",
    })
      .on("response", function (response) {
        // console.log(response.statusCode);

        if (response.statusCode !== 200) {
          reject(Error(response.statusCode));
        }
      })
      .on("data", function (chunk) {
        body.push(chunk);
      })
      .on("error", function (error) {
        console.error("Unable to fetch profile:" + error);
        reject(Error("Network Error"));
      })
      .on("end", () => {
        body = Buffer.concat(body).toString();
        // console.log(JSON.parse(body));

        resolve(JSON.parse(body));
      });
  });
}
exports.getUserProfile = getUserProfile;
exports.userProfile = userProfile;
