const jwt = require("jsonwebtoken");

const db = require("../dbConnectExec.js");
const roommateConfig = require("../config.js");

const auth = async (req, res, next) => {
  //   console.log("in the middleware", req.header("Authorization"));
  //   next();

  try {
    //1. decode token

    let myToken = req.header("Authorization").replace("Bearer ", "");
    // console.log("token", myToken);

    let decoded = jwt.verify(myToken, roommateConfig.JWT);
    console.log(decoded);

    let roommatePK = decoded.pk;

    //2. compare token with database

    let query = `SELECT RoommatePK, FirstName, LastName, Email, HouseholdFK
    FROM Roommate
    WHERE RoommatePK = ${roommatePK} AND Token = '${myToken}'`;

    let returnedUser = await db.executeQuery(query);
    console.log("returned user", returnedUser);

    //3. save user information in the request

    if (returnedUser[0]) {
      req.roommate = returnedUser[0];
      next();
    } else {
      return res.status(401).send("Invalid credentials");
    }
  } catch (err) {
    console.log(err);
    return res.status(401).send("Invalid credentials");
  }
};

module.exports = auth;
