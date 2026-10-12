

import { test, expect, type Page } from '@playwright/test';

const BASE_URL =
  process.env.PUJAZ_BASE_URL ?? 'http://127.0.0.1:8080';

const PASSWORD = 'PujazE2E-Password-2026';
const PROMO_CODE = process.env.PUJAZ_TEST_PROMO_CODE ?? 'PROMO2026';

type TestUser = {
  name: string;
  email: string;
  password: string;
};

type TestAuction = {
  id: string;
  currentPrice: number;
  status: string;
};

type TestItem = {
  id: string;
  name: string;
  basePrice: number;
  auction: TestAuction | null;
};

// Cada prueba crea su propia cuenta para evitar colisiones.
function usuarioNuevo(): TestUser {
  const suffix =
    `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  return {
    name: `Usuario E2E ${suffix}`,
    email: `e2e-${suffix}@example.com`,
    password: PASSWORD,
  };
}

async function registrarUsuario(
  page: Page,
  user: TestUser,
): Promise<void> {
  await page.goto('/registro');

  await page.locator('#registro-nombre').fill(user.name);
  await page.locator('#registro-email').fill(user.email);
  await page.locator('#registro-password').fill(user.password);

  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(
    page.getByRole('heading', { name: 'Subastas' }),
  ).toBeVisible();

  await expect(
    page.getByText(`Hola, ${user.name}`),
  ).toBeVisible();
}

// Operación auxiliar para preparar datos de prueba.
// La creación se hace por GraphQL; la comprobación del artículo
// y las pujas se hacen desde la SPA.
async function graphql(
  page: Page,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<any> {
  const token = await page.evaluate(
    () => localStorage.getItem('pujaz_token'),
  );

  if (!token) {
    throw new Error(
      'No hay sesión. Registra o autentica un usuario antes de llamar GraphQL.',
    );
  }

  const response = await page.request.post(
    `${BASE_URL}/graphql`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        query,
        variables,
      },
    },
  );

  expect(
    response.ok(),
    `GraphQL respondió HTTP ${response.status()}`,
  ).toBeTruthy();

  const body = await response.json();

  expect(
    body.errors,
    `Errores GraphQL: ${JSON.stringify(body.errors)}`,
  ).toBeUndefined();

  return body.data;
}

// El contrato createItem crea el artículo y su subasta.
// Así no dependemos de que haya una subasta activa en el seed.
async function crearArticuloConSubasta(
  page: Page,
  basePrice = 100_000,
): Promise<TestItem> {
  const suffix =
    `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  const data = await graphql(
    page,
    `
      mutation CrearArticulo($input: CreateItemInput!) {
        createItem(input: $input) {
          id
          name
          basePrice
          auction {
            id
            currentPrice
            status
          }
        }
      }
    `,
    {
      input: {
        name: `Lote E2E ${suffix}`,
        description: 'Artículo creado para pruebas automatizadas.',
        category: 'Pruebas',
        images: [],
        documents: [],
        basePrice,
        endsAt: new Date(
          Date.now() + 60 * 60 * 1000,
        ).toISOString(),
      },
    },
  );

  const item = data.createItem as TestItem;

  expect(item.id).toBeTruthy();
  expect(item.auction).not.toBeNull();

  return item;
}

async function recargarSaldo(
  page: Page,
  amount: number,
): Promise<void> {
  const promoCode = PROMO_CODE;

  await graphql(
    page,
    `
      mutation Depositar(
        $amount: Float!,
        $promoCode: String!
      ) {
        deposit(amount: $amount, promoCode: $promoCode) {
          available
          reserved
        }
      }
    `,
    { amount, promoCode },
  );
}

test('E2E-01: abre la SPA de Pujaz', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Pujaz, casa de subastas');

  await expect(
    page.getByRole('heading', { name: 'Subastas' }),
  ).toBeVisible();
});

test('E2E-02: permite elegir un usuario e iniciar sesión', async ({
  page,
}) => {
  const user = usuarioNuevo();

  // Precondición: crear una cuenta nueva.
  await registrarUsuario(page, user);

  // Cerrar la sesión creada automáticamente al registrarse.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await page.getByRole('link', { name: 'Iniciar sesión' }).click();

  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(user.password);

  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(
    page.getByText(`Hola, ${user.name}`),
  ).toBeVisible();
});

