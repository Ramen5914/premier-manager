import { GuardFunction } from 'discordx';

export function OrGuard(...guards: GuardFunction[]): GuardFunction {
  return async (params, client, next, data) => {
    let passed = false;

    for (const guard of guards) {
      let allowed = true;

      try {
        await guard(params, client, async () => {}, data);
      } catch {
        allowed = false;
      }

      if (allowed) {
        passed = true;
        break;
      }
    }

    if (!passed) {
      return;
    }

    await next();
  };
}
