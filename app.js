"use strict";

// Imports dependencies and set up http server
const express = require("express");
const request = require("request");
const bodyParser = require("body-parser");
const app = express().use(bodyParser.json()); // creates express http server
const config = require("./config");
const firebase = require("./firebase_conn");

var country_list = [];
var msg_text;
var sender_id;

// privacy policy page for facebook developers app publishing
app.get("/privacy_policy", (req, res) => {
  res.sendFile(`${__dirname}/privacy_policy.html`);
});

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

// List all countries from firebase
get_countries();

firebase.readFirebaseUpdates();

// Creates the endpoint for our webhook
app.post("/webhook", (req, res) => {
  let body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === "page") {
    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");

    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach((entry) => {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      let webhook_event = entry.messaging[0];
      //console.log(webhook_event);

      if ("read" in webhook_event) {
        // console.log("Got a read event");
        return;
      }

      if ("delivery" in webhook_event) {
        // console.log("Got a delivery event");
        return;
      }

      if (webhook_event.message) {
        //console.log(country_list);
        msg_text = webhook_event.message.text.trim().toLowerCase();
        sender_id = webhook_event.sender.id;
        if (msg_text && sender_id) {
          console.log(`New message received: ${msg_text} from: ${sender_id}`);
          if (country_list && country_list.includes(msg_text)) {
            send_stats(sender_id, msg_text);
            firebase.add_user(sender_id, msg_text);
            sendMessage(
              sender_id,
              `Your country has been updated to ${msg_text}.`
            );
            firebase.readFirebaseUpdates();
          } else if (msg_text === "get started") {
            sendMessageWithButton(
              sender_id,
              "Please, enter your country name to receive updates \n Or, you can choose from the list. \n",
              "country list",
              "COUNTRY_LIST"
            );
          } else if (msg_text === "country list") {
            sendCountries();
          } else {
            sendMessageWithButton(
              sender_id,
              "Sorry, try using Get Started button or type any country name.",
              "get started",
              "GET_STARTED"
            );
          }
        }
      }
      if (webhook_event.postback) {
        sender_id = webhook_event.sender.id;
        let postback = webhook_event.postback;
        // Check for the special Get Starded with referral
        let payload;
        if (postback.payload.startsWith("{")) {
          payload = postback.title.toLowerCase();
        } else {
          // Get the payload of the postback
          payload = postback.payload;
        }
        console.log("Received Payload:", `${payload}`);
        // Set the action based on the payload
        if (payload === "GET_STARTED" || payload === "get started") {
          sendMessageWithButton(
            sender_id,
            "Please, enter your country name to receive updates \n Or, you can choose from the list. \n",
            "country list",
            "COUNTRY_LIST"
          );
        } else if (payload === "COUNTRY_LIST") {
          sendCountries();
        }
      }
    });
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

async function get_countries() {
  country_list = await firebase.readCountries().then((countries) => countries);
  console.log(`${country_list.length} countries found in database`);
}

function sendCountries() {
  let countries = country_list.map((x) =>
    x.replace(/^\w/, (c) => c.toUpperCase())
  );

  let countries_part1 = `${countries.splice(0, 110).join("\r\n").trim()}`;
  let countries_part2 = `${countries.join("\r\n").trim()}`;
  //console.log(message_header + countries_part1 + countries_part2);
  sendMessage(sender_id, countries_part1);
  sendMessage(sender_id, countries_part2);
}

async function send_stats(sender_id, country) {
  try {
    let result = await firebase.readFromFirebase(country).then((msg) => msg);
    //console.log(result);
    sendMessage(sender_id, result);
  } catch (error) {
    console.log(error);
  }
}
function sendMessage(recipientId, message) {
  if (recipientId != "103691044616588") {
    request({
      url:
        "https://graph.facebook.com/v6.0/me/messages?access_token=" +
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
          console.log("Error sending message: ", error);
        } else if (response.body.error) {
          // console.log('Error: ', response.body.error);
        }
      },
    });
    console.log(`New message sent: ${message} to: ${recipientId}`);
  }
}

function sendMessageWithButton(
  recipientId,
  message,
  buttonText,
  buttonPayload
) {
  if (recipientId != "103691044616588") {
    request({
      url:
        "https://graph.facebook.com/v6.0/me/messages?access_token=" +
        config.pageAccesToken,
      method: "POST",
      json: true,
      json: {
        recipient: {
          id: recipientId,
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: message,
              buttons: [
                {
                  type: "postback",
                  title: buttonText,
                  payload: buttonPayload,
                },
              ],
            },
          },
        },
      },
      function(error, response, body) {
        if (error) {
          console.log("Error sending message: ", error);
        } else if (response.body.error) {
          // console.log('Error: ', response.body.error);
        }
      },
    });
    console.log(`New message sent: ${message} to: ${recipientId}`);
  }
}
// Sets server port and logs message on success
let port = process.env.PORT || config.port;
app.listen(port, () => console.log(`webhook is listening on port ${port}`));

exports.send_stats = send_stats;
