"use strict";

const app = require("./app");
const config = require("./config");
const firebase = require("firebase-admin");
var serviceAccount = require(`${__dirname}/serviceAccountKey.json`);
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: config.firebaseUrl,
});
var db = firebase.database();
var dbRefs_Updates = [];
var recepients = [];

function readFromFirebase(country_name) {
  return new Promise((resolve, reject) => {
    var resultMessage = "";
    var stats = {};
    //let regex = /(\d+\,?\d*\.?\d*)/g;
    try {
      if (firebase.apps.length == 0) {
        firebase.initializeApp({
          databaseURL: config.firebaseUrl,
        });
      }
      var dbRef = db.ref(country_name);
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
                    ${stats.country}
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
  try {
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }
    dbRefs_Updates = [];
    recepients.map((sub) => {
      dbRefs_Updates.push(db.ref(sub.country));
    });
    console.log(`watching ${dbRefs_Updates.length} coutries for updates`);
    var old_val_cases;
    var old_val_recovered;
    var old_val_deaths;
    var new_val_cases;
    var new_val_recovered;
    var new_val_deaths;

    if (dbRefs_Updates) {
      dbRefs_Updates.forEach((dbRef) => {
        // Get the data on a post that has changed
        dbRef.on("child_changed", (snapshot) => {
          let updated_country = snapshot.ref.path.pieces_[0].trim();
          console.log(`new update detected for country: ${updated_country}`);
          //console.log(subs);
          if (
            snapshot.key === "total_cases" ||
            snapshot.key === "total_deaths" ||
            snapshot.key === "total_recovered"
          ) {
            if (snapshot.key === "total_cases") {
              old_val_cases = new_val_cases;
              new_val_cases = snapshot.val();
            } else if (snapshot.key === "total_deaths") {
              old_val_deaths = new_val_deaths;
              new_val_deaths = snapshot.val();
            } else if (snapshot.key === "total_recovered") {
              old_val_recovered = new_val_recovered;
              new_val_recovered = snapshot.val();
            }
            if (
              old_val_cases != new_val_cases ||
              old_val_recovered != new_val_recovered ||
              old_val_deaths != new_val_deaths
            ) {
              let user_subs = recepients.filter(
                (sub) => sub.country == updated_country
              );
              user_subs.map(async (sub) => {
                console.log(sub);
                app.send_stats(sub.userid, updated_country);
              });
            }
          }
        });
      });
    }
  } catch (error) {
    console.log(error);
  }
}
function readCountries() {
  return new Promise((resolve, reject) => {
    var countries = [];
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }
    var dbRef = db.ref();

    dbRef
      .once("value", function (snapshot) {
        snapshot.forEach((node) => {
          if (
            node.child("total_cases").val() &&
            parseFloat(node.child("total_cases").val().replace(",", "")) > 0
          ) {
            countries.push(node.key);
          }
        });
      })
      .then(() => resolve(countries))
      .catch(() => reject(countries));
  });
}

function get_users() {
  return new Promise((resolve, reject) => {
    var countries = [];
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }
    var dbRef = db.ref("/0_subs");

    dbRef
      .once("value", function (snapshot) {
        snapshot.forEach((node) => {
          //console.log(node.val());
          recepients.push(node.val());
        });
      })
      .then(() => resolve(recepients))
      .catch(() => reject(recepients));
  });
}

function add_user(user_id, country) {
  try {
    var addUserRef = firebase
      .database()
      .ref("0_subs/" + user_id)
      .set({
        userid: user_id,
        country: country,
      })
      .then(() => {
        console.log(
          `New subscriber saved: user id [${user_id}], country [${country}]`
        );
      });
  } catch (error) {
    console.log(error);
  }
}

exports.add_user = add_user;
exports.get_users = get_users;
exports.readCountries = readCountries;
exports.readFirebaseUpdates = readFirebaseUpdates;
exports.readFromFirebase = readFromFirebase;
