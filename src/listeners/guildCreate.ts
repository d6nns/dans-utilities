import { ChannelType, Guild, REST, Routes, TextChannel } from 'discord.js';
import Listener from '../lib/structs/Listener';
import { confirmConfig, confirmCommands, readConfig } from '../lib/util/functions';

class GuildCreateListener extends Listener {
  constructor() {
    super('guildCreate');
  }

  async run(guild: Guild) {
    const configFile = await confirmConfig(guild.id);

    if (configFile === null) {
      return guild.leave().then(() => {
        console.log(`[Config] Left guild ${guild.id} due to missing config file.`);
      });
    }

    await readConfig(guild.id);
    await confirmCommands(guild);
  }
}

export default GuildCreateListener;
