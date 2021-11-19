const bcrypt = require("bcryptjs");

let hashedPassword = bcrypt.hashSync("password");

console.log(hashedPassword);

let hashTest = bcrypt.compareSync("password", hashedPassword);

console.log(hashTest);
