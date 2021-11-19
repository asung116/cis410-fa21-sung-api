const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./dbConnectExec.js");
const roommateConfig = require("./config.js");
const auth = require("./middleware/authenticate");

const app = express();
app.use(express.json());
//azurewebsites.net, colostate.edu
app.use(cors());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`app is running on port ${PORT}`);
});

app.get("/hi", (req, res) => {
  res.send("hello world");
});

app.get("/", (req, res) => {
  res.send("API is running");
});

// app.post()
// app.put()

app.post("/roommate/logout", auth, (req, res) => {
  let query = `UPDATE Roommate
  SET token = NULL
  WHERE RoommatePK = ${req.roommate.RoommatePK}`;
  db.executeQuery(query)
    .then(() => {
      res.status(200).send();
    })
    .catch((err) => {
      console.log("error in POST /roommate/logout", err);
      res.status(500).send();
    });
});

app.get("/needs/me", auth, async (req, res) => {
  //1. get the roommatePK
  //2. query the database for user's records
  //3. send user's reviews back to them
});

app.get("/roommate/me", auth, (req, res) => {
  res.send(req.roommate);
});

app.post("/roommate/login", async (req, res) => {
  // console.log("/roommate/login called", req.body);

  //1. data validation
  let email = req.body.email;
  let password = req.body.password;

  if (!email || !password) {
    return res.status(400).send("Bad request");
  }

  //2. check that user esits in DB
  let query = `SELECT * 
  FROM Roommate 
  WHERE email = '${email}'`;

  let result;
  try {
    result = await db.executeQuery(query);
  } catch (myError) {
    console.log("error in /roommate/login", myError);
    return res.status(500).send();
  }

  // console.log("result", result);

  if (!result[0]) {
    return res.status(401).send("Invalid user credentials");
  }

  //3. check password
  let user = result[0];
  if (!bcrypt.compareSync(password, user.Password)) {
    console.log("invalid password");
    return res.status(401).send("Invalid user credentials");
  }

  //4. generate token

  let token = jwt.sign({pk: user.RoommatePK}, roommateConfig.JWT, {
    expiresIn: "60 minutes",
  });

  console.log("token", token);

  //5. save token in DB and send response
  let setTokenQuery = `UPDATE Roommate
SET Token = '${token}'
WHERE RoommatePK = ${user.RoommatePK}`;

  try {
    await db.executeQuery(setTokenQuery);

    res.status(200).send({
      token: token,
      user: {
        FirstName: user.FirstName,
        LastName: user.LastName,
        Email: user.Email,
        RoommatePK: user.RoommatePK,
      },
    });
  } catch (myError) {
    console.log("error in setting user token", myError);
    res.status(500).send();
  }
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
  if (!nameFirst || !nameLast || !phone || !email || !password) {
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

  let hashedPassword = bcrypt.hashSync(password);

  // Insert new info to db
  let insertQuery = `INSERT INTO Roommate(FirstName, LastName, Phone, Email, Password,HouseholdFK)
  VALUES('${nameFirst}','${nameLast}','${phone}','${email}','${hashedPassword}','4')`;

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

//Create need
app.post("/need", auth, async (req, res) => {
  try {
    let item = req.body.item;

    if (!item) {
      return res.status(400).send("bad request");
    }

    item = item.replace("'", "''");
    // console.log("item", item);
    // console.log("here is the roommate", req.roommate);

    let insertQuery = `INSERT INTO Need(Item, HouseholdFK)
    OUTPUT inserted.NeedPK, inserted.Item
    VALUES('${item}', ${req.roommate.HouseholdFK})`;

    let insertedNeed = await db.executeQuery(insertQuery);
    // console.log(insertedNeed);
    // res.send("here is the response");
    res.status(201).send(insertedNeed[0]);
  } catch (err) {
    console.log("error in POST /need", err);
    res.status(500).send();
  }
});

// app.get("/need", async (req, res)=>{
//   let needPK = `SELECT NeedPK
//   FROM Need
//   WHERE Item = ${item} AND HouseholdFK = ${householdPK}`;
// })

// app.post("/needComp", async (req, res)=>{
//   try {
//     let item = req.body.item;
//     roommatePK = req.body.roommateFK;
//     householdPK = req.body.householdFK;

//     if (!item) {
//       return res.status(400).send("bad request");
//     }

//     item = item.replace("'", "''");
//     item = item.toLowerCase();
//     console.log("item", item);
//   } catch (err) {
//     console.log("error in POST /need", err);
//     res.status(500).send();
//   }
// })
