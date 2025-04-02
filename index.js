require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');

const { AttachmentBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

let activity = {};

if (fs.existsSync('activity.json')) {
  activity = JSON.parse(fs.readFileSync('activity.json'));
}

client.on('messageCreate', (message) => {
  if (message.author.bot) return;

  activity[message.author.id] = {
    username: message.author.username,
    lastMessage: new Date().toISOString(),
  };

  fs.writeFileSync('activity.json', JSON.stringify(activity, null, 2));
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const user = newState.member.user;
  activity[user.id] = {
    username: user.username,
    lastVoice: new Date().toISOString(),
  };

  fs.writeFileSync('activity.json', JSON.stringify(activity, null, 2));
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Atualiza atividade
  activity[message.author.id] = {
    ...(activity[message.author.id] || {}),
    username: message.author.username,
    lastMessage: new Date().toISOString(),
  };
  fs.writeFileSync('activity.json', JSON.stringify(activity, null, 2));

  if (message.content.startsWith('!inativos')) {
    const partes = message.content.split(' ');
    const dias = parseInt(partes[1], 10) || 7;
    const agora = new Date();

    // Garante que os membros estejam carregados
    await message.guild.members.fetch();

    const membros = message.guild.members.cache;

    const lista = [];

    for (const [id, member] of membros) {
      const dataAtividadeStr = activity[id]?.lastMessage || activity[id]?.lastVoice || null;
      const dataAtividade = dataAtividadeStr ? new Date(dataAtividadeStr) : null;

      const diffDias = dataAtividade ? (agora - dataAtividade) / (1000 * 60 * 60 * 24) : Infinity;

      if (diffDias >= dias) {
        lista.push({
          username: member.user.username,
          ultima: dataAtividade
            ? dataAtividade.toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
                timeZone: 'America/Sao_Paulo',
              })
            : 'sem registro',
        });
      }
    }

    // Ordenar por data mais antiga primeiro
    lista.sort((a, b) => {
      if (a.ultima === 'sem registro') return -1;
      if (b.ultima === 'sem registro') return 1;
      return new Date(a.ultima) - new Date(b.ultima);
    });

    if (lista.length === 0) {
      return message.channel.send(`🎉 Nenhum membro inativo nos últimos ${dias} dias.`);
    }

    const relatorio =
      `🙈 Membros inativos há pelo menos ${dias} dias:\n\n` +
      lista
        .map((m) => {
          const diasInativo =
            m.ultima === 'sem registro' ? '∞' : Math.floor((agora - new Date(m.ultima)) / (1000 * 60 * 60 * 24));

          return `- ${m.username} (última atividade: ${m.ultima} - há ${diasInativo} dias)`;
        })
        .join('\n');

    // Enviar no canal
    const fileName = 'inativos.txt';
    fs.writeFileSync(fileName, relatorio);
    const attachment = new AttachmentBuilder(fileName);
    await message.channel.send({
      content: `📎 Relatório de inativos (${dias} dias):`,
      files: [attachment],
    });

    // Tentar enviar por DM também
    try {
      await message.author.send(`📬 Aqui está o relatório de inativos (${dias} dias):\n\n` + relatorio);
    } catch {
      console.warn('❗ Não foi possível enviar DM.');
    }
  }
});

client.once('ready', () => {
  console.log(`✅ Bot conectado como ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
