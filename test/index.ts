import { Chord, getKey } from "../dist/index.js";
import "dotenv/config";

const chord = new Chord({
	token: process.env["TOKEN"] || "",
	key: getKey(process.env["KEY"] || ""),
	algorithm: "aes-256-gcm",
	collections: [{ name: "users", channelId: "1469950194329194707" }],
});

const users = chord.collect("users");

let user = await users.insertOne({
	username: "someone",
	coins: 100,
});

console.log(`User ${user.username} (${user.id}) created`);

let moreUsers = await users.insertMany([
	{ username: "someone else", coins: 200 },
	{ username: "another user", coins: 300 },
]);

moreUsers.forEach((user) => {
	console.log(`User ${user.username} (${user.id}) created`);
});

const richUsers = await users.find((doc) => doc["coins"] > 500);

console.log(`There are ${richUsers.length} rich users`);

await users.updateOne(
	{ username: "someone" },
	{
		$inc: { coins: 50 },
		$set: { premium: true },
	},
);

await users.updateMany((doc) => doc["coins"] < 300, {
	$dec: { coins: 20 },
});

const allUsers = await users.findAll();

console.log(allUsers);
