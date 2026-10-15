import { mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import type { CoverStorePort } from "../../domain/catalogPorts";

/**
 * Stockage local des couvertures (`<dir>/<ean>.webp`). Idempotent : on ne
 * retélécharge pas une couverture déjà présente.
 */
export class CoverFileStore implements CoverStorePort {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private pathFor(ean: string): string {
    return join(this.dir, `${ean}.webp`);
  }

  async hasCover(ean: string): Promise<boolean> {
    if (!/^\d+$/.test(ean)) return false;
    return Bun.file(this.pathFor(ean)).exists();
  }

  async writeCover(ean: string, bytes: Uint8Array): Promise<void> {
    if (!/^\d+$/.test(ean)) throw new Error(`EAN invalide : ${ean}`);
    await mkdir(this.dir, { recursive: true });
    const target = this.pathFor(ean);
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await Bun.write(tmp, bytes);
    await rename(tmp, target);
  }
}
