const fs = require("fs");

const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");

fs.writeFileSync("./private.pem", privateKey);

process.env.PRIVATE_KEY_PATH = "./private.pem";

require("./hunter");
