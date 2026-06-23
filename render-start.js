const fs = require("fs");

fs.writeFileSync("./private.pem", process.env.OCI_PRIVATE_KEY);

process.env.PRIVATE_KEY_PATH = "./private.pem";

require("./hunter");
