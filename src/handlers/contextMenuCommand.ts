import { Colors, ContextMenuCommandInteraction } from 'discord.js';
import Config from '../lib/util/config';
import { confirmGuild } from './chatInputCommand';
import client from '../client';
import { EmbedBuilder } from '@discordjs/builders';

export default async function (interaction: ContextMenuCommandInteraction) {
  if (!interaction.inGuild() || !interaction.inCachedGuild())
    return interaction.reply({ content: 'This command must be ran in a guild.', ephemeral: true });

  const config = Config.get(interaction.guildId);
  const guild = await confirmGuild(interaction.guildId);

  if (!config || !guild) return interaction.reply({ content: 'Unknown guild.', ephemeral: true });

  const command = client.commands.context.get(interaction.commandName);
  if (!command) return interaction.reply({ content: 'Unknown Command', ephemeral: true });

  if (command.clientPermissions) {
    if (!interaction.guild!.members.me!.permissions.has(command.clientPermissions))
      return interaction.reply({
        content: `**Configuration error.**\n> The command could not be executed as I do not have the required permissions for it.\n> For me to execute this command you need to give me the following permission(s): \`${command.clientPermissions
          .toArray()
          .join('`, `')
          .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\`.`,
        ephemeral: false
      });
  }

  try {
    await command.run(interaction, null, config.data);
  } catch (e) {
    if (typeof e !== 'string') {
      console.error(e);
      return;
    }

    const embed = new EmbedBuilder().setColor(Colors.Red).setDescription(e);

    if (!interaction.deferred && !interaction.replied) return interaction.reply({ embeds: [embed], ephemeral: true });
    else return interaction.editReply({ embeds: [embed] });
  }
}
