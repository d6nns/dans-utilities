import { type ChatInputCommandInteraction, EmbedBuilder, Colors } from 'discord.js';
import client from '../client';
import Config from '../lib/util/config';
export const unresolvedGuilds = new Set<string>();

export default async function (interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.inCachedGuild())
    return interaction.reply({ content: 'This command must be ran in a guild.', ephemeral: true });

  const config = Config.get(interaction.guildId);
  const guild = await confirmGuild(interaction.guildId);

  if (!config || !guild) return interaction.reply({ content: 'Unknown guild.', ephemeral: true });

  const command = client.commands.slash.get(interaction.commandName);
  if (!command) return interaction.reply({ content: 'Unknown Command', ephemeral: true });

  if (command.clientPermissions) {
    if (!interaction.guild!.members.me!.permissions.has(command.clientPermissions))
      return interaction.reply({
        content: `**Configuration error.**\n> The command could not be executed as I don't have the required permissions for it.\n> For me to execute this command you need to give me the following permission(s): \`${command.clientPermissions
          .toArray()
          .join('`, `')
          .replaceAll(/[a-z][A-Z]/g, m => `${m[0]} ${m[1]}`)}\`.`,
        ephemeral: false
      });
  }

  if (command.guildResolve) {
    if (unresolvedGuilds.has(`${interaction.guildId!} ${interaction.commandName}`))
      return interaction.reply({
        content:
          'Another process of this command is currently running. Please wait for it to finish before running this command.',
        ephemeral: true
      });

    unresolvedGuilds.add(`${interaction.guildId!} ${interaction.commandName}`);
  }

  try {
    await command.run(interaction, null, config.data);

    if (command.guildResolve) unresolvedGuilds.delete(`${interaction.guildId!} ${interaction.commandName}`);
  } catch (e) {
    if (command.guildResolve) unresolvedGuilds.delete(`${interaction.guildId!} ${interaction.commandName}`);

    if (typeof e !== 'string') {
      console.error(e);
      return;
    }

    const embed = new EmbedBuilder().setColor(Colors.Red).setDescription(e);

    if (!interaction.deferred && !interaction.replied) return interaction.reply({ embeds: [embed], ephemeral: true });
    else return interaction.editReply({ embeds: [embed] });
  }
}

export async function confirmGuild(guildId: string) {
  const guild = await client.db.guild.findUnique({
    where: {
      id: guildId
    }
  });

  if (guild) return guild;

  return client.db.guild.create({
    data: {
      id: guildId
    }
  });
}
