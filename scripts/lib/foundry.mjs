// Encuentra los binarios de Foundry (forge, anvil, cast) en Windows, Linux, macOS o WSL.
// Orden: $FOUNDRY_BIN → PATH → ~/.foundry/bin → Foundry instalado dentro de WSL.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RAIZ } from "./entorno.mjs";

const EXE = process.platform === "win32" ? ".exe" : "";

function enPath(nombre) {
  const r = spawnSync(process.platform === "win32" ? "where" : "which", [nombre], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}

/** @returns {{ cmd: string, prefijo: string[], wsl: boolean }} */
export function binario(nombre) {
  const candidatos = [
    process.env.FOUNDRY_BIN && path.join(process.env.FOUNDRY_BIN, nombre + EXE),
    enPath(nombre),
    path.join(os.homedir(), ".foundry", "bin", nombre + EXE),
  ].filter(Boolean);
  for (const c of candidatos) if (fs.existsSync(c)) return { cmd: c, prefijo: [], wsl: false };

  if (process.platform === "win32") {
    const r = spawnSync("wsl", ["-e", "bash", "-lc", `test -x ~/.foundry/bin/${nombre} && echo ok`], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.includes("ok")) {
      return { cmd: "wsl", prefijo: ["-e", "bash", "-lc", `~/.foundry/bin/${nombre} "$@"`, nombre], wsl: true };
    }
  }
  throw new Error(
    `No encuentro "${nombre}" de Foundry.\n` +
      "  Instálalo: https://book.getfoundry.sh/getting-started/installation\n" +
      "  (Windows sin WSL: descarga el .zip de https://github.com/foundry-rs/foundry/releases y\n" +
      "   define FOUNDRY_BIN con la carpeta donde quedaron forge.exe, anvil.exe y cast.exe)",
  );
}

/** Corre un binario de Foundry heredando la consola. Resuelve con el código de salida. */
export function correr(nombre, args, opciones = {}) {
  const b = binario(nombre);
  return new Promise((resolve) => {
    const hijo = spawn(b.cmd, [...b.prefijo, ...args], { cwd: RAIZ, stdio: "inherit", ...opciones });
    hijo.on("exit", (code) => resolve(code ?? 1));
  });
}

/** Corre y devuelve la salida (stdout) como texto. */
export function salida(nombre, args) {
  const b = binario(nombre);
  const r = spawnSync(b.cmd, [...b.prefijo, ...args], { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`${nombre} ${args.join(" ")} falló:\n${r.stderr || r.stdout}`);
  return r.stdout.replace(/\0/g, "");
}
