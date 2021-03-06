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

app.get("/need/me", auth, async (req, res) => {
  //1. get the roommatePK
  let roommatePK = req.roommate.RoommatePK;
  console.log(roommatePK);

  //2. query the database for user's records
  let query = `SELECT *
  FROM Need
  LEFT JOIN Roommate
  ON Roommate.RoommatePK = Need.RoommateFK
  WHERE Roommate.RoommatePK = ${roommatePK}`;

  result = await db.executeQuery(query);

  res.send(result);

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
        HouseholdFK: user.HouseholdFK,
      },
    });
  } catch (myError) {
    console.log("error in setting user token", myError);
    res.status(500).send();
  }
});

// -------------------------------------------------------------------------------------------------
// CREATE NEW ROOMMATE
app.post("/roommate", async (req, res) => {
  // res.send("/roommate called");

  // console.log("request body", req.body);

  let nameFirst = req.body.nameFirst;
  let nameLast = req.body.nameLast;
  let phone = req.body.phone;
  let email = req.body.email;
  let password = req.body.password;
  let householdFK = req.body.householdCode;

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
  VALUES('${nameFirst}','${nameLast}','${phone}','${email}','${hashedPassword}','${householdFK}')`;

  db.executeQuery(insertQuery)
    .then(() => {
      res.status(201).send();
    })
    .catch((err) => {
      console.log("error in POST /Roommate", err);
      res.status(500).send();
    });
});

// -------------------------------------------------------------------------------------------------
// SEE ALL ROOMMATES
app.get("/myroommates", auth, async (req, res) => {
  let householdPK = req.roommate.HouseholdFK;
  db.executeQuery(
    `SELECT * FROM Roommate
WHERE Roommate.HouseholdFK = ${householdPK}`
  )
    .then((theResults) => {
      res.status(200).send(theResults);
    })
    .catch((myError) => {
      console.log(myError);
      res.status(500).send();
    });
});

// -------------------------------------------------------------------------------------------------
// GET ASSIGNMENT ON PARTICULAR CHORE
app.get("/chores/roommate", auth, async (req, res) => {
  //get data from the database
  let householdFK = req.roommate.HouseholdFK;
  let roommatePK = req.roommate.RoommatePK;
  db.executeQuery(
    `SELECT * FROM Chore
    WHERE Chore.HouseholdFK = ${householdFK} AND Chore.RoommateFK = ${roommatePK}`
  )
    .then((theResults) => {
      res.status(200).send(theResults);
    })
    .catch((myError) => {
      console.log(myError);
      res.status(500).send();
    });
});

// -------------------------------------------------------------------------------------------------
// GET ALL CHORES FOR SPECIFIED HOUSEHOLD
app.get("/chores/household", auth, async (req, res) => {
  // let pk = req.params.pk;
  // console.log("idk", req.params);
  //let pk = returnedUser.householdFK;
  // console.log("pk is:", pk);
  console.log("roommate", req.roommate.HouseholdFK);
  let myQuery = `SELECT * FROM Chore
  WHERE HouseholdFK = '${req.roommate.HouseholdFK}'`;

  db.executeQuery(myQuery)
    .then((result) => {
      // console.log("result", result);
      if (result[0]) {
        res.send(result);
        console.log("result", result);
      } else {
        res.status(404).send(`bad request`);
      }
    })
    .catch((err) => {
      console.log("Error in /chores", err);
      res.status(500).send();
    });
});

// app.get("/chores", (req, res) => {
//   //get data from the database
//   db.executeQuery(
//     `SELECT *
//   FROM Chore
//   LEFT JOIN Roommate
//   ON Roommate.RoommatePK = Chore.RoommateFK`
//   )
//     .then((theResults) => {
//       res.status(200).send(theResults);
//     })
//     .catch((nyError) => {
//       console.log(myError);
//       res.status(500).send();
//     });
// });

// -------------------------------------------------------------------------------------------------
// GET ALL CHORES FOR SPECIFIED ROOMMATE
// app.get("/chores/:pk", auth, async (req, res) => {
//   //let pk = req.params.pk;
//   //   console.log(pk);
//   let myQuery = `SELECT *
//     FROM Chore
//     LEFT JOIN Roommate
//     ON Roommate.RoommatePK = Chore.RoommateFK
//     WHERE RoommateFK = ${req.roommate.RoommatePK}`;

//   db.executeQuery(myQuery)
//     .then((result) => {
//       // console.log("result", result);
//       if (result[0]) {
//         res.send(result[0]);
//         console.log("result", result[0]);
//       } else {
//         res.status(404).send(`bad request`);
//       }
//     })
//     .catch((err) => {
//       console.log("Error in /chores/:pk", err);
//       res.status(500).send();
//     });
// });

app.get("/chores/:pk", (req, res) => {
  let pk = req.params.pk;
  //   console.log(pk);
  let myQuery = `SELECT *
    FROM Chore
    WHERE ChorePK = ${pk}`;

  db.executeQuery(myQuery)
    .then((result) => {
      console.log("result", result);
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

// -------------------------------------------------------------------------------------------------
// CREATE NEW ITEM NEED
app.post("/needcreate", auth, async (req, res) => {
  try {
    let item = req.body.item;

    if (!item) {
      return res.status(400).send("bad request");
    }

    item = item.replace("'", "''");
    // console.log("item", item);
    // console.log("here is the roommate", req.roommate);

    let insertQuery = `INSERT INTO Need(Item, RoommateFK, HouseholdFK)
    VALUES('${item}', ${req.roommate.RoommatePK}, ${req.roommate.HouseholdFK})`;

    let insertedNeed = await db.executeQuery(insertQuery);
    // console.log(insertedNeed);
    // res.send("here is the response");
    res.status(201).send(insertedNeed[0]);
  } catch (err) {
    console.log("error in POST /needcreate", err);
    res.status(500).send();
  }
});

// -------------------------------------------------------------------------------------------------
// CREATE NEW HOUSEHOLD
app.post("/createhousehold", async (req, res) => {
  try {
    let houseName = req.body.householdName;

    if (!houseName) {
      return res.status(400).send("bad request");
    }

    houseName = houseName.replace("'", "''");
    console.log("housename", houseName);

    let insertQuery = `INSERT INTO Household(HouseholdName, Address) 
    OUTPUT inserted.HouseholdPK, inserted.HouseholdName, inserted.Address
    VALUES('${houseName}', '${req.body.address}')`;

    let insertedHousehold = await db.executeQuery(insertQuery);
    console.log("inserted household", insertedHousehold);
    //res.send();
    res.status(201).send(insertedHousehold);
  } catch (err) {
    console.log("error in POST /createhousehold", err);
    res.status(500).send();
  }
});

// -------------------------------------------------------------------------------------------------
// Complete Chore
// app.post("/completechore", auth, async (req, res) => {
//   try {
//     let insertQuery = `INSERT INTO Household(HouseholdName, Address)
//     VALUES('${houseName}', ${req.body.address})`;

//     let insertedHousehold = await db.executeQuery(insertQuery);
//     console.log(insertedHousehold);
//     res.send("here is the response");
//     res.status(201).send(insertedHousehold[0]);
//   } catch (err) {
//     console.log("error in POST /createhousehold", err);
//     res.status(500).send();
//   }

// })

// -------------------------------------------------------------------------------------------------
// CREATE NEW CHORE
app.post("/chorecreate", auth, async (req, res) => {
  try {
    let chore = req.body.chore;
    let roommateAssignment = req.body.roommateAssignment;
    let choreDesc = req.body.choreDesc;
    let dueDate = req.body.dueDate;
    let roommateSelect = req.body.roommateSelect;

    if (
      !chore ||
      !roommateAssignment ||
      !choreDesc ||
      !dueDate ||
      !roommateSelect
    ) {
      return res.status(400).send("bad request");
    }

    chore = chore.replace("'", "''");
    roommateAssignment = roommateAssignment.replace("'", "''");
    choreDesc = choreDesc.replace("'", "''");
    dueDate = dueDate.replace("'", "''");
    roommateSelect = roommateSelect.replace("'", "''");
    // console.log("item", item);
    // console.log("here is the roommate", req.roommate);

    let insertQuery = `INSERT INTO Chore(Chore, AssignedTo, ChoreDescription, DueDate, Completion, RoommateFK, HouseholdFK)
    OUTPUT inserted.ChorePK, inserted.Chore, inserted.AssignedTo, inserted.ChoreDescription, inserted.DueDate, inserted.Completion, inserted.RoommateFK, inserted.HouseholdFK
    VALUES ('${chore}', '${roommateAssignment}', '${choreDesc}', '${dueDate}', 'No', '${roommateSelect}', '${req.roommate.HouseholdFK}')`;

    let insertedChore = await db.executeQuery(insertQuery);
    console.log("inserted chore", insertedChore);
    // res.send("here is the response");
    res.status(201).send(insertedChore);
  } catch (err) {
    console.log("error in POST /chorecreate", err);
    res.status(500).send();
  }
});

// -------------------------------------------------------------------------------------------------
// CREATE NEW CHORE
app.post("/completechore", auth, async (req, res) => {
  try {
    let chorePK = req.body.chorePK;
    let completedBy = req.body.completedBy;
    // console.log("item", item);
    // console.log("here is the roommate", req.roommate);

    let insertQuery = `Update Chore
    SET Completion = 'Yes'
    WHERE ChorePK = ${chorePK}
    UPDATE Chore
    SET CompletedBy = '${completedBy}' 
    WHERE ChorePK = ${chorePK};
    SELECT * FROM Chore WHERE ChorePK = ${chorePK};`;

    let updatedChore = await db.executeQuery(insertQuery);
    console.log("inserted chore", updatedChore);
    // res.send("here is the response");
    res.status(201).send(updatedChore);
  } catch (err) {
    console.log("error in POST /chorecreate", err);
    res.status(500).send();
  }
});
