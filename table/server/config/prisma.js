const { AsyncLocalStorage } = require('async_hooks');
const { PrismaClient } = require('@prisma/client');

const prismaContext = new AsyncLocalStorage();
const tenantClients = new Map();

const prismaLog = process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'];

const createClient = (databaseUrl) => new PrismaClient({
  log: prismaLog,
  ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {})
});

const getMasterClient = () => {
  if (!global.masterPrisma) {
    global.masterPrisma = createClient();
  }
  return global.masterPrisma;
};

const normalizeTenantKey = (institution) => {
  if (!institution) return null;
  return institution.databaseUrl || institution.dbUrl || institution.id || institution.slug || null;
};

const getTenantClient = (institution) => {
  const databaseUrl = institution?.databaseUrl || institution?.dbUrl;
  const key = normalizeTenantKey(institution);

  if (!databaseUrl || !key) {
    return getMasterClient();
  }

  if (!tenantClients.has(key)) {
    tenantClients.set(key, createClient(databaseUrl));
  }

  return tenantClients.get(key);
};

const invalidateTenantClient = async (institution) => {
  const key = normalizeTenantKey(institution);
  if (!key || !tenantClients.has(key)) return;

  const client = tenantClients.get(key);
  tenantClients.delete(key);
  await client.$disconnect();
};

const getCurrentClient = () => {
  const context = prismaContext.getStore();
  if (context?.mode === 'tenant' && context.institution?.databaseUrl) {
    return getTenantClient(context.institution);
  }
  return getMasterClient();
};

const runWithPrismaContext = (context, callback) => {
  return prismaContext.run(context || { mode: 'master' }, callback);
};

const prisma = new Proxy({}, {
  get(_target, prop) {
    const helpers = {
      getMasterClient,
      getTenantClient,
      invalidateTenantClient,
      getCurrentClient,
      runWithPrismaContext
    };

    if (Object.prototype.hasOwnProperty.call(helpers, prop)) {
      return helpers[prop];
    }

    const client = getCurrentClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

module.exports = prisma;
