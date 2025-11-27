import { ChannelType, TextChannel } from 'discord.js';
import { Discord, On, type ArgsOf } from 'discordx';

@Discord()
export class Events {
  @On()
  messageCreate([message]: ArgsOf<'messageCreate'>): void {
    console.log(
      `[Common.messageCreate] ${message.author.username} said: ${message.content} (Channel type: ${message.channel.type})`,
    );
    if (message.channel.type === ChannelType.GuildText) {
      const channel = message.channel as TextChannel;
      console.log(channel.name, channel.id);
    }
  }
}