test('E2E-03: busca artículos del catálogo', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('searchbox', {
    name: 'Buscar artículos',
  }).fill('Reloj');

  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(
    page.getByRole('link', { name: 'Reloj' }),
  ).toBeVisible();

  // También comprobamos el estado vacío.
  await page.getByRole('searchbox', {
    name: 'Buscar artículos',
  }).fill('ArticuloInexistenteE2E987654');

  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(
    page.getByText(/No hay artículos que coincidan/),
  ).toBeVisible();
});

test('E2E-04: abre el detalle de un artículo', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', {
    name: 'Reloj',
  }).click();

  await expect(
    page.getByRole('heading', { name: 'Reloj'}),
  ).toBeVisible();

  await expect(
    page.getByText('Reloj de bolsillo 1920'),
  ).toBeVisible();

  await expect(
    page.getByText('Precio base'),
  ).toBeVisible();
});

test('E2E-05: crea un artículo mediante GraphQL y lo encuentra en la SPA', async ({
  page,
}) => {
  const user = usuarioNuevo();

  await registrarUsuario(page, user);

  // Limitación conocida: actualmente no hay formulario de publicación
  // en la SPA. Se usa createItem para preparar el artículo.
  const item = await crearArticuloConSubasta(page);

  await page.goto('/');

  await page.getByRole('searchbox', {
    name: 'Buscar artículos',
  }).fill(item.name);

  await page.getByRole('button', { name: 'Buscar' }).click();

  await expect(
    page.getByRole('link', { name: item.name }),
  ).toBeVisible();

  await page.getByRole('link', { name: item.name }).click();

  await expect(
    page.getByRole('heading', { name: item.name }),
  ).toBeVisible();
});

test('E2E-06: conserva el artículo después de recargar', async ({
  page,
}) => {
  const user = usuarioNuevo();

  await registrarUsuario(page, user);

  const item = await crearArticuloConSubasta(page);

  await page.goto(`/items/${item.id}`);

  await expect(
    page.getByRole('heading', { name: item.name }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole('heading', { name: item.name }),
  ).toBeVisible();

  await expect(
    page.getByRole('heading', { name: 'Subasta' }),
  ).toBeVisible();
});

test('E2E-07: rechaza una puja por saldo insuficiente', async ({
  page,
}) => {
  const user = usuarioNuevo();

  await registrarUsuario(page, user);

  // Las cuentas nuevas empiezan con saldo cero.
  const item = await crearArticuloConSubasta(page, 100_000);

  if (!item.auction) {
    throw new Error('No se creó la subasta de prueba.');
  }

  await page.goto(`/items/${item.id}`);

  // El monto supera el precio actual, pero el usuario no tiene saldo.
  await page.locator('#monto-puja').fill(
    String(item.auction.currentPrice + 100),
  );

  await page.getByRole('button', { name: 'Pujar' }).click();

  await expect(
    page.getByRole('alert'),
  ).toContainText('No tienes saldo disponible suficiente');

  // No debe mostrarse el mensaje de puja aceptada.
  await expect(
    page.getByRole('status'),
  ).toHaveCount(0);
});

test('E2E-08: registra una puja válida', async ({ page }) => {
  const user = usuarioNuevo();

  await registrarUsuario(page, user);

  const item = await crearArticuloConSubasta(page, 100_000);

  if (!item.auction) {
    throw new Error('No se creó la subasta de prueba.');
  }

  await recargarSaldo(page, 1_000_000);

  await page.goto(`/items/${item.id}`);

  const monto = item.auction.currentPrice + 100;

  await page.locator('#monto-puja').fill(String(monto));
  await page.getByRole('button', { name: 'Pujar' }).click();

  await expect(
    page.getByRole('status'),
  ).toContainText('quedó registrada');

  await expect(
    page.getByText('Va ganando', { exact: false }),
  ).toContainText(user.name);
});

test('E2E-09: muestra la puja ganadora después de recargar', async ({
  page,
}) => {
  const user = usuarioNuevo();

  await registrarUsuario(page, user);

  const item = await crearArticuloConSubasta(page, 100_000);

  if (!item.auction) {
    throw new Error('No se creó la subasta de prueba.');
  }

  await recargarSaldo(page, 1_000_000);

  await page.goto(`/items/${item.id}`);

  const monto = item.auction.currentPrice + 100;

  await page.locator('#monto-puja').fill(String(monto));
  await page.getByRole('button', { name: 'Pujar' }).click();

  await expect(
    page.getByRole('status'),
  ).toContainText('quedó registrada');

  await page.reload();

  await expect(
    page.getByText('Va ganando', { exact: false }),
  ).toContainText(user.name);

  await expect(
    page.getByRole('heading', { name: 'Actividad reciente' }),
  ).toBeVisible();
});
