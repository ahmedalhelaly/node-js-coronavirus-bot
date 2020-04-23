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
var recepients = [];
var dbRefs_Updates = [];

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
        Deaths/Cases = ${(
          (parseFloat(stats.total_deaths.replace(",", "")) /
            parseFloat(stats.total_cases.replace(",", ""))) *
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
async function readFirebaseUpdates() {
  try {
    if (dbRefs_Updates) {
      dbRefs_Updates.forEach((dbRef) => {
        dbRef.off("child_changed");
      });
    }
    dbRefs_Updates = [];

    // List all subscribers from firebase
    await get_subscribers();
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }

    recepients.map((sub) => {
      dbRefs_Updates.push(db.ref(sub.country));
    });

    var old_val_cases;
    var old_val_recovered;
    var old_val_deaths;
    var old_val_new_cases;
    var old_val_new_deaths;

    var new_val_cases;
    var new_val_recovered;
    var new_val_deaths;
    var new_val_new_cases;
    var new_val_new_deaths;

    if (dbRefs_Updates) {
      dbRefs_Updates.forEach((dbRef) => {
        // Get the data on a post that has changed
        console.log(
          `watching ${dbRefs_Updates.length} coutries for updates: ${dbRef.key}`
        );
        dbRef.on(
          "child_changed",
          (snapshot) => {
            //console.log(snapshot.val());
            let updated_country = snapshot.ref.path.pieces_[0].trim();
            //let updated_country = snapshot.child("country").val().trim();

            if (snapshot.key != "last_updated" && snapshot.key != "country") {
              if (snapshot.key === "total_cases") {
                old_val_cases = new_val_cases;
                new_val_cases = snapshot.val();
                console.log(
                  `new update detected for country: ${updated_country} value of ${snapshot.key}`
                );
              } else if (snapshot.key === "total_deaths") {
                old_val_deaths = new_val_deaths;
                new_val_deaths = snapshot.val();
                console.log(
                  `new update detected for country: ${updated_country} value of ${snapshot.key}`
                );
              } else if (snapshot.key === "total_recovered") {
                old_val_recovered = new_val_recovered;
                new_val_recovered = snapshot.val();
                console.log(
                  `new update detected for country: ${updated_country} value of ${snapshot.key}`
                );
              } else if (snapshot.key === "new_cases") {
                old_val_new_cases = new_val_new_cases;
                new_val_new_cases = snapshot.val();
                console.log(
                  `new update detected for country: ${updated_country} value of ${snapshot.key}`
                );
              } else if (snapshot.key === "new_deaths") {
                old_val_new_deaths = new_val_new_deaths;
                new_val_new_deaths = snapshot.val();
                console.log(
                  `new update detected for country: ${updated_country} value of ${snapshot.key}`
                );
              }
              if (
                old_val_cases != new_val_cases ||
                old_val_recovered != new_val_recovered ||
                old_val_deaths != new_val_deaths ||
                old_val_new_cases != new_val_new_cases ||
                old_val_new_deaths != new_val_new_deaths
              ) {
                let user_subs = recepients.filter(
                  (sub) => sub.country === updated_country
                );
                user_subs.map(async (sub) => {
                  console.log(sub);
                  app.send_stats(sub.userid, updated_country);
                });
              }
            }
          },
          function (error) {
            console.log(error);
          }
        );
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
      .once(
        "value",
        function (snapshot) {
          snapshot.forEach((node) => {
            if (
              node.child("total_cases").val() &&
              parseFloat(node.child("total_cases").val().replace(",", "")) > 0
            ) {
              countries.push(node.key);
            }
          });
        },
        function (error) {
          console.log(error);
        }
      )
      .then(() => resolve(countries))
      .catch(() => reject(countries));
  });
}

function get_users() {
  return new Promise((resolve, reject) => {
    if (firebase.apps.length == 0) {
      firebase.initializeApp({
        databaseURL: config.firebaseUrl,
      });
    }
    var dbRef = db.ref("/0_subs");
    dbRef
      .once("value", function (snapshot) {
        snapshot.forEach((node) => {
          //console.log(node.key);
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
      });
    addUserRef.then(() => {
      console.log(
        `New subscriber saved: user id [${user_id}], country [${country}]`
      );
    });
  } catch (error) {
    console.log(error);
  }
}

async function get_subscribers() {
  recepients = [];
  await get_users().then((recepients) => {
    recepients = recepients;
  });
  console.log(recepients);
}

exports.add_user = add_user;
exports.readCountries = readCountries;
exports.readFirebaseUpdates = readFirebaseUpdates;
exports.readFromFirebase = readFromFirebase;
