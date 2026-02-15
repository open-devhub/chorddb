import { Chord, getKey } from "../dist/index.js";
import "dotenv/config";

const chord = new Chord({
	token: process.env["TOKEN"] || "",
	key: getKey(process.env["KEY"] || ""),
	algorithm: "aes-256-gcm",
	collections: [{ name: "users", channelId: "1469950194329194707" }],
});

const users = chord.collect("users");

let user = await users.create({
	username: "someone",
	coins: 100,
});

console.log(`User ${user.username} (${user.id}) created`);

let user2 = await users.create({
	username: "someone else",
	coins: 1000,
});

console.log(`User ${user2.username} (${user2.id}) created`);

const richUsers = await users.findBy((doc) => doc["coins"] > 500);

console.log(`There are ${richUsers.length} rich users`);

await users.updateBy(
	{ username: "someone" },
	{
		$inc: { coins: 50 },
		$set: { premium: true },
	},
);

const allUsers = await users.findAll();

console.log(allUsers);
