require("dotenv").config();

const fs = require("fs");

const common = require("oci-common");
const core = require("oci-core");
const identity = require("oci-identity");

const privateKey = fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8");
console.log("Region:", process.env.OCI_REGION);
console.log("REGION:", process.env.OCI_REGION);
console.log("COMPARTMENT:", process.env.OCI_COMPARTMENT_ID);
console.log("TENANCY:", process.env.OCI_TENANCY_OCID);
const provider = new common.SimpleAuthenticationDetailsProvider(
  process.env.OCI_TENANCY_OCID,
  process.env.OCI_USER_OCID,
  process.env.OCI_FINGERPRINT,
  privateKey,
  null,
  null,
  common.Region.fromRegionId(process.env.OCI_REGION),
);

const computeClient = new core.ComputeClient({
  authenticationDetailsProvider: provider,
});

const identityClient = new identity.IdentityClient({
  authenticationDetailsProvider: provider,
});

const region = common.Region.fromRegionId(process.env.OCI_REGION);

computeClient.region = region;
identityClient.region = region;

console.log("Compute endpoint:", computeClient.endpoint);
console.log("Identity endpoint:", identityClient.endpoint);

const compartmentId = process.env.OCI_COMPARTMENT_ID;

const shapeOptions = [
  { ocpus: 4, memoryInGBs: 24 },
  { ocpus: 3, memoryInGBs: 18 },
  { ocpus: 2, memoryInGBs: 12 },
  { ocpus: 1, memoryInGBs: 6 },
];

async function instanceExists() {
  const res = await computeClient.listInstances({
    compartmentId,
  });

  console.log("\nInstances found:");

  for (const i of res.items) {
    console.log({
      name: i.displayName,
      state: i.lifecycleState,
      shape: i.shape,
    });
  }

  const active = res.items.filter((i) => i.lifecycleState !== "TERMINATED");

  console.log("Active count:", active.length);

  return active.length > 0;
}

async function a1InstanceExists() {
  const res = await computeClient.listInstances({
    compartmentId,
  });

  const a1Instances = res.items.filter(
    (i) =>
      i.lifecycleState !== "TERMINATED" && i.shape === "VM.Standard.A1.Flex",
  );

  console.log(`Found ${a1Instances.length} active A1 instances`);

  return a1Instances.length > 0;
}

async function getAvailabilityDomains() {
  const ads = await identityClient.listAvailabilityDomains({
    compartmentId: process.env.OCI_TENANCY_OCID,
  });

  return ads.items;
}

async function findUbuntuImage() {
  const images = await computeClient.listImages({
    compartmentId,
    operatingSystem: "Canonical Ubuntu",
  });

  const ubuntu = images.items.sort(
    (a, b) => new Date(b.timeCreated) - new Date(a.timeCreated),
  )[0];

  return ubuntu.id;
}

async function launch(adName, shape, imageId) {
  const sshKey = fs
    .readFileSync(process.env.SSH_PUBLIC_KEY_PATH, "utf8")
    .trim();

  console.log("SSH KEY RAW:");
  console.log(JSON.stringify(sshKey));

  const details = {
    compartmentId,

    availabilityDomain: adName,

    displayName: `hunter-${Date.now()}`,

    shape: "VM.Standard.A1.Flex",

    shapeConfig: {
      ocpus: shape.ocpus,
      memoryInGBs: shape.memoryInGBs,
    },

    createVnicDetails: {
      subnetId: process.env.OCI_SUBNET_ID,

      assignPublicIp: true,
    },

    metadata: {
      ssh_authorized_keys: sshKey,
    },

    sourceDetails: {
      sourceType: "image",
      imageId,
    },
  };

  console.log(`Trying ${adName} ${shape.ocpus} OCPU ${shape.memoryInGBs}GB`);

  return computeClient.launchInstance({
    launchInstanceDetails: details,
  });

  //   return console.log("Launch test passed");
}

async function hunt() {
  console.log(`\n[${new Date().toISOString()}]`);

  if (await a1InstanceExists()) {
    console.log("Instance already exists.");

    process.exit(0);
  }

  const imageId = await findUbuntuImage();

  console.log("Ubuntu image found.");

  const ads = await getAvailabilityDomains();
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  for (const shape of shapeOptions) {
    for (const ad of ads) {
      try {
        const result = await launch(ad.name, shape, imageId);

        console.log("SUCCESS!");

        console.log(result.instance.id);

        process.exit(0);
      } catch (e) {
        console.error("Full error:");

        console.error({
          message: e.message,
          statusCode: e.statusCode,
          code: e.code,
          opcRequestId: e.opcRequestId,
        });

        await sleep(60000);
      }
    }
  }

  console.log("No capacity available.");
}

hunt().catch(console.error);
