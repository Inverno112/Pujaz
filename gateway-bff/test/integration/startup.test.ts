import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

const VALID_SECRET = 'x'.repeat(32);

function startGateway(vars: NodeJS.ProcessEnv) {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, ...vars };
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: projectRoot,
    env,
    encoding: 'utf8',
    timeout: vars.PORT === '4987' ? 4_000 : 15_000,
  });
}

describe('arranque del Gateway', () => {
  it('termina con un mensaje claro si falta JWT_SECRET', () => {
    const result = startGateway({ USE_MOCKS: 'true' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Falta la variable de entorno JWT_SECRET');
  });

  it('termina con un mensaje claro si JWT_SECRET tiene menos de 32 caracteres', () => {
    const result = startGateway({ USE_MOCKS: 'true', JWT_SECRET: 'corto' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('al menos 32 caracteres');
    expect(result.stderr).not.toContain('corto');
  });

  it('con USE_MOCKS=false arranca con los clientes HTTP hacia los MS', () => {
    const result = startGateway({
      USE_MOCKS: 'false',
      JWT_SECRET: VALID_SECRET,
      MS_TRANSACCIONAL_URL: 'http://ms-transaccional:8080',
      MS_CATALOGO_URL: 'http://ms-catalogo:8000',
      PORT: '4987',
    });
    // Sigue escuchando hasta que spawnSync lo detiene por tiempo: no terminó con error.
    expect(result.stdout).toContain('MS transaccional http://ms-transaccional:8080');
    expect(result.stderr).not.toContain('configuración inválida');
  });
});
