import { CommandInteraction, GuildMember } from 'discord.js';
import { GuardFunction } from 'discordx';
import Enmap from 'enmap';

export const IsManager: GuardFunction<CommandInteraction> = async (params, client, next, data) => {
  const db = new Enmap({ name: 'premier_data' });
  const ownerRoleId = db.get('ownerRoleId');
  const managerRoleId = db.get('captainRoleId');

  const member = params.member as GuildMember | null;
  if (!member) {
    data.guardPassed = false;
    return;
  }

  const roleArray = [...member.roles.cache.keys()];
  const passed = roleArray.includes(ownerRoleId) || roleArray.includes(managerRoleId);

  data.guardPassed = passed;

  if (passed) {
    await next();
  }
};
