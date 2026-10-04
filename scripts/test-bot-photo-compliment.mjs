import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync("lib/ai/conversation-style.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports, require: () => undefined });

const reply = (message, generated) => exports.polishBotReply(generated, [{ role: "user", content: message }], "photo-test");
assert.equal(reply("Resmin çok güzel", "Ben sadece metin okuyabilirim, resimleri göremem."), "Teşekkür ederim, beğenmene sevindim.");
assert.equal(reply("Fotoğrafını beğendim", "Görseli inceleyemem ama teşekkürler."), "Teşekkür ederim, beğenmene sevindim.");
assert.equal(reply("Fotoğrafında hangi hayvan var?", "Görseli inceleyemem."), "Görseli inceleyemem.");
console.log("Bot fotoğraf iltifatı kontrolü geçti.");
