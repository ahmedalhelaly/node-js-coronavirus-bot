"use strict";

// Imports dependencies and set up http server
const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const app = express().use(bodyParser.json()); // creates express http server
const firebase = require("firebase");
const user_subs = require("./user_subs");
const config = require("./config");

var user_sub = new user_subs();
var subs = [];
var country_list = [];
var msg_text;
var sender_id;

subs = user_sub.get_recepients();

async function get_countries() {
  country_list = await getCountries().then((countries) => countries);
  //console.log(country_list);
}

// List all countries once application started from firebase
get_countries();

// Hook firebase updates to be sent according to recepients.json
readFirebaseUpdates();

// Sets server port and logs message on success
app.listen(process.env.PORT || config.port, () =>
  console.log("webhook is listening")
);

async function send_stats(sender_id, country) {
  try {
    let result = await readFromFirebase(country).then((msg) => msg);
    //console.log(result);
    sendMessage(sender_id, result);
  } catch (error) {
    console.log(error);
  }
}

// Adds support for GET requests to our webhook
app.get("/webhook", (req, res) => {
  // Your verify token. Should be a random string.
  let VERIFY_TOKEN = config.pageAccesToken;

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === "subscribe" && token === config.verifyToken) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      console.log("WEBHOOK VERIFICATION FAILED");
      res.sendStatus(403);
    }
  }
});

// Creates the endpoint for our webhook
app.post("/webhook", (req, res) => {
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === "page") {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach((entry) => {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];

      if (webhook_event.message) {
        msg_text = webhook_event.message.text.trim().toLowerCase();
        sender_id = webhook_event.sender.id;
        if (msg_text && sender_id) {
          //console.log(`New message received: ${msg_text} from: ${sender_id}`);
          if (country_list && country_list.includes(msg_text)) {
            user_sub.add_user(sender_id, msg_text);
            send_stats(sender_id, msg_text);
          }
          //sendMessage(sender_id, msg_text);
          //console.log(`New message sent: ${msg_text} to: ${sender_id}`);
        }
      }
      if ("read" in webhook_event) {
        // console.log("Got a read event");
        return;
      }

      if ("delivery" in webhook_event) {
        // console.log("Got a delivery event");
        return;
      }
      //console.log(webhook_event);
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

function sendMessage(recipientId, message) {
  request({
    messaging_type: "RESPONSE",
    url:
      "https://graph.facebook.com/v3.2/me/messages?access_token=" +
      config.pageAccesToken,
    method: "POST",
    json: true,
    json: {
      recipient: {
        id: recipientId,
      },
      message: {
        text: message,
      },
    },
    function(error, response, body) {
      if (error) {
        // console.log('Error sending message: ', error);
      } else if (response.body.error) {
        // console.log('Error: ', response.body.error);
      }
    },
  });
  console.log(`New message sent: ${message} to: ${sender_id}`);
}
function readFromFirebase(country_name) {
  return new Promise((resolve, reject) => {
    var resultMessage = "";
    var stats = {};
    let regex = /(\d+\,?\d*\.?\d*)/g;
    try {
      if (firebase.apps.length == 0) {
        firebase.initializeApp({
          databaseURL: config.firebaseUrl,
        });
      }
      var dbRef = firebase.database().ref(country_name);
      dbRef
        .once("value", function (snapshot) {
          stats = {
            country: snapshot.child("country").val(),
            active_cases: snapshot.child("active_cases").val(),
            critical_cases: snapshot.child("critical_cases").val(),
            last_updated: snapshot.child("last_updated").val(),
            new_cases: snapshot.child("new_cases").val(),
            new_deaths: snapshot.child("new_deaths").val(),
            total_cases: snapshot.child("total_cases").val(),
            total_deaths: snapshot.child("total_deaths").val(),
            total_recovered: snapshot.child("total_recovered").val(),
            total_tests: snapshot.child("total_tests").val(),
          };
          resultMessage = `
              Country: ${stats.country}
    ............................................
      Total cases = ${stats.total_cases}
      Total deaths = ${stats.total_deaths}
      Total recovered = ${stats.total_recovered}
      New cases = ${stats.new_cases}
      New deaths = ${stats.new_deaths}
      Active cases = ${stats.active_cases}
      Critical cases = ${stats.critical_cases}
      Total tests = ${stats.total_tests}
      Cases/Tests = ${(
        (parseFloat(stats.total_cases.replace(",", "")) /
          parseFloat(stats.total_tests.replace(",", ""))) *
        100
      ).toFixed(1)} %
                                                
    `;
          //console.log(resultMessage);
        })
        .then(() => resolve(resultMessage))
        .catch(() => reject(resultMessage));
    } catch (error) {
      console.log(error);
    }
  });
}
function readFirebaseUpdates() {
  var dbRefs = [];
  try {
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }
    subs.map((sub) => {
      dbRefs.push(firebase.database().ref(sub.country));
    });
    //console.log(dbRefs.length);

    if (dbRefs) {
      dbRefs.forEach((dbRef) => {
        // Get the data on a post that has changed
        dbRef.on("child_changed", (snapshot) => {
          let updated_country = snapshot.ref.path.pieces_[0].trim();
          console.log(`new update detected for country: ${updated_country}`);
          //let new_val = snapshot.val();
          let user_subs = subs.filter((sub) => sub.country == updated_country);
          user_subs.map(async (sub) => {
            console.log(sub);
            send_stats(sub.user_id, updated_country);
          });
        });
      });
    }
  } catch (error) {
    console.log(error);
  }
}
function getCountries() {
  return new Promise((resolve, reject) => {
    var countries = [];
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }
    var dbRef = firebase.database().ref();

    dbRef
      .once("value", function (snapshot) {
        snapshot.forEach((node) => {
          countries.push(node.key);
        });
      })
      .then(() => resolve(countries))
      .catch(() => reject(countries));
  });
}

function getStarted_Button(res) {
  var messageData = {
    get_started: [
      {
        payload: "GET_STARTED_PAYLOAD",
      },
    ],
  };

  // Start the request
  request(
    {
      url:
        "https://graph.facebook.com/v3.2/me/messages?access_token=" +
        config.pageAccesToken,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      form: messageData,
    },
    function (error, response, body) {
      if (!error && response.statusCode == 200) {
        // Print out the response body
        res.send(body);
      } else {
        // TODO: Handle errors
        res.send(body);
      }
    }
  );
}
