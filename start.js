const fs = require("fs");

const privateKey = process.env.OCI_PRIVATE_KEY;

fs.writeFileSync("./private.pem", privateKey);

process.env.PRIVATE_KEY_PATH = "./private.pem";

require("./hunter");
