const express = require("express");

const db = require("./dbConnectExec.js");
const app = express();

app.listen(5000, () => {
  console.log("app is running on port 5000");
});

app.get("/hi", (req, res) => {
  res.send("hello world");
});

app.get("/", (req, res) => {
  res.send("API is running");
});

// app.post()
// app.put()

app.get("/chores", (req, res) => {
  //get data from the database
  db.executeQuery(
    `SELECT *
  FROM Chore
  LEFT JOIN Roommate
  ON Roommate.RoommatePK = Chore.RoommateFK`
  )
    .then((theResults) => {
      res.status(200).send(theResults);
    })
    .catch((nyError) => {
      console.log(myError);
      res.status(500).send();
    });
});
