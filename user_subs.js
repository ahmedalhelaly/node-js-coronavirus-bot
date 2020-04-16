"use strict";

const fs = require("fs");
const jPath = "./recepients.json";
var recepients = [];

module.exports = class {
  get_recepients() {
    if (fs.existsSync(jPath)) {
      recepients = require(jPath);
    }
    return recepients;
  }

  add_user(user_id, country) {
    try {
      let new_recepient = {};
      var data;
      new_recepient = { user_id: user_id, country: country };
      if (fs.existsSync(jPath)) {
        recepients = require(jPath);
        var user_ids = recepients.map((recepient) => recepient.user_id);
        if (!user_ids.includes(new_recepient.user_id)) {
          recepients.push(new_recepient);
          console.log("added new user.");
        } else {
          console.log("user already exists.");
          return;
        }
      } else {
        recepients.push(new_recepient);
        console.log("creating new json file.");
      }
      data = JSON.stringify(recepients);
      fs.writeFileSync("recepients.json", data);
      console.log("json file updated.");
    } catch (error) {
      console.log(error);
    }
  }
};
