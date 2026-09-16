const { MongoMemoryServer } = require("mongodb-memory-server");
const { execSync } = require("child_process");
const mongoose = require("mongoose");

(async () => {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri("safaricom_seed_check");
  const env = { ...process.env, MONGO_URI: uri };

  const runScript = (script, args) => {
    console.log(`\n--- running ${script} ${args.join(" ")} ---`);
    const out = execSync(`npx tsx ${script} -- ${args.join(" ")}`, {
      cwd: "/media/mbugua/hardcode/projects/backend_games",
      env,
      encoding: "utf8",
    });
    console.log(out);
  };

  const adminArgs = [
    "--org",
    "smoke-safaricom",
    "--org-name",
    "Smoke Safaricom",
    "--name",
    "Root Admin",
    "--email",
    "root@smoke.test",
    "--password",
    "correct-horse-battery",
  ];

  // Run twice to confirm idempotency (upsert, no duplicate-key errors)
  runScript("src/games/safaricom_ceo/scripts/seedAdmin.ts", adminArgs);
  runScript("src/games/safaricom_ceo/scripts/seedAdmin.ts", adminArgs);

  runScript("src/games/safaricom_ceo/scripts/seedContent.ts", ["--org", "smoke-safaricom"]);
  runScript("src/games/safaricom_ceo/scripts/seedContent.ts", ["--org", "smoke-safaricom"]);

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const admins = await db.collection("safaricom_ceo_admins").find({}).toArray();
  const questions = await db.collection("safaricom_ceo_questions").find({}).toArray();
  const profiles = await db.collection("safaricom_ceo_profiles").find({}).toArray();
  const orgs = await db.collection("organizations").find({}).toArray();

  console.log("\n=== RESULTS ===");
  console.log("orgs:", orgs.length, orgs.map((o) => o.slug));
  console.log("admins:", admins.length, admins.map((a) => ({ email: a.email, role: a.role })));
  console.log("questions:", questions.length);
  questions.forEach((q) => {
    console.log(" -", q.dimension, "isActive:", q.isActive, "options:", q.options.length, q.options.map((o) => o.level).sort());
  });
  console.log("profiles:", profiles.length, profiles.map((p) => p.code));

  await mongoose.disconnect();
  await mongoServer.stop();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
