const fs = require("fs");
const path = require("path");

const messagesDir = path.join(__dirname, "../messages");

const base = JSON.parse(
  fs.readFileSync(path.join(messagesDir, "en.json"), "utf-8")
);

const files = fs.readdirSync(messagesDir).filter((f) => f !== "en.json");

function mergeMissing(baseObj, targetObj) {
  for (const key in baseObj) {
    if (!(key in targetObj)) {
      targetObj[key] = baseObj[key]; // thêm key thiếu
    } else if (
      typeof baseObj[key] === "object" &&
      typeof targetObj[key] === "object"
    ) {
      mergeMissing(baseObj[key], targetObj[key]);
    }
  }
}

files.forEach((file) => {
  const filePath = path.join(messagesDir, file);

  const target = JSON.parse(
    fs.readFileSync(filePath, "utf-8")
  );

  mergeMissing(base, target);

  fs.writeFileSync(filePath, JSON.stringify(target, null, 2));

  console.log(`✅ Fixed ${file}`);
});