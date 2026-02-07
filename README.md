<p align="center">
    <img src="https://raw.githubusercontent.com/imiakk/chorddb/refs/heads/main/assets/ChordDB%20logo.png">
</p>

![Built with Node.js](https://img.shields.io/badge/Built%20with-Node.js-green?logo=node.js&style=for-the-badge)
![Built with Axios](https://img.shields.io/badge/Built%20with-Axios-blue?logo=axios&style=for-the-badge)
![npm](https://img.shields.io/npm/v/chorddb?style=for-the-badge)

Chorddb is a simple, lightweight package which is a database like MongoDB which uses Discord as storage with encryption. It works with JSON data.

# Docs

### **1.1 Installation**

#### Install with npm

```
npm install chorddb
```

### **1.2 Importing ChordDB**

#### Working with ChordDB

Start by importing ChordDB

```js
const { UDB } = require("chorddb");
```

### **1.3 Initialize**

#### Define Values for ChordDB

```js
const db = new UDB("TOKEN", "ENCRYPTION_KEY", "CHANNEL_ID");
```

**IMPORTANT:** Be sure to call your DB and start it by:

```js
db.start();
```

### **1.4 Functions**

- **write(data):** To write data to the channel. Returns true / false.
- **read():** To read all the data in the channel. Returns data / false.
- **find(identifier):** Takes a list, [KEY, VALUE]. Returns data / false.
- **edit(identifier, modification):** Takes a list, [KEY, VALUE] to find, Another list to change value [KEY, VALUE]. Returns true / false.

### **1.5 Example usage**

```js
const { UDB } = require("chorddb");

const db = new UDB("YOUR_DISCORD_TOKEN", "ENCRYPTION_KEY", "CHANNEL_ID");

(async () => {
  await db.start();

  const writeSuccess = await db.write({
    key: "user123",
    name: "Someone",
    coins: 100,
  });
  console.log("Write successful?", writeSuccess);

  const user = await db.find({ key: "key", value: "user123" });
  console.log("Found user:", user);

  const editSuccess = await db.edit(["key", "user123"], ["coins", 150]);
  console.log("Edit successful?", editSuccess);

  const allData = await db.read();
  console.log("All data in DB:", allData);
})();
```

## Contributing & Bugs

For bugs & Contributing make a Pull Request and ill try to respond as fast as possible.

## Licence

[MIT Licence](LICENCE)
