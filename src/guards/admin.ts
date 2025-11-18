import { CommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import { GuardFunction } from 'discordx';

export const IsAdmin: GuardFunction<CommandInteraction> = async (params, client, next, data) => {
  const member = params.member as GuildMember | null;

  // Not in a guild → fail
  if (!member) {
    data.guardPassed = false;
    return;
  }

  // Check admin permission
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);

  data.guardPassed = isAdmin;

  // Only call next if passed (so it works standalone too)
  if (isAdmin) {
    await next();
  }
};
