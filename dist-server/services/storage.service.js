import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env.js';
class StorageService {
    localPath;
    legacyLocalPath;
    constructor() {
        this.localPath = path.resolve(process.cwd(), env.STORAGE_CONFIG.LOCAL_PATH);
        this.legacyLocalPath = path.resolve(process.cwd(), 'uploads/tickets');
    }
    resolveLocalPath(caminho) {
        const fullPath = path.resolve(caminho);
        for (const allowedPath of [this.localPath, this.legacyLocalPath]) {
            const relativePath = path.relative(allowedPath, fullPath);
            if (!relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
                return fullPath;
            }
        }
        throw new Error('Caminho de arquivo fora do diretorio de uploads.');
    }
    /**
     * Absatração para salvar arquivo.
     * Por enquanto suporta apenas local, mas a interface permite expansão.
     */
    async save(buffer, options) {
        if (env.STORAGE_TYPE === 'local') {
            const fullPath = this.resolveLocalPath(path.join(this.localPath, options.filename));
            // Garante que o diretório existe
            const dir = path.dirname(fullPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(fullPath, buffer);
            return fullPath; // Em S3 retornaríamos a URL ou Key
        }
        // Futuro: S3 / GCS
        throw new Error(`Storage type ${env.STORAGE_TYPE} not implemented yet`);
    }
    /**
     * Deleta um arquivo do storage.
     */
    async delete(caminho) {
        if (env.STORAGE_TYPE === 'local') {
            const fullPath = this.resolveLocalPath(caminho);
            try {
                await fs.unlink(fullPath);
            }
            catch (err) {
                if (err.code !== 'ENOENT') {
                    console.error(`[Storage] Erro ao deletar arquivo local: ${caminho}`, err);
                    throw err;
                }
            }
            return;
        }
        // Futuro: S3 / GCS
        throw new Error(`Storage type ${env.STORAGE_TYPE} not implemented yet`);
    }
    /**
     * Retorna o buffer do arquivo.
     */
    async get(caminho) {
        if (env.STORAGE_TYPE === 'local') {
            return await fs.readFile(this.resolveLocalPath(caminho));
        }
        // Futuro: S3 / GCS
        throw new Error(`Storage type ${env.STORAGE_TYPE} not implemented yet`);
    }
}
export default new StorageService();
