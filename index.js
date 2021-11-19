const express = require("express");
// const bcrypt = require("bcryptjs");

const db = require("./dbConnectExec.js");
const app = express();

app.use(express.json());

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

app.post("/roommate/login", async (req, res) => {
  console.log("/roommate/login called", res.body);
});

app.post("/roommate", async (req, res) => {
  // res.send("/roommate called");

  // console.log("request body", req.body);

  let nameFirst = req.body.nameFirst;
  let nameLast = req.body.nameLast;
  let phone = req.body.phone;
  let email = req.body.email;
  let password = req.body.password;

  //Check that all fields are filled, we must have complete info
  if (!nameFirst || !!nameLast || !phone || !email || !password) {
    return res.status(400).send("Bad request");
  }

  //Make sure that if there is a name like O'Neil the ' wont mess it up. Replaces one ' with two ''
  nameFirst = nameFirst.replace("'", "''");
  nameLast = nameLast.replace("'", "''");

  // Makre sure the email is not already in db
  let emailCheckQuery = `SELECT Email
  FROM Roommate
  WHERE Email = '${email}'`;

  let existingUser = await db.executeQuery(emailCheckQuery);

  // console.log("exising user", existingUser);

  if (existingUser[0]) {
    return res.status(409).send("Duplicate email");
  }

  // let hashedPassword = bcrypt.hashSync(password);

  // Insert new info to db
  let insertQuery = `INSERT INTO Roommate(FirstName, LastName, Phone, Email, Password,HouseholdFK)
  VALUES('${nameFirst}','${nameLast}','${phone}','${email}','${password}','4')`;

  db.executeQuery(insertQuery)
    .then(() => {
      res.status(201).send();
    })
    .catch((err) => {
      console.log("error in POST /Roommate", err);
      res.status(500).send();
    });
});

app.post("/chores", (req, res) => {});

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
    .catch((myError) => {
      console.log(myError);
      res.status(500).send();
    });
});

app.get("/chores/:pk", (req, res) => {
  let pk = req.params.pk;
  //   console.log(pk);
  let myQuery = `SELECT *
    FROM Chore
    LEFT JOIN Roommate
    ON Roommate.RoommatePK = Chore.RoommateFK
    WHERE ChorePK = ${pk}`;

  db.executeQuery(myQuery)
    .then((result) => {
      // console.log("result", result);
      if (result[0]) {
        res.send(result[0]);
      } else {
        res.status(404).send(`bad request`);
      }
    })
    .catch((err) => {
      console.log("Error in /chores/:pk", err);
      res.status(500).send();
    });
});
