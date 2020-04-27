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
        \t\t\t\t ${stats.country.toUpperCase()}
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
          (parseFloat(stats.total_cases.replace(/(\D*)/g, "")) /
            parseFloat(stats.total_tests.replace(/(\D*)/g, ""))) *
          100
        ).toFixed(1)} %
        Deaths/Cases = ${(
          (parseFloat(stats.total_deaths.replace(/(\D*)/g, "")) /
            parseFloat(stats.total_cases.replace(/(\D*)/g, ""))) *
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
    dbRefs_Updates.splice(0, dbRefs_Updates.length);

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
    var new_val_cases;

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

            if (snapshot.key === "total_cases") {
              old_val_cases = new_val_cases;
              new_val_cases = snapshot.val();
              console.log(
                `new update detected for country: ${updated_country} value of ${snapshot.key}`
              );

              if (old_val_cases != new_val_cases) {
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

function add_user(user_id, name, country) {
  try {
    var addUserRef = firebase
      .database()
      .ref("0_subs/" + user_id)
      .set({
        userid: user_id,
        name: name,
        country: country,
      });
    addUserRef.then(() => {
      console.log(
        `Subscriber data saved: user id [${user_id}], name [${name}], country [${country}]`
      );
    });
  } catch (error) {
    console.log(error);
  }
}

async function get_subscribers() {
  try {
    var subs = [];
    recepients.splice(0, recepients.length);
    subs = await get_users().then((subs) => subs);
    recepients = subs.filter(
      (elem, index, self) =>
        self.findIndex((t) => {
          return t.userid === elem.userid;
        }) === index
    );
    console.log(recepients);
  } catch (error) {
    console.log(error);
  }
}

exports.add_user = add_user;
exports.readCountries = readCountries;
exports.readFirebaseUpdates = readFirebaseUpdates;
exports.readFromFirebase = readFromFirebase;
exports.recepients = recepients;
exports.get_subscribers = get_subscribers;
