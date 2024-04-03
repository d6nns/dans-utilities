import { ActivityType } from 'discord.js';
import Listener from '../lib/structs/Listener';
import { confirmCommands, confirmConfig, readConfig } from '../lib/util/functions';

class ReadyListener extends Listener {
  constructor() {
    super('ready', true);
  }

  async run() {
    const commands = await this.client.application!.commands.fetch();

    for (const cmd of commands.values()) {
      const command = this.client.commands.slash.get(cmd.name)!;
      command.id = cmd.id;
    }
    console.log(`Logged in as ${this.client.user!.username}.`);

    const activities = [
      { name: '#general chat', type: ActivityType.Watching },
      { name: 'YouTube', type: ActivityType.Watching },
      { name: 'the news', type: ActivityType.Listening },
      { name: 'Twitch streamers', type: ActivityType.Watching },
      { name: 'out for rule breakers', type: ActivityType.Watching },
      { name: 'Roblox', type: ActivityType.Playing },
      { name: 'anime', type: ActivityType.Watching },
      { name: `Minecraft`, type: ActivityType.Playing },
      { name: 'the internet', type: ActivityType.Watching },
      { name: 'Spotify', type: ActivityType.Listening },
      { name: 'the world burn', type: ActivityType.Watching },
      { name: 'the gears spin', type: ActivityType.Watching }
    ];

    let i = 0;
    setInterval(() => {
      if (i >= activities.length) i = 0;
      this.client.user!.setActivity(activities[i]);
      i++;
    }, 15000);

    for (const guild of this.client.guilds.cache.values()) {
      const file = await confirmConfig(guild.id);
      if (!file)
        return guild.leave().then(() => {
          console.log(`[Config] Left guild ${guild.id} due to missing config file.`);
        });
      await readConfig(guild.id);
      await confirmCommands(guild);
    }
  }
}

export default ReadyListener;
