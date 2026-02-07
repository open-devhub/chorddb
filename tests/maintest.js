const { UDB } = require("../src/main");

const db = new UDB("TOKEN", "ENCRYPTION_KEY", "CHANNEL_ID");

db.start();

async function test() {
  console.log("\n--- TESTING WRITE ---");
  const testData = { id: 1, name: "Test Item", value: 100 };
  const writeResult = await db.write(testData);
  console.log("Write result:", writeResult);

  console.log("\n--- TESTING READ ---");
  const allData = await db.read();
  console.log("All data:", allData);

  console.log("\n--- TESTING FIND ---");
  const found = await db.find({ key: "id", value: 1 });
  console.log("Found item:", found);

  console.log("\n--- TESTING EDIT ---");
  const editResult = await db.edit(["id", 1], ["value", 200]);
  console.log("Edit result:", editResult);

  console.log("\n--- VERIFY EDIT ---");
  const verify = await db.find({ key: "id", value: 1 });
  console.log("Updated item:", verify);
}

test();

test().catch(console.error);
