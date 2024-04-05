import { EmbedBuilder, Message, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import Command, { properties } from '../../lib/structs/Command';
import { mainColor } from '../../lib/util/constants';
import ms from 'ms';
import { PunishmentType } from '../../lib/util/constants';
import { ConfigData } from '../../lib/structs/Interfaces';

@properties<'message'>({
  name: 'help',
  description: 'Get a list of all commands or get help on a certain command.',
  args: '[command]',
  userPermissions: PermissionFlagsBits.ManageMessages
})
class HelpCommand extends Command {
  async run(message: Message, args: string[], config: ConfigData) {
    const prefix = config.commands.prefix;

    if (args.length > 0) {
      const commandName = args[0];
      const command =
        this.client.commands.message.get(commandName) ??
        this.client.commands.message.get(this.client.aliases.get(commandName) as string);

      if (command?.name === 'eval' && message.author.id !== process.env.DEV)
        throw 'No command with that name or alias exists.';

      if (!command) {
        // check for shortcut
        if (!message.inGuild()) throw 'No command with that name or alias exists.';
        const shortcut = await this.client.db.shortcut.findUnique({
          where: {
            guildId_name: { guildId: message.guildId, name: commandName }
          }
        });

        if (!shortcut) throw 'No command with that name or alias exists.';

        const embed = new EmbedBuilder()
          .setAuthor({ name: `${this.client.user?.username}`, iconURL: this.client.user!.displayAvatarURL() })
          .setTitle(shortcut.name)
          .setColor(mainColor)
          .setDescription(
            `${shortcut.description}\n\n**•** Usage: \`${prefix}${shortcut.name} ${
              shortcut.punishment === PunishmentType.Ban || shortcut.punishment === PunishmentType.Unban
                ? '<user>'
                : '<member>'
            }\`\n**•** Punishment: \`${shortcut.punishment.toString()}\`\n**•** Reason: ${shortcut.reason}${
              shortcut.duration ? `\n**•** Duration: \`${ms(Number(shortcut.duration), { long: true })}\`.` : ''
            }${
              shortcut.deleteTime
                ? `\n**•** Delete Time: Up to \`${ms(shortcut.deleteTime * 1000, { long: true })}\` old.`
                : ''
            }\n**•** Required Permission: \`${new PermissionsBitField(shortcut.permission)
              .toArray()
              .join('`, `')
              .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\`.`
          );

        return message.channel.send({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setAuthor({ name: `${this.client.user!.username}`, iconURL: this.client.user!.displayAvatarURL() })
        .setTitle(command.name)
        .setColor(mainColor);

      let description = `${command.description}\n\n`;
      if (command.slashOnly) description += '***• This command is only available via slash commands!***\n';
      if (command.args)
        description += `**•** Usage: \`${command.args.map(way => `${prefix}${command.name} ${way}`).join('\n')}\`\n`;
      if (command.aliases.length > 0)
        description += `**•** Aliases: ${command.aliases.map(alias => `\`${alias}\``).join(', ')}\n`;
      if (command.userPermissions)
        description += `**•** Required Permission: \`${new PermissionsBitField(command.userPermissions)
          .toArray()
          .join('`, `')
          .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\``;
      if (command.precondition) description += `\n**•** Precondition: \`${command.precondition}\``;

      embed.setDescription(description);

      return message.channel.send({ embeds: [embed] });
    }

    const commands = [...this.client.commands.message.values()];
    commands.splice(
      commands.findIndex(c => c.name === 'eval'),
      1
    );

    const shortcuts = message.inGuild()
      ? (await this.client.db.shortcut.findMany({ where: { guildId: message.guildId } }))!
      : null;

    const embed = new EmbedBuilder()
      .setAuthor({ name: `${this.client.user!.username}`, iconURL: this.client.user!.displayAvatarURL() })
      .setTitle('Command List')
      .setColor(mainColor)
      .setDescription(
        "Commands that are ~~crossed over~~ indicate they're only available via slash commands. Optional arguments are marked with `[]` and required ones with `<>`."
      )
      .addFields(
        {
          name: 'Management',
          value: '`config`, ~~`escalations`~~, ~~`shortcuts`~~'
        },
        {
          name: 'Moderation',
          value:
            '`warn`, `mute`, `kick`, `ban`, `unmute`, `unban`, `punishments`, `punishment`, `remove-all-punishments`, `remove-punishment`'
        }
      );
    if (shortcuts && shortcuts.length !== 0)
      embed.addFields({
        name: 'Shortcuts',
        value: shortcuts.map(shortcut => `\`${shortcut.name}\``).join(', ')
      });
    embed.addFields({
      name: 'Utility',
      value:
        '`avatar`, `alt-manager`, `help`, `lock`, `unlock`, `manage-nick`, `moderate-nick`, `ping`, `purge`, `slowmode`, `tag`, `userinfo`'
    });
    embed.addFields({
      name: 'Tomfoolery',
      value: '`bean`, `warm`, `yeet`'
    });
    embed.setFooter({ text: `Prefix: ${prefix}` });

    return message.channel.send({ embeds: [embed] });
  }
}

export default HelpCommand;
